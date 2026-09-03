    import {
  and,
  eq,
  gt,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { sendWorkspaceInvitationEmail } from "@/lib/email/send-workspace-invitation-email";
import { createInvitationToken } from "@/lib/security/invitation-token";
import { getCurrentUser } from "@/lib/security/session";
import { createInvitationSchema } from "@/lib/validations/invitation";

export const runtime = "nodejs";

type InvitationRouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

export async function POST(
  request: Request,
  context: InvitationRouteContext,
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  if (currentUser.status !== "active") {
    return Response.json(
      {
        error:
          "Verify your email before inviting members.",
      },
      { status: 403 },
    );
  }

  const { slug } = await context.params;

  const [membership] = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(
      workspaces,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(
      and(
        eq(workspaces.slug, slug),
        eq(workspaceMembers.userId, currentUser.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json(
      { error: "Workspace not found." },
      { status: 404 },
    );
  }

  if (
    membership.role !== "owner" &&
    membership.role !== "admin"
  ) {
    return Response.json(
      {
        error:
          "You do not have permission to invite members.",
      },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request." },
      { status: 400 },
    );
  }

  const result = createInvitationSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      {
        error: "Enter valid invitation details.",
        fields: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { email, role } = result.data;

  const [existingMember] = await db
    .select({
      id: workspaceMembers.id,
    })
    .from(workspaceMembers)
    .innerJoin(
      users,
      eq(workspaceMembers.userId, users.id),
    )
    .where(
      and(
        eq(
          workspaceMembers.workspaceId,
          membership.workspaceId,
        ),
        eq(users.email, email),
      ),
    )
    .limit(1);

  if (existingMember) {
    return Response.json(
      {
        error:
          "This person is already a workspace member.",
      },
      { status: 409 },
    );
  }

  const [existingInvitation] = await db
    .select({
      id: workspaceInvitations.id,
    })
    .from(workspaceInvitations)
    .where(
      and(
        eq(
          workspaceInvitations.workspaceId,
          membership.workspaceId,
        ),
        eq(workspaceInvitations.email, email),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.revokedAt),
        gt(
          workspaceInvitations.expiresAt,
          new Date(),
        ),
      ),
    )
    .limit(1);

  if (existingInvitation) {
    return Response.json(
      {
        error:
          "A valid invitation has already been sent to this email.",
      },
      { status: 409 },
    );
  }

  const {
    token,
    tokenHash,
    expiresAt,
  } = createInvitationToken();

  const [invitation] = await db
    .insert(workspaceInvitations)
    .values({
      workspaceId: membership.workspaceId,
      email,
      role,
      tokenHash,
      invitedByUserId: currentUser.id,
      expiresAt,
    })
    .returning({
      id: workspaceInvitations.id,
    });

  try {
    await sendWorkspaceInvitationEmail({
      email,
      token,
      workspaceName: membership.workspaceName,
      inviterName: currentUser.name,
    });
  } catch (error) {
    await db
      .delete(workspaceInvitations)
      .where(
        eq(
          workspaceInvitations.id,
          invitation.id,
        ),
      );

    console.error(
      "Workspace invitation delivery failed",
      error,
    );

    return Response.json(
      {
        error:
          "The invitation email could not be sent.",
      },
      { status: 502 },
    );
  }

  return Response.json(
    {
      message: "Invitation sent successfully.",
    },
    { status: 201 },
  );
}