import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceMembers, workspaceSubscriptions, workspaces } from "@/db/schema";
import { cancelRazorpaySubscription } from "@/lib/billing/razorpay";
import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { slug } = await context.params;
  const [subscription] = await db
    .select({ id: workspaceSubscriptions.id, razorpayId: workspaceSubscriptions.razorpaySubscriptionId })
    .from(workspaceSubscriptions)
    .innerJoin(workspaces, eq(workspaceSubscriptions.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, user.id), eq(workspaceMembers.role, "owner")))
    .limit(1);

  if (!subscription) return Response.json({ error: "Active subscription not found." }, { status: 404 });

  try {
    await cancelRazorpaySubscription(subscription.razorpayId);
    await db.update(workspaceSubscriptions).set({ cancelAtCycleEnd: 1, updatedAt: new Date() }).where(eq(workspaceSubscriptions.id, subscription.id));
    return Response.json({ cancelled: true });
  } catch (error) {
    console.error("Failed to cancel Razorpay subscription", error);
    return Response.json({ error: "Could not cancel the subscription." }, { status: 502 });
  }
}