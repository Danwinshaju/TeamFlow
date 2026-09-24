import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userAccessRequests, users, workspaceSubscriptions, workspaces } from "@/db/schema";
import { stripeClient } from "@/lib/billing/stripe";
import { verifyPassword } from "@/lib/security/password";
import { clearAuthCookies, getCurrentUser } from "@/lib/security/session";
import { profileSchema } from "@/lib/validations/auth";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  const result = profileSchema.safeParse(await request.json().catch(() => null));
  if (!result.success) return Response.json({ error: "Please correct your profile details.", fields: result.error.flatten().fieldErrors }, { status: 400 });
  const data = result.data;
  const [profile] = await db.update(users).set({ name: data.name, phone: data.phone || null, jobTitle: data.jobTitle || null, bio: data.bio || null, avatarDataUrl: data.avatarDataUrl || null, updatedAt: new Date() }).where(eq(users.id, user.id)).returning({ name: users.name, phone: users.phone, jobTitle: users.jobTitle, bio: users.bio, avatarDataUrl: users.avatarDataUrl });
  return Response.json({ profile });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as { password?: unknown; confirmation?: unknown } | null;
  if (body?.confirmation !== "DELETE" || typeof body.password !== "string" || !body.password) {
    return Response.json({ error: "Enter your password and type DELETE to confirm." }, { status: 400 });
  }

  const [account] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!account || !(await verifyPassword(body.password, account.passwordHash))) {
    return Response.json({ error: "Your current password is incorrect." }, { status: 403 });
  }

  const subscriptions = await db.select({ id: workspaceSubscriptions.stripeSubscriptionId })
    .from(workspaceSubscriptions)
    .innerJoin(workspaces, eq(workspaceSubscriptions.workspaceId, workspaces.id))
    .where(eq(workspaces.ownerId, user.id));
  const [personalSubscription] = await db.select({ id: userAccessRequests.stripeSubscriptionId })
    .from(userAccessRequests).where(eq(userAccessRequests.userId, user.id)).limit(1);
  const stripeIds = [...new Set([...subscriptions.map((item) => item.id), personalSubscription?.id].filter((id): id is string => Boolean(id)))];

  try {
    if (stripeIds.length > 0) {
      const stripe = stripeClient();
      for (const id of stripeIds) {
        try {
          await stripe.subscriptions.cancel(id);
        } catch (error) {
          const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
          if (code !== "resource_missing") throw error;
        }
      }
    }
  } catch {
    return Response.json({ error: "We could not cancel your active subscription. Your account was not deleted. Please try again." }, { status: 502 });
  }

  await db.delete(users).where(eq(users.id, user.id));
  await clearAuthCookies();
  return Response.json({ deleted: true });
}
