import {
  and,
  eq,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  workspaceInvitations,
  workspaceMembers,
  workspaces,
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