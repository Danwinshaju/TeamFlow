import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { createSession } from "@/lib/security/session";
import { verifyPassword } from "@/lib/security/password";
import { loginSchema } from "@/lib/validations/auth";
import { getUserAccessDestination } from "@/lib/billing/access";
import { sendLoginSuccessEmail } from "@/lib/email/send-account-notification-email";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 5_000;

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

  const result = loginSchema.safeParse(body);

  if (!result.success) {
    return Response.json(
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  const { email, password } = result.data;

  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      status: users.status,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    return Response.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  const passwordIsValid = await verifyPassword(
    password,
    user.passwordHash,
  );

  if (!passwordIsValid) {
    return Response.json(
      { error: "Invalid email or password." },
      { status: 401 },
    );
  }

  if (user.status === "suspended") {
    return Response.json(
      { error: "This account is currently unavailable." },
      { status: 403 },
    );
  }

  if (user.status !== "active") {
    return Response.json(
      { error: "Your email is not verified yet. Enter the OTP or request a new one.", verificationRequired: true, email: user.email },
      { status: 403 },
    );
  }

  if (!(await createSession(user.id, user.passwordHash))) {
    return Response.json({ error: "Your account changed. Please sign in again." }, { status: 401 });
  }

  try {
    await sendLoginSuccessEmail({ email: user.email, name: user.name });
  } catch (error) {
    console.error("Login notification email delivery failed", error);
  }

  const next = await getUserAccessDestination(user.id);

  return Response.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
    },
    next,
  });
}
