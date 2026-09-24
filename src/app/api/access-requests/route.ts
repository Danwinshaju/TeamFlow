import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { userAccessRequests, users, workspaceMembers, workspaces } from "@/db/schema";
import { isPlatformOwner } from "@/lib/billing/access";
import { getCurrentUser } from "@/lib/security/session";
export const runtime = "nodejs";
async function owner() { const user = await getCurrentUser(); return user && isPlatformOwner(user.email) ? user : null; }
export async function GET() {
  if (!(await owner())) return Response.json({ error: "Owner access required." }, { status: 403 });
  const [requests, spaces] = await Promise.all([
    db.select({ id: userAccessRequests.id, userId: users.id, name: users.name, email: users.email, createdAt: userAccessRequests.createdAt }).from(userAccessRequests).innerJoin(users, eq(users.id, userAccessRequests.userId)).where(eq(userAccessRequests.status, "pending_approval")),
    db.select({ id: workspaces.id, name: workspaces.name }).from(workspaces),
  ]);
  return Response.json({ requests, workspaces: spaces });
}
export async function POST(request: Request) {
  const reviewer = await owner(); if (!reviewer) return Response.json({ error: "Owner access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { requestId?: string; workspaceId?: string; role?: string } | null;
  if (!body?.requestId || !body.workspaceId || !["member", "admin"].includes(body.role || "")) return Response.json({ error: "Choose a workspace and Member or Admin role." }, { status: 400 });
  const [pending] = await db.select({ id: userAccessRequests.id, userId: userAccessRequests.userId }).from(userAccessRequests).where(and(eq(userAccessRequests.id, body.requestId), eq(userAccessRequests.status, "pending_approval"))).limit(1);
  if (!pending) return Response.json({ error: "This request is no longer pending." }, { status: 404 });
  const [space] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, body.workspaceId)).limit(1);
  if (!space) return Response.json({ error: "Workspace not found." }, { status: 404 });
  await db.transaction(async (tx) => {
    await tx.insert(workspaceMembers).values({ workspaceId: space.id, userId: pending.userId, role: body.role as "member" | "admin" }).onConflictDoUpdate({ target: [workspaceMembers.workspaceId, workspaceMembers.userId], set: { role: body.role as "member" | "admin" } });
    await tx.update(userAccessRequests).set({ status: "approved", workspaceId: space.id, approvedRole: body.role as "member" | "admin", reviewedByUserId: reviewer.id, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(userAccessRequests.id, pending.id));
  });
  return Response.json({ message: `${body.role === "member" ? "Member" : "Admin"} access granted without payment.` });
}
