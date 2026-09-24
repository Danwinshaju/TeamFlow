import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { createEmailVerificationToken, EmailRateLimitError } from "@/lib/security/auth-token";
import { getCurrentUser } from "@/lib/security/session";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let user = await getCurrentUser();

  if (!user && request.headers.get("content-type")?.includes("application/json")) {
    const body = await request.json().catch(() => null) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (email) {
      [user] = await db.select({ id: users.id, email: users.email, status: users.status, name: users.name, avatarDataUrl: users.avatarDataUrl, availabilityStatus: users.availabilityStatus }).from(users).where(eq(users.email, email)).limit(1);
    }
  }

  if (!user) {
    return Response.json({ message: "If this account is waiting for verification, a new OTP has been sent." });
  }

  if (user.status !== "pending_verification") {
    return Response.json({ message: "This email is already verified. You can sign in." });
  }

  try {
    const token = await createEmailVerificationToken(user.id);

    await sendVerificationEmail({
      email: user.email,
      token,
    });

    if (request.headers.get("content-type")?.includes("application/json")) {
      return Response.json({
        message: "A new 6-digit OTP was sent. It is valid for 10 minutes; the previous OTP is no longer valid.",
        expiresInSeconds: 600,
      });
    }
    return Response.redirect(new URL("/dashboard?verification=sent", request.url), 303);
  } catch (error) {
    if (error instanceof EmailRateLimitError) {
      if (request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: error.message }, { status: 429 });
      return Response.redirect(new URL("/dashboard?verification=limited", request.url), 303);
    }
    console.error("Unable to resend verification email", error);

    if (request.headers.get("content-type")?.includes("application/json")) return Response.json({ error: "The OTP email could not be sent. Check the SMTP configuration and try again." }, { status: 503 });
    return Response.redirect(new URL("/dashboard?verification=failed", request.url), 303);
  }
}
