import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { userAccessRequests, users, workspaceMembers, workspaces } from "@/db/schema";
import { sendWorkspaceMembershipEmail } from "@/lib/email/send-workspace-membership-email";
import { getCurrentUser } from "@/lib/security/session";
import { updateWorkspaceMemberSchema } from "@/lib/validations/workspace";

export const runtime = "nodejs";

type MemberContext = { params: Promise<{ slug: string; memberId: string }> };

export async function PATCH(request: Request, context: MemberContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { slug, memberId } = await context.params;
  const [ownerAccess] = await db
    .select({ workspaceId: workspaces.id, ownerId: workspaces.ownerId, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, currentUser.id)))
    .limit(1);

  if (!ownerAccess) return Response.json({ error: "Workspace not found." }, { status: 404 });
  if (ownerAccess.role !== "owner") return Response.json({ error: "Only the workspace owner can change member roles." }, { status: 403 });
  if (memberId === ownerAccess.ownerId) return Response.json({ error: "The workspace owner role cannot be changed." }, { status: 400 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const result = updateWorkspaceMemberSchema.safeParse(body);
  if (!result.success) return Response.json({ error: "Select a valid member role." }, { status: 400 });

  const [member] = await db
    .update(workspaceMembers)
    .set({ role: result.data.role })
    .where(and(eq(workspaceMembers.workspaceId, ownerAccess.workspaceId), eq(workspaceMembers.userId, memberId)))
    .returning({ userId: workspaceMembers.userId, role: workspaceMembers.role });

  if (!member) return Response.json({ error: "Member not found." }, { status: 404 });
  return Response.json({ member });
}

export async function DELETE(_request: Request, context: MemberContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { slug, memberId } = await context.params;
  const [actor] = await db.select({
    workspaceId: workspaces.id,
    workspaceName: workspaces.name,
    ownerId: workspaces.ownerId,
    role: workspaceMembers.role,
  }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, currentUser.id)))
    .limit(1);
  if (!actor) return Response.json({ error: "Workspace not found." }, { status: 404 });

  const [target] = await db.select({ id: users.id, name: users.name, email: users.email, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(and(eq(workspaceMembers.workspaceId, actor.workspaceId), eq(workspaceMembers.userId, memberId)))
    .limit(1);
  if (!target) return Response.json({ error: "Member not found." }, { status: 404 });

  const isLeaving = currentUser.id === memberId;
  if (target.role === "owner") return Response.json({ error: "The workspace Owner cannot leave or be removed." }, { status: 400 });
  if (!isLeaving && actor.role !== "owner") return Response.json({ error: "Only the workspace Owner can remove members." }, { status: 403 });

  await db.transaction(async (tx) => {
    await tx.delete(workspaceMembers).where(and(
      eq(workspaceMembers.workspaceId, actor.workspaceId),
      eq(workspaceMembers.userId, target.id),
    ));

    const [remainingMembership] = await tx.select({ id: workspaceMembers.id })
      .from(workspaceMembers).where(eq(workspaceMembers.userId, target.id)).limit(1);
    const [access] = await tx.select({ stripeSubscriptionId: userAccessRequests.stripeSubscriptionId })
      .from(userAccessRequests).where(eq(userAccessRequests.userId, target.id)).limit(1);
    if (!remainingMembership && access && !access.stripeSubscriptionId) {
      await tx.update(userAccessRequests).set({
        status: "awaiting_payment",
        workspaceId: null,
        approvedRole: null,
        reviewedByUserId: null,
        reviewedAt: null,
        updatedAt: new Date(),
      }).where(eq(userAccessRequests.userId, target.id));
    }
  });

  let emailSent = true;
   try {
    await sendWorkspaceMembershipEmail({
      email: target.email,
      name: target.name,
      workspaceName: actor.workspaceName,
      action: isLeaving ? "left" : "removed",
    });
  } catch (error) {
    emailSent = false;
    console.error("Workspace membership notification email failed", error);
  }

  return Response.json({
    message: isLeaving ? "You left the workspace." : "Member removed from the workspace.",
    emailSent,
  });
}
