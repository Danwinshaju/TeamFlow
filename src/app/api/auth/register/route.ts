import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { sendVerificationEmail } from "@/lib/email/send-verification-email";
import { createEmailVerificationToken } from "@/lib/security/auth-token";
import { hashPassword } from "@/lib/security/password";
import { registerSchema } from "@/lib/validations/auth";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 10_000;

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const contentLength = Number(
    request.headers.get("content-length") ?? 0,
  );

  if (!contentType.includes("application/json")) {
    return Response.json(
      { error: "Content-Type must be application/json." },
      { status: 415 },
    );
  }

  if (contentLength > MAX_BODY_BYTES) {
    return Response.json(
      { error: "Request is too large." },
      { status: 413 },
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON request." },
      { status: 400 },
    );
  }

  const result = registerSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      {
        error: "Please correct the registration details.",
        fields: result.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { name, email, password } = result.data;

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUsers.length > 0) {
    return Response.json(
      { error: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(password);

  let user: {
    id: string;
    name: string;
    email: string;
    status:
      | "pending_verification"
      | "active"
      | "suspended";
  };

  try {
    [user] = await db
      .insert(users)
      .values({
        name,
        email,
        passwordHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
      });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return Response.json(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    console.error("Registration database operation failed", error);

    return Response.json(
      { error: "Unable to create the account right now." },
      { status: 500 },
    );
  }

  let verificationEmailSent = true;

  try {
    const verificationToken =
      await createEmailVerificationToken(user.id);

    await sendVerificationEmail({
      email: user.email,
      token: verificationToken,
    });
  } catch (error) {
    verificationEmailSent = false;
    console.error("Verification email delivery failed", error);
  }

  return Response.json(
    {
      user,
      verificationEmailSent,
      message: verificationEmailSent
        ? "Account created. Check your email to verify it."
        : "Account created, but the verification email could not be sent.",
    },
    { status: 201 },
  );
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}