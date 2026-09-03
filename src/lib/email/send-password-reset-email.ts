import { createHash } from "node:crypto";

type SendPasswordResetEmailOptions = {
  email: string;
  token: string;
};

export async function sendPasswordResetEmail({
  email,
  token,
}: SendPasswordResetEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  const appUrl = process.env.APP_URL;

  if (!apiKey || !from || !appUrl) {
    throw new Error("Email environment variables are not configured.");
  }

  const resetUrl = new URL("/reset-password", appUrl);
  resetUrl.searchParams.set("token", token);

  const idempotencyKey = createHash("sha256")
    .update(token)
    .digest("hex");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `password-reset-${idempotencyKey}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your TeamFlow password",
      text: `Reset your TeamFlow password: ${resetUrl.toString()}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;color:#111827"><h1>Reset your TeamFlow password</h1><p>Use the button below to choose a new password.</p><p><a href="${resetUrl.toString()}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Reset password</a></p><p>This link expires in 30 minutes.</p><p>If you did not request this, ignore this email.</p></div>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the email with status ${response.status}.`);
  }
}
