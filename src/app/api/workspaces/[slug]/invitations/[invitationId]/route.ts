import {
  and,
  eq,
  isNotNull,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  workspaceInvitations,
  workspaceMembers,
  workspaces,
  users,
  userAccessRequests,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

type InvitationRouteContext = {
  params: Promise<{
    slug: string;
    invitationId: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: InvitationRouteContext,
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json(
      {
        error: "Authentication required.",
      },
      {
        status: 401,
      },
    );
  }

  const {
    slug,
    invitationId,
  } = await context.params;

  const [membership] = await db
    .select({
      workspaceId: workspaces.id,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(
      workspaces,
      eq(
        workspaceMembers.workspaceId,
        workspaces.id,
      ),
    )
    .where(
      and(
        eq(workspaces.slug, slug),
        eq(
          workspaceMembers.userId,
          currentUser.id,
        ),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json(
      {
        error: "Workspace not found.",
      },
      {
        status: 404,
      },
    );
  }

  if (
    membership.role !== "owner" &&
    membership.role !== "admin"
  ) {
    return Response.json(
      {
        error:
          "You do not have permission to revoke invitations.",
      },
      {
        status: 403,
      },
    );
  }

  const [revokedInvitation] = await db
    .update(workspaceInvitations)
    .set({
      revokedAt: new Date(),
    })
    .where(
      and(
        eq(
          workspaceInvitations.id,
          invitationId,
        ),
        eq(
          workspaceInvitations.workspaceId,
          membership.workspaceId,
        ),
        isNull(
          workspaceInvitations.acceptedAt,
        ),
        isNull(
          workspaceInvitations.revokedAt,
        ),
      ),
    )
    .returning({
      id: workspaceInvitations.id,
    });

  if (!revokedInvitation) {
    return Response.json(
      {
        error:
          "The invitation was not found or is no longer active.",
      },
      {
        status: 404,
      },
    );
  }

  return Response.json({
    message: "Invitation revoked.",
  });
}

export async function POST(request: Request, context: InvitationRouteContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { slug, invitationId } = await context.params;
  const body = await request.json().catch(() => null) as { decision?: string } | null;
  if (!body || !["accept", "reject"].includes(body.decision || "")) return Response.json({ error: "Choose Accept or Reject." }, { status: 400 });

  const [owner] = await db.select({ workspaceId: workspaces.id }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, currentUser.id), eq(workspaceMembers.role, "owner"))).limit(1);
  if (!owner) return Response.json({ error: "Only the workspace Owner can decide join requests." }, { status: 403 });

  const [invitation] = await db.select({
    id: workspaceInvitations.id,
    email: workspaceInvitations.email,
    role: workspaceInvitations.role,
    userId: users.id,
  }).from(workspaceInvitations)
    .innerJoin(users, eq(users.email, workspaceInvitations.email))
    .where(and(
      eq(workspaceInvitations.id, invitationId),
      eq(workspaceInvitations.workspaceId, owner.workspaceId),
      isNotNull(workspaceInvitations.requestedAt),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
    )).limit(1);
  if (!invitation) return Response.json({ error: "This join request is no longer pending." }, { status: 404 });

  const now = new Date();
  await db.transaction(async (tx) => {
    if (body.decision === "accept") {
      await tx.insert(workspaceMembers).values({ workspaceId: owner.workspaceId, userId: invitation.userId, role: invitation.role }).onConflictDoUpdate({ target: [workspaceMembers.workspaceId, workspaceMembers.userId], set: { role: invitation.role } });
      await tx.insert(userAccessRequests).values({ userId: invitation.userId, status: "approved", workspaceId: owner.workspaceId, approvedRole: invitation.role, reviewedByUserId: currentUser.id, reviewedAt: now, updatedAt: now }).onConflictDoUpdate({ target: userAccessRequests.userId, set: { status: "approved", workspaceId: owner.workspaceId, approvedRole: invitation.role, reviewedByUserId: currentUser.id, reviewedAt: now, updatedAt: now } });
      await tx.update(workspaceInvitations).set({ acceptedAt: now }).where(eq(workspaceInvitations.id, invitation.id));
    } else {
      await tx.update(workspaceInvitations).set({ revokedAt: now }).where(eq(workspaceInvitations.id, invitation.id));
    }
  });
  return Response.json({ message: body.decision === "accept" ? "User added to the workspace." : "Join request rejected." });
}
