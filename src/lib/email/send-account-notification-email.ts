import { sendEmail } from "@/lib/email/mailer";

type AccountEmailOptions = {
  email: string;
  name: string;
};

export async function sendRegistrationSuccessEmail({ email, name }: AccountEmailOptions) {
  await sendEmail({
    to: email,
    subject: "Your TeamFlow registration is complete",
    text: `Hello ${name},\n\nYour email was verified and your TeamFlow registration is complete. You can now sign in.\n\nIf you did not create this account, contact the TeamFlow owner.`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827"><h1>Registration complete</h1><p>Hello ${name},</p><p>Your email was verified and your TeamFlow registration is complete.</p><p>You can now sign in securely.</p><p>If you did not create this account, contact the TeamFlow owner.</p></div>`,
  });
}

export async function sendLoginSuccessEmail({ email, name }: AccountEmailOptions) {
  await sendEmail({
    to: email,
    subject: "New successful sign-in to TeamFlow",
    text: `Hello ${name},\n\nYour TeamFlow account was signed in successfully at ${new Date().toISOString()}.\n\nIf this was not you, reset your password immediately.`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827"><h1>Successful sign-in</h1><p>Hello ${name},</p><p>Your TeamFlow account was signed in successfully at <strong>${new Date().toISOString()}</strong>.</p><p>If this was not you, reset your password immediately.</p></div>`,
  });
}

export async function sendRefundSuccessEmail({ email, name, amount, currency }: AccountEmailOptions & { amount: number; currency: string }) {
  const formattedAmount = new Intl.NumberFormat("en-IN", { style: "currency", currency: currency.toUpperCase() }).format(amount / 100);
  await sendEmail({
    to: email,
    subject: "Your TeamFlow refund has been started",
    text: `Hello ${name},\n\nYour TeamFlow subscription has been cancelled and a refund of ${formattedAmount} has been started to the original payment method. Stripe and your bank determine when the funds become visible.\n\nFor your security, all TeamFlow sessions were signed out. If this was not you, reset your password immediately.`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827"><h1>Refund started</h1><p>Hello ${name},</p><p>Your TeamFlow subscription has been cancelled and a refund of <strong>${formattedAmount}</strong> has been started to the original payment method.</p><p>Stripe and your bank determine when the funds become visible.</p><p><strong>Security notice:</strong> all TeamFlow sessions were signed out. If this was not you, reset your password immediately.</p></div>`,
  });
}

export async function sendWorkspacePausedEmail({ email, name, workspaceName }: AccountEmailOptions & { workspaceName: string }) {
  await sendEmail({
    to: email,
    subject: `TeamFlow workspace paused: ${workspaceName}`,
    text: `Hello ${name},\n\n${workspaceName} is temporarily unavailable because its Owner's subscription ended. Messages, projects, and tasks are preserved safely and will be available again when the Owner renews.\n\nYou do not need to make a payment. Please contact the workspace Owner if you need access restored.`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827"><h1>Workspace temporarily paused</h1><p>Hello ${name},</p><p><strong>${workspaceName}</strong> is temporarily unavailable because its Owner's subscription ended.</p><p>Messages, projects, and tasks are preserved safely and will be available again when the Owner renews.</p><p>You do not need to make a payment. Please contact the workspace Owner if you need access restored.</p></div>`,
  });
}
