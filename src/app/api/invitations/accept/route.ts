import {
  and,
  eq,
  gt,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  workspaceInvitations,
  workspaces,
} from "@/db/schema";
import {
  hashInvitationToken,
  isValidInvitationToken,
} from "@/lib/security/invitation-token";
import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json(
      { error: "Sign in before accepting this invitation." },
      { status: 401 },
    );
  }

  if (currentUser.status !== "active" && !(process.env.NODE_ENV !== "production" && process.env.LOCAL_NETWORK_TESTING === "true")) {
    return Response.json(
      {
        error:
          "Verify your email before accepting an invitation.",
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

  const token =
    typeof body === "object" &&
    body !== null &&
    "token" in body &&
    typeof body.token === "string"
      ? body.token
      : null;

  const invitationId =
    typeof body === "object" && body !== null && "invitationId" in body && typeof body.invitationId === "string"
      ? body.invitationId
      : null;

  const validToken = token && isValidInvitationToken(token);
  const validInvitationId = invitationId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(invitationId);
  if (!validToken && !validInvitationId) {
    return Response.json(
      {
        error:
          "This invitation link is invalid or incomplete.",
      },
      { status: 400 },
    );
  }

  const tokenHash = validToken ? hashInvitationToken(token) : null;
  const now = new Date();

  const result = await db.transaction(
    async (transaction) => {
      const [invitation] = await transaction
        .select({
          id: workspaceInvitations.id,
          workspaceId:
            workspaceInvitations.workspaceId,
          email: workspaceInvitations.email,
          role: workspaceInvitations.role,
          requestedAt: workspaceInvitations.requestedAt,
          workspaceSlug: workspaces.slug,
        })
        .from(workspaceInvitations)
        .innerJoin(
          workspaces,
          eq(
            workspaceInvitations.workspaceId,
            workspaces.id,
          ),
        )
        .where(
          and(
            tokenHash
              ? eq(workspaceInvitations.tokenHash, tokenHash)
              : eq(workspaceInvitations.id, invitationId as string),
            isNull(
              workspaceInvitations.acceptedAt,
            ),
            isNull(
              workspaceInvitations.revokedAt,
            ),
            gt(
              workspaceInvitations.expiresAt,
              now,
            ),
          ),
        )
        .limit(1);

      if (!invitation) {
        return {
          error:
            "This invitation is invalid, expired, or already used.",
          status: 400,
        } as const;
      }

      if (invitation.email.toLowerCase() !== currentUser.email.toLowerCase()) {
        return {
          error:
            `This invitation was sent to ${invitation.email}. Sign out and use that exact email address.`,
          status: 403,
        } as const;
      }

      const [requestedInvitation] =
        await transaction
          .update(workspaceInvitations)
          .set({ requestedAt: now })
          .where(
            and(
              eq(
                workspaceInvitations.id,
                invitation.id,
              ),
              isNull(
                workspaceInvitations.acceptedAt,
              ),
              isNull(
                workspaceInvitations.revokedAt,
              ),
              gt(
                workspaceInvitations.expiresAt,
                now,
              ),
            ),
          )
          .returning({ id: workspaceInvitations.id });

      if (!requestedInvitation) {
        return {
          error:
            "This invitation is no longer available.",
          status: 409,
        } as const;
      }

      return {
        workspaceSlug: invitation.workspaceSlug,
        pendingApproval: true,
      } as const;
    },
  );

  if ("error" in result) {
    return Response.json(
      { error: result.error },
      { status: result.status },
    );
  }

  return Response.json({
    message: "Join request sent to the workspace Owner.",
    workspaceSlug: result.workspaceSlug,
    pendingApproval: result.pendingApproval,
  });
}

export async function GET(request: Request) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Authentication required." }, { status: 401 });
  const invitationId = new URL(request.url).searchParams.get("invitationId");
  if (!invitationId) return Response.json({ error: "Invitation ID is required." }, { status: 400 });
  const [invitation] = await db.select({
    acceptedAt: workspaceInvitations.acceptedAt,
    revokedAt: workspaceInvitations.revokedAt,
    requestedAt: workspaceInvitations.requestedAt,
    workspaceSlug: workspaces.slug,
  }).from(workspaceInvitations).innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id)).where(and(
    eq(workspaceInvitations.id, invitationId),
    eq(workspaceInvitations.email, currentUser.email),
  )).limit(1);
  if (!invitation) return Response.json({ error: "Invitation not found." }, { status: 404 });
  const status = invitation.acceptedAt ? "approved" : invitation.revokedAt ? "rejected" : invitation.requestedAt ? "waiting" : "invited";
  return Response.json({ status, workspaceSlug: invitation.workspaceSlug });
}
