import type Stripe from "stripe";
import { and, eq, inArray, ne } from "drizzle-orm";

import { db } from "@/db";
import { sessions, userAccessRequests, users, workspaceMembers, workspaces } from "@/db/schema";
import { stripeClient, stripeObjectId } from "@/lib/billing/stripe";
import { sendRefundSuccessEmail, sendWorkspacePausedEmail } from "@/lib/email/send-account-notification-email";
import { clearAuthCookies, getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

type PaidInvoice = Stripe.Invoice & {
  payment_intent?: string | Stripe.PaymentIntent | null;
};

export async function POST() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Authentication required." }, { status: 401 });

  const [account, access] = await Promise.all([
    db.select({ name: users.name, email: users.email }).from(users).where(eq(users.id, currentUser.id)).limit(1),
    db.select({ status: userAccessRequests.status, stripeSubscriptionId: userAccessRequests.stripeSubscriptionId, stripeCustomerId: userAccessRequests.stripeCustomerId })
      .from(userAccessRequests).where(eq(userAccessRequests.userId, currentUser.id)).limit(1),
  ]);
  const user = account[0];
  const payment = access[0];
  if (!user) return Response.json({ error: "Account not found." }, { status: 404 });
  if (!payment?.stripeSubscriptionId || !payment.stripeCustomerId || payment.status !== "approved") {
    return Response.json({ error: payment?.status === "refunded" ? "This payment has already been refunded." : "No refundable Owner subscription was found." }, { status: 409 });
  }

  try {
    const stripe = stripeClient();
    const subscription = await stripe.subscriptions.retrieve(payment.stripeSubscriptionId);
    if (subscription.metadata.kind !== "user_access" || subscription.metadata.userId !== currentUser.id || stripeObjectId(subscription.customer) !== payment.stripeCustomerId) {
      return Response.json({ error: "The subscription ownership check failed." }, { status: 403 });
    }

    const invoices = await stripe.invoices.list({ subscription: subscription.id, status: "paid", limit: 1, expand: ["data.payment_intent"] });
    const invoice = invoices.data[0] as PaidInvoice | undefined;
    const paymentIntentId = invoice ? stripeObjectId(invoice.payment_intent ?? null) : null;
    if (!invoice || !paymentIntentId || Date.now() - invoice.created * 1000 > SEVEN_DAYS_MS) {
      return Response.json({ error: "Refunds are available only for the first successful payment within seven days." }, { status: 409 });
    }

    const previousRefunds = await stripe.refunds.list({ payment_intent: paymentIntentId, limit: 100 });
    if (previousRefunds.data.some((refund) => refund.status === "succeeded" || refund.status === "pending" || refund.status === "requires_action")) {
      return Response.json({ error: "A refund is already being processed for this payment." }, { status: 409 });
    }

    if (subscription.status !== "canceled") await stripe.subscriptions.cancel(subscription.id, { invoice_now: false, prorate: false });
    const refund = await stripe.refunds.create({
      payment_intent: paymentIntentId,
      reason: "requested_by_customer",
      metadata: { teamflow_user_id: currentUser.id, teamflow_subscription_id: subscription.id },
    }, { idempotencyKey: `teamflow-full-refund-${subscription.id}` });

    await db.transaction(async (tx) => {
      const [changed] = await tx.update(userAccessRequests)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(and(
          eq(userAccessRequests.userId, currentUser.id),
          eq(userAccessRequests.stripeSubscriptionId, subscription.id),
          inArray(userAccessRequests.status, ["approved", "payment_failed"]),
        ))
        .returning({ id: userAccessRequests.id });
      if (!changed) throw new Error("Refund access record was already changed.");
      await tx.delete(sessions).where(eq(sessions.userId, currentUser.id));
    });
    await clearAuthCookies();
    try { await sendRefundSuccessEmail({ email: user.email, name: user.name, amount: refund.amount, currency: refund.currency }); } catch (error) { console.error("Refund notification email failed", error); }
    const affectedMembers = await db.select({ email: users.email, name: users.name, workspaceName: workspaces.name })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(and(eq(workspaces.ownerId, currentUser.id), ne(workspaceMembers.userId, currentUser.id)));
    await Promise.allSettled(affectedMembers.map((member) => sendWorkspacePausedEmail(member)));
    return Response.json({ refundStatus: refund.status, message: "Your subscription was cancelled and the refund has been started. You have been signed out for security." });
  } catch (error) {
    console.error("Secure refund failed", error);
    return Response.json({ error: "The refund could not be completed. Please check your billing status before trying again." }, { status: 502 });
  }
}
