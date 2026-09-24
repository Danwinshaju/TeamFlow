import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { ACCESS_COOKIE, REFRESH_COOKIE, ACCESS_SECONDS, REFRESH_SECONDS,
  authCookieOptions, signAccessToken, verifyAccessToken } from "./jwt";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const newRefresh = () => randomBytes(32).toString("base64url");

async function setTokens(access: string, refresh: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, access, { ...authCookieOptions, maxAge: ACCESS_SECONDS });
  jar.set(REFRESH_COOKIE, refresh, { ...authCookieOptions, expires: expiresAt });
  jar.delete("teamflow_session");
}

// Reuse the sessions table to hold only the current refresh-token hash.
export async function createSession(userId: string, verifiedPasswordHash: string) {
  const id = randomUUID();
  const refresh = newRefresh();
  const expiresAt = new Date(Date.now() + REFRESH_SECONDS * 1000);
  const access = await signAccessToken(userId, id);
  const created = await db.transaction(async (tx) => {
    // Serialize login against password reset; a stale password cannot mint a new session.
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || user.status === "suspended" || user.passwordHash !== verifiedPasswordHash) return false;
    await tx.insert(sessions).values({ id, userId, tokenHash: hash(refresh), expiresAt });
    return true;
  });
  if (!created) return false;
  await setTokens(access, refresh, expiresAt);
  return true;
}

export async function getCurrentUser() {
  const token = (await cookies()).get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  const identity = await verifyAccessToken(token);
  if (!identity) return null;
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email, status: users.status, avatarDataUrl: users.avatarDataUrl, availabilityStatus: users.availabilityStatus })
    .from(sessions).innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, identity.sessionId), eq(users.id, identity.userId), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return user && user.status !== "suspended" ? user : null;
}

export async function rotateRefreshToken() {
  const token = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const tokenHash = hash(token);
  const [session] = await db.select().from(sessions).where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date()))).limit(1);
  if (!session) return false;
  const refresh = newRefresh();
  const access = await signAccessToken(session.userId, session.id);
  const rotated = await db.transaction(async (tx) => {
    const [user] = await tx.select({ status: users.status }).from(users).where(eq(users.id, session.userId)).for("update");
    if (!user || user.status === "suspended") return false;
    // Compare-and-swap: only one request can consume this refresh token.
    const changed = await tx.update(sessions).set({ tokenHash: hash(refresh), lastSeenAt: new Date() })
      .where(and(eq(sessions.id, session.id), eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
      .returning({ id: sessions.id });
    return changed.length === 1;
  });
  if (!rotated) return false;
  await setTokens(access, refresh, session.expiresAt);
  return true;
}

export async function clearAuthCookies() {
  const jar = await cookies();
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, "teamflow_session"]) {
    jar.set(name, "", { ...authCookieOptions, maxAge: 0 });
  }
}

export async function deleteCurrentSession() {
  const jar = await cookies();
  const access = jar.get(ACCESS_COOKIE)?.value;
  const identity = access ? await verifyAccessToken(access) : null;
  if (identity) {
    await db.delete(sessions).where(and(eq(sessions.id, identity.sessionId), eq(sessions.userId, identity.userId)));
  }
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (refresh) await db.delete(sessions).where(eq(sessions.tokenHash, hash(refresh)));
  await clearAuthCookies();
}
