import { rotateRefreshToken } from "@/lib/security/session";
import { ACCESS_SECONDS } from "@/lib/security/jwt";

export const runtime = "nodejs";

export async function POST() {
  const renewed = await rotateRefreshToken();
  // Do not clear cookies on failure: another tab may just have rotated them.
  return Response.json(renewed ? { refreshed: true, expiresIn: ACCESS_SECONDS } : { error: "Please sign in again." },
    { status: renewed ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
