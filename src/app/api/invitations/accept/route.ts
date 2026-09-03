import {
  and,
  eq,
  gt,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import {
  workspaceInvitations,
  workspaceMembers,
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

  if (currentUser.status !== "active") {
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

  if (!token || !isValidInvitationToken(token)) {
    return Response.json(
      {
        error:
          "This invitation link is invalid or incomplete.",
      },
      { status: 400 },
    );
  }

  const tokenHash = hashInvitationToken(token);
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
            eq(
              workspaceInvitations.tokenHash,
              tokenHash,
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
        .limit(1);

      if (!invitation) {
        return {
          error:
            "This invitation is invalid, expired, or already used.",
          status: 400,
        } as const;
      }

      if (invitation.email !== currentUser.email) {
        return {
          error:
            "Sign in using the email address that received this invitation.",
          status: 403,
        } as const;
      }

      const [claimedInvitation] =
        await transaction
          .update(workspaceInvitations)
          .set({
            acceptedAt: now,
          })
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
          .returning({
            id: workspaceInvitations.id,
          });

      if (!claimedInvitation) {
        return {
          error:
            "This invitation has already been used.",
          status: 409,
        } as const;
      }

      await transaction
        .insert(workspaceMembers)
        .values({
          workspaceId: invitation.workspaceId,
          userId: currentUser.id,
          role: invitation.role,
        })
        .onConflictDoNothing();

      return {
        workspaceSlug:
          invitation.workspaceSlug,
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
    message: "Invitation accepted.",
    workspaceSlug: result.workspaceSlug,
  });
}
