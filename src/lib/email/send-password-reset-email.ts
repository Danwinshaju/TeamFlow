import { emailAppUrl, sendEmail } from "@/lib/email/mailer";

type SendPasswordResetEmailOptions = {
  email: string;
  token: string;
};

export async function sendPasswordResetEmail({
  email,
  token,
}: SendPasswordResetEmailOptions) {
  const appUrl = emailAppUrl();

  const resetUrl = new URL("/reset-password", appUrl);
  resetUrl.searchParams.set("token", token);

  await sendEmail({
      to: email,
      subject: "Reset your TeamFlow password",
      text: `Reset your TeamFlow password: ${resetUrl.toString()}\n\nThis link expires in 30 minutes. If you did not request this, ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;color:#111827"><h1>Reset your TeamFlow password</h1><p>Use the button below to choose a new password.</p><p><a href="${resetUrl.toString()}" style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Reset password</a></p><p>This link expires in 30 minutes.</p><p>If you did not request this, ignore this email.</p></div>`,
    
  });
}
