import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { createEmailVerificationToken } from "@/lib/security/auth-token";
import { getCurrentUser } from "@/lib/security/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.redirect(
      new URL("/login", request.url),
      303,
    );
  }

  if (user.status !== "pending_verification") {
    return Response.redirect(
      new URL("/dashboard", request.url),
      303,
    );
  }

  try {
    const token = await createEmailVerificationToken(user.id);

    await sendVerificationEmail({
      email: user.email,
      token,
    });

    return Response.redirect(
      new URL("/dashboard?verification=sent", request.url),
      303,
    );
  } catch (error) {
    console.error("Unable to resend verification email", error);

    return Response.redirect(
      new URL("/dashboard?verification=failed", request.url),
      303,
    );
  }
}