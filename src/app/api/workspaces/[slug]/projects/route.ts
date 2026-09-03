import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { projects, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { createProjectSchema } from "@/lib/validations/project";

export const runtime = "nodejs";

type ProjectRouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(
  request: Request,
  context: ProjectRouteContext,
) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  if (currentUser.status !== "active") {
    return Response.json(
      { error: "Verify your email before creating projects." },
      { status: 403 },
    );
  }

  const { slug } = await context.params;
  const [membership] = await db
    .select({
      workspaceId: workspaces.id,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaces.slug, slug),
        eq(workspaceMembers.userId, currentUser.id),
      ),
    )
    .limit(1);

  if (!membership) {
    return Response.json({ error: "Workspace not found." }, { status: 404 });
  }

  if (membership.role !== "owner" && membership.role !== "admin") {
    return Response.json(
      { error: "You do not have permission to create projects." },
      { status: 403 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = createProjectSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      {
        error: "Enter valid project details.",
        fields: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: membership.workspaceId,
      name: result.data.name,
      key: createProjectKey(result.data.name),
      description: result.data.description || null,
      createdByUserId: currentUser.id,
    })
    .returning({
      id: projects.id,
      name: projects.name,
      key: projects.key,
      description: projects.description,
      status: projects.status,
    });

  return Response.json({ project }, { status: 201 });
}

function createProjectKey(name: string) {
  const prefix = name
    .replace(/[^A-Za-z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 4)
    .toUpperCase() || "PRJ";

  return `${prefix}-${randomBytes(2).toString("hex").toUpperCase()}`;
}
