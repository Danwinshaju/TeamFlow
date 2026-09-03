import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceMembers, workspaceSubscriptions, workspaces } from "@/db/schema";
import { createRazorpaySubscription, getRazorpayKeyId } from "@/lib/billing/razorpay";
import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

type Context = { params: Promise<{ slug: string }> };

export async function POST(_request: Request, context: Context) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { slug } = await context.params;
  const [access] = await db
    .select({ workspaceId: workspaces.id, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, user.id)))
    .limit(1);

  if (!access) return Response.json({ error: "Workspace not found." }, { status: 404 });
  if (access.role !== "owner") return Response.json({ error: "Only the workspace owner can manage billing." }, { status: 403 });

  const [existing] = await db
    .select({ id: workspaceSubscriptions.id, status: workspaceSubscriptions.status })
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.workspaceId, access.workspaceId))
    .limit(1);

  if (existing && !["cancelled", "completed", "expired"].includes(existing.status)) {
    return Response.json({ error: "This workspace already has a subscription." }, { status: 409 });
  }

  const planId = process.env.RAZORPAY_PRO_PLAN_ID;
  if (!planId) return Response.json({ error: "Billing is not configured." }, { status: 503 });

  try {
    const subscription = await createRazorpaySubscription(planId);
    const values = {
      workspaceId: access.workspaceId,
      planKey: "pro",
      razorpayPlanId: planId,
      razorpaySubscriptionId: subscription.id,
      status: subscription.status,
      updatedAt: new Date(),
    } as const;

    if (existing) {
      await db.update(workspaceSubscriptions).set(values).where(eq(workspaceSubscriptions.id, existing.id));
    } else {
      await db.insert(workspaceSubscriptions).values(values);
    }

    return Response.json({ keyId: getRazorpayKeyId(), subscriptionId: subscription.id });
  } catch (error) {
    console.error("Failed to create Razorpay subscription", error);
    return Response.json({ error: "Could not start the subscription." }, { status: 502 });
  }
}