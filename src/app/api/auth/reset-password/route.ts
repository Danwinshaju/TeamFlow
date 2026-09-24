import { clearAuthCookies } from "@/lib/security/session";
import { consumePasswordResetToken } from "@/lib/security/auth-token";
import { hashPassword } from "@/lib/security/password";
import { resetPasswordSchema } from "@/lib/validations/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = resetPasswordSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: "Please correct the password details." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(result.data.password);
  const userId = await consumePasswordResetToken(
    result.data.token,
    passwordHash,
  );

  if (!userId) {
    return Response.json(
      { error: "This password reset link is invalid or has expired." },
      { status: 400 },
    );
  }

  await clearAuthCookies();

  return Response.json({
    message: "Password updated. You can now sign in.",
  });
}
