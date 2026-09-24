import { verifyEmailToken } from "@/lib/security/auth-token";
import { sendRegistrationSuccessEmail } from "@/lib/email/send-account-notification-email";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 2_000;

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

  if (
    typeof body !== "object" ||
    body === null ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    return Response.json(
      { error: "A verification token is required." },
      { status: 400 },
    );
  }

  const verifiedUser = await verifyEmailToken(body.token.trim());

  if (!verifiedUser) {
    return Response.json(
      {
        error:
          "This verification link is invalid, expired, or already used.",
      },
      { status: 400 },
    );
  }

  try {
    await sendRegistrationSuccessEmail({ email: verifiedUser.email, name: verifiedUser.name });
  } catch (error) {
    console.error("Registration confirmation email delivery failed", error);
  }

  return Response.json({
    message: "OTP verified. Your registration is complete and you can now sign in.",
  });
}
