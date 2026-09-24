import { NextRequest, NextResponse } from "next/server";
import { ACCESS_COOKIE, REFRESH_COOKIE, verifyAccessToken } from "@/lib/security/jwt";
import { hasPaidWorkspaceAccess } from "@/lib/billing/access";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // Browser cookie mutations require same-origin requests. Signed provider webhooks are exempt.
  if (path.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      path !== "/api/billing/stripe/webhook") {
    const origin = request.headers.get("origin");
    const allowedOrigins = new Set([request.nextUrl.origin]);
    if (process.env.APP_URL) allowedOrigins.add(new URL(process.env.APP_URL).origin);
    if (process.env.LOCAL_NETWORK_TESTING === "true" && process.env.TEST_LAN_URL) {
      allowedOrigins.add(new URL(process.env.TEST_LAN_URL).origin);
    }
    if (!origin || !allowedOrigins.has(origin) || request.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
  }

  const protectedPage = path === "/dashboard" || path === "/my-tasks" || path.startsWith("/workspaces/");
  if (protectedPage && request.cookies.has(REFRESH_COOKIE)) {
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    if (!token || !(await verifyAccessToken(token))) {
      const url = new URL("/session/refresh", request.url);
      url.searchParams.set("next", path + request.nextUrl.search);
      return NextResponse.redirect(url);
    }
  }
  const workspaceApi = path.match(/^\/api\/workspaces\/([^/]+)\/(?!billing(?:\/|$))(.+)/);
  if (workspaceApi) {
    const token = request.cookies.get(ACCESS_COOKIE)?.value;
    const identity = token ? await verifyAccessToken(token) : null;
    if (identity && !(await hasPaidWorkspaceAccess(identity.userId, decodeURIComponent(workspaceApi[1])))) {
      return NextResponse.json({ error: "An active TeamFlow Pro subscription is required." }, { status: 402 });
    }
  }
  const response = NextResponse.next();
  if (path.startsWith("/api/auth/") || protectedPage) response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/api/:path*", "/dashboard", "/my-tasks", "/workspaces/:path*"] };
