import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { workspaceMembers, workspaceMessages, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; messageId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const { slug, messageId } = await params;

  const [message] = await db.select({ id: workspaceMessages.id, senderId: workspaceMessages.userId })
    .from(workspaceMessages)
    .innerJoin(workspaces, eq(workspaceMessages.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, user.id)))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMessages.id, messageId)))
    .limit(1);
  if (!message) return Response.json({ error: "Message not found." }, { status: 404 });
  if (message.senderId !== user.id) return Response.json({ error: "You can delete only messages that you sent." }, { status: 403 });

  const deletedAt = new Date();
  await db.update(workspaceMessages).set({ body: "", attachmentType: null, attachmentName: null, attachmentMimeType: null, attachmentDataUrl: null, deletedAt })
    .where(eq(workspaceMessages.id, message.id));
  return Response.json({ id: message.id, deletedAt: deletedAt.toISOString() });
}
