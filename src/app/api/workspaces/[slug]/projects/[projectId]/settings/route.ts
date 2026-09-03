import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { projects, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { updateProjectSchema } from "@/lib/validations/project";

export const runtime = "nodejs";

type ProjectSettingsContext = { params: Promise<{ slug: string; projectId: string }> };

export async function PATCH(request: Request, context: ProjectSettingsContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { slug, projectId } = await context.params;
  const [access] = await db
    .select({ projectId: projects.id, role: workspaceMembers.role })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, currentUser.id)))
    .where(and(eq(projects.id, projectId), eq(workspaces.slug, slug)))
    .limit(1);

  if (!access) return Response.json({ error: "Project not found." }, { status: 404 });
  if (access.role !== "owner" && access.role !== "admin") return Response.json({ error: "You do not have permission to change project settings." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const result = updateProjectSchema.safeParse(body);
  if (!result.success) return Response.json({ error: "Enter valid project settings." }, { status: 400 });

  const [project] = await db.update(projects).set({ name: result.data.name, description: result.data.description || null, status: result.data.status, updatedAt: new Date() }).where(eq(projects.id, access.projectId)).returning({ id: projects.id, name: projects.name, description: projects.description, status: projects.status });
  return Response.json({ project });
}
