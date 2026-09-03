import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
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
