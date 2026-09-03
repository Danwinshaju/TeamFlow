import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { updateWorkspaceSchema } from "@/lib/validations/workspace";

export const runtime = "nodejs";

type WorkspaceSettingsContext = { params: Promise<{ slug: string }> };

export async function PATCH(request: Request, context: WorkspaceSettingsContext) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "Authentication required." }, { status: 401 });

  const { slug } = await context.params;
  const [access] = await db
    .select({ workspaceId: workspaces.id, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, currentUser.id)))
    .limit(1);

  if (!access) return Response.json({ error: "Workspace not found." }, { status: 404 });
  if (access.role !== "owner") return Response.json({ error: "Only the workspace owner can change settings." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const result = updateWorkspaceSchema.safeParse(body);
  if (!result.success) return Response.json({ error: "Enter a valid workspace name." }, { status: 400 });

  const [workspace] = await db
    .update(workspaces)
    .set({ name: result.data.name, updatedAt: new Date() })
    .where(eq(workspaces.id, access.workspaceId))
    .returning({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug });

  return Response.json({ workspace });
}
