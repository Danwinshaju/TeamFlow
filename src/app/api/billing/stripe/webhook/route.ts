import type Stripe from "stripe";
import { and, eq, ne } from "drizzle-orm";

import { db } from "@/db";
import { userAccessRequests, users, workspaceMembers, workspaces, workspaceSubscriptions } from "@/db/schema";
import { completeUserAccessPayment } from "@/lib/billing/access";
import { sendWorkspacePausedEmail } from "@/lib/email/send-account-notification-email";
import { mapStripeStatus, stripeClient, stripeObjectId, stripeSubscriptionPeriod } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return Response.json({ error: "Stripe webhook is not configured." }, { status: 400 });

  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Invalid Stripe webhook signature", error);
    return Response.json({ error: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (session.metadata?.kind === "user_access" && session.metadata.purpose === "create_owned_workspace" && session.metadata.userId) {
        const subscriptionId = stripeObjectId(session.subscription);
        const customerId = stripeObjectId(session.customer);
        if (subscriptionId && customerId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = subscription.items.data[0]?.price.id;
          if (priceId) await completeUserAccessPayment(session.metadata.userId, { customerId, subscriptionId, priceId });
        }
        return Response.json({ received: true });
      }
      const workspaceId = session.metadata?.workspaceId;
      const subscriptionId = stripeObjectId(session.subscription);
      const customerId = stripeObjectId(session.customer);
      if (workspaceId && subscriptionId && customerId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await saveSubscription(workspaceId, customerId, subscription);
      }
    }

    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      if (subscription.metadata.kind === "user_access" && subscription.metadata.purpose === "create_owned_workspace" && subscription.metadata.userId) {
        const customerId = stripeObjectId(subscription.customer);
        const priceId = subscription.items.data[0]?.price.id;
        if (["active", "trialing"].includes(subscription.status) && customerId && priceId) {
          await completeUserAccessPayment(subscription.metadata.userId, { customerId, subscriptionId: subscription.id, priceId });
        } else if (["past_due", "unpaid", "incomplete_expired", "canceled"].includes(subscription.status)) {
          const [previousAccess] = await db.select({ status: userAccessRequests.status })
            .from(userAccessRequests)
            .where(and(eq(userAccessRequests.userId, subscription.metadata.userId), eq(userAccessRequests.stripeSubscriptionId, subscription.id)))
            .limit(1);
          await db.update(userAccessRequests).set({ status: "payment_failed", updatedAt: new Date() })
            .where(and(
              eq(userAccessRequests.userId, subscription.metadata.userId),
              eq(userAccessRequests.stripeSubscriptionId, subscription.id),
              ne(userAccessRequests.status, "refunded"),
            ));
          // Notify only when an active Owner plan first becomes unavailable.
          // Refunds already notify members in the refund route, so they are excluded.
          if (previousAccess?.status === "approved") {
            const affectedMembers = await db.select({ email: users.email, name: users.name, workspaceName: workspaces.name })
              .from(workspaceMembers)
              .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
              .innerJoin(users, eq(workspaceMembers.userId, users.id))
              .where(and(eq(workspaces.ownerId, subscription.metadata.userId), ne(workspaceMembers.userId, subscription.metadata.userId)));
            await Promise.allSettled(affectedMembers.map((member) => sendWorkspacePausedEmail(member)));
          }
        }
        return Response.json({ received: true });
      }
      const workspaceId = subscription.metadata.workspaceId;
      const customerId = stripeObjectId(subscription.customer);
      if (workspaceId && customerId) await saveSubscription(workspaceId, customerId, subscription);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Failed to process Stripe webhook", error);
    return Response.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}

async function saveSubscription(workspaceId: string, customerId: string, subscription: Stripe.Subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  if (!priceId) throw new Error("Stripe subscription has no price.");
  const period = stripeSubscriptionPeriod(subscription);
  const record = { workspaceId, planKey: "pro", billingProvider: "stripe", stripeCustomerId: customerId, stripePriceId: priceId, stripeSubscriptionId: subscription.id, status: mapStripeStatus(subscription.status), currentPeriodStart: period.start, currentPeriodEnd: period.end, cancelAtCycleEnd: subscription.cancel_at_period_end ? 1 : 0, updatedAt: new Date() } as const;
  await db.insert(workspaceSubscriptions).values(record).onConflictDoUpdate({ target: workspaceSubscriptions.workspaceId, set: record });
}
