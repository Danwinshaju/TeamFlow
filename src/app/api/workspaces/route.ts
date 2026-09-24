import { randomBytes } from "node:crypto";

import { db } from "@/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { userAccessRequests, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { createWorkspaceSchema } from "@/lib/validations/workspace";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  if (user.status !== "active") {
    return Response.json(
      { error: "Verify your email before creating a workspace." },
      { status: 403 },
    );
  }

  const [paidAccess] = await db.select({ id: userAccessRequests.id }).from(userAccessRequests).where(and(
    eq(userAccessRequests.userId, user.id),
    eq(userAccessRequests.status, "approved"),
    isNotNull(userAccessRequests.stripeSubscriptionId),
  )).limit(1);

  if (!paidAccess) {
    return Response.json(
      { error: "Complete the Owner subscription before creating your workspace." },
      { status: 402 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = createWorkspaceSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      {
        error: "Enter a valid workspace name.",
        fields: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const slug = createWorkspaceSlug(result.data.name);

  const workspace = await db.transaction(async (transaction) => {
    const [createdWorkspace] = await transaction
      .insert(workspaces)
      .values({
        name: result.data.name,
        slug,
        ownerId: user.id,
      })
      .returning({
        id: workspaces.id,
        name: workspaces.name,
        slug: workspaces.slug,
      });

    await transaction.insert(workspaceMembers).values({
      workspaceId: createdWorkspace.id,
      userId: user.id,
      role: "owner",
    });

    return createdWorkspace;
  });

  return Response.json({ workspace }, { status: 201 });
}

function createWorkspaceSlug(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "workspace";

  return `${base}-${randomBytes(4).toString("hex")}`;
}
