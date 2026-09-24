import { SignJWT, jwtVerify } from "jose";

export const ACCESS_COOKIE = "teamflow_access";
export const REFRESH_COOKIE = "teamflow_refresh";
export const ACCESS_SECONDS = 15 * 60;
export const REFRESH_SECONDS = 30 * 24 * 60 * 60;
const issuer = "teamflow";
const audience = "teamflow-web";

function signingKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 random characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(userId: string, sessionId: string) {
  return new SignJWT({ sid: sessionId, type: "access" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId).setIssuer(issuer).setAudience(audience)
    .setIssuedAt().setExpirationTime(`${ACCESS_SECONDS}s`).sign(signingKey());
}

export async function verifyAccessToken(token: string) {
  const key = signingKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"], issuer, audience,
      requiredClaims: ["sub", "sid", "exp", "iat"],
    });
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (payload.type !== "access" || !payload.sub || !uuid.test(payload.sub) ||
        typeof payload.sid !== "string" || !uuid.test(payload.sid)) return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch { return null; }
}

export const authCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const, path: "/", priority: "high" as const,
};
