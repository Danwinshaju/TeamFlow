import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { status?: unknown } | null;
  if (body?.status !== "active" && body?.status !== "offline") {
    return Response.json({ error: "Choose Active or Offline." }, { status: 400 });
  }
  await db.update(users).set({ availabilityStatus: body.status, updatedAt: new Date() }).where(eq(users.id, user.id));
  return Response.json({ status: body.status });
}
