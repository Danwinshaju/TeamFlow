import { emailAppUrl, sendEmail } from "@/lib/email/mailer";

type SendVerificationEmailOptions = {
  email: string;
  token: string;
};

export async function sendVerificationEmail({
  email,
  token,
}: SendVerificationEmailOptions) {
  const appUrl = emailAppUrl();

  const verificationUrl = new URL("/verify-email", appUrl);

  verificationUrl.searchParams.set("token", token);
  verificationUrl.searchParams.set("email", email);

  await sendEmail({
      to: email,
      subject: "Welcome to TeamFlow — verify your email",
      text: [
        "Welcome to TeamFlow.",
        "",
        `Your one-time verification code is: ${token}`,
        "",
        "Verify your email address using this link:",
        verificationUrl.toString(),
        "",
        "This OTP expires in 10 minutes.",
        "If you did not create this account, ignore this email.",
      ].join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; color: #111827;">
          <h1>Welcome to TeamFlow</h1>
          <p>Your account has been created successfully.</p>
          <p>Confirm your email address to activate your account.</p>
          <p>Your one-time verification code is:</p>
          <p style="font-size:24px;font-weight:700;letter-spacing:4px;">${token}</p>
          <p>
            <a
              href="${verificationUrl.toString()}"
              style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;"
            >
              Verify email
            </a>
          </p>
          <p>This OTP expires in 10 minutes and can be used only once.</p>
          <p>If you did not create this account, ignore this email.</p>
        </div>
      `,
    
  });
}
