import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { workspaceMembers, workspaceSubscriptions, workspaces } from "@/db/schema";
import { mapStripeStatus, stripeClient, stripeObjectId, stripeSubscriptionPeriod } from "@/lib/billing/stripe";
import { getCurrentUser } from "@/lib/security/session";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ session_id?: string | string[] }> };

export default async function BillingSuccessPage({ params, searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { slug } = await params;
  const values = await searchParams;
  const sessionId = typeof values.session_id === "string" ? values.session_id : null;
  if (!sessionId || !/^cs_(?:test_|live_)?[A-Za-z0-9]+$/.test(sessionId)) redirect(`/workspaces/${slug}/billing?payment=invalid`);

  const [workspace] = await db.select({ id: workspaces.id }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, user.id), eq(workspaceMembers.role, "owner"))).limit(1);
  if (!workspace) redirect("/dashboard");

  let outcome: "active" | "invalid" | "pending" = "active";
  try {
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.mode !== "subscription" || session.status !== "complete" || session.metadata?.workspaceId !== workspace.id || session.metadata.userId !== user.id) {
      outcome = "invalid";
    } else {
      const subscriptionId = stripeObjectId(session.subscription);
      const customerId = stripeObjectId(session.customer);
      if (!subscriptionId || !customerId) {
        outcome = "pending";
      } else {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        if (!priceId || subscription.metadata.workspaceId !== workspace.id) {
          outcome = "invalid";
        } else {
          const period = stripeSubscriptionPeriod(subscription);
          const record = { workspaceId: workspace.id, planKey: "pro", billingProvider: "stripe", stripeCustomerId: customerId, stripePriceId: priceId, stripeSubscriptionId: subscription.id, status: mapStripeStatus(subscription.status), currentPeriodStart: period.start, currentPeriodEnd: period.end, cancelAtCycleEnd: subscription.cancel_at_period_end ? 1 : 0, updatedAt: new Date() } as const;
          await db.insert(workspaceSubscriptions).values(record).onConflictDoUpdate({ target: workspaceSubscriptions.workspaceId, set: record });
        }
      }
    }
  } catch (error) {
    console.error("Failed to confirm Stripe Checkout", error);
    outcome = "pending";
  }
  if (outcome !== "active") redirect(`/workspaces/${slug}/billing?payment=${outcome}`);
  redirect("/dashboard?subscription=active");
}
