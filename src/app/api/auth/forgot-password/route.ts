import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset-email";
import { createPasswordResetToken } from "@/lib/security/auth-token";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export const runtime = "nodejs";

const SAFE_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = forgotPasswordSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, result.data.email))
    .limit(1);

  if (user) {
    try {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail({ email: user.email, token });
    } catch (error) {
      console.error("Password reset email delivery failed", error);
    }
  }

  return Response.json({ message: SAFE_MESSAGE });
}
