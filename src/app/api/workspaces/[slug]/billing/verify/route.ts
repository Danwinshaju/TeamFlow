import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceMembers, workspaceSubscriptions, workspaces } from "@/db/schema";
import { verifyRazorpayPaymentSignature } from "@/lib/billing/razorpay";
import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { slug } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature?: string;
  } | null;

  if (!body?.razorpay_payment_id || !body.razorpay_subscription_id || !body.razorpay_signature) {
    return Response.json({ error: "Incomplete payment confirmation." }, { status: 400 });
  }

  const [subscription] = await db
    .select({ id: workspaceSubscriptions.id, subscriptionId: workspaceSubscriptions.razorpaySubscriptionId })
    .from(workspaceSubscriptions)
    .innerJoin(workspaces, eq(workspaceSubscriptions.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, user.id), eq(workspaceMembers.role, "owner"), eq(workspaceSubscriptions.razorpaySubscriptionId, body.razorpay_subscription_id)))
    .limit(1);

  if (!subscription) return Response.json({ error: "Subscription not found." }, { status: 404 });

  if (!verifyRazorpayPaymentSignature(subscription.subscriptionId, body.razorpay_payment_id, body.razorpay_signature)) {
    return Response.json({ error: "Payment verification failed." }, { status: 400 });
  }

  await db.update(workspaceSubscriptions).set({ status: "active", updatedAt: new Date() }).where(eq(workspaceSubscriptions.id, subscription.id));
  return Response.json({ verified: true });
}