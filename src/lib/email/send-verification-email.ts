import { createHash } from "node:crypto";

type SendVerificationEmailOptions = {
  email: string;
  token: string;
};

export async function sendVerificationEmail({
  email,
  token,
}: SendVerificationEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.APP_URL;

  if (!apiKey || !from || !appUrl) {
    throw new Error(
      "Email environment variables are not configured.",
    );
  }

  const verificationUrl = new URL("/verify-email", appUrl);

  verificationUrl.searchParams.set("token", token);

  const idempotencyKey = createHash("sha256")
    .update(token)
    .digest("hex");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `verify-${idempotencyKey}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Verify your TeamFlow email",
      text: [
        "Welcome to TeamFlow.",
        "",
        "Verify your email address using this link:",
        verificationUrl.toString(),
        "",
        "This link expires in 24 hours.",
        "If you did not create this account, ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827;">
          <h1>Verify your TeamFlow email</h1>
          <p>Welcome to TeamFlow.</p>
          <p>Confirm your email address to activate your account.</p>
          <p>
            <a
              href="${verificationUrl.toString()}"
              style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;"
            >
              Verify email
            </a>
          </p>
          <p>This link expires in 24 hours.</p>
          <p>If you did not create this account, ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Resend rejected the email with status ${response.status}.`,
    );
  }
}