import nodemailer from "nodemailer";

type SendEmailOptions = {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
};

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (transporter) {
    return transporter;
  }

  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!user || !password) {
    throw new Error("Gmail SMTP environment variables are not configured.");
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE || "true") === "true",
    auth: {
      user,
      pass: password,
    },
  });

  return transporter;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
}: SendEmailOptions) {
  const user = process.env.SMTP_USER;
  const configuredFrom = process.env.SMTP_FROM?.trim();
  const from = configuredFrom
    ? configuredFrom.includes("<") ? configuredFrom : `TeamFlow <${configuredFrom}>`
    : `TeamFlow <${user}>`;

  if (!user) {
    throw new Error("Gmail SMTP environment variables are not configured.");
  }

  await getTransporter().sendMail({
    from,
    envelope: {
      from: user,
      to,
    },
    to,
    replyTo: replyTo || user,
    subject,
    text,
    html,
    headers: {
      "Auto-Submitted": "auto-generated",
      "X-Auto-Response-Suppress": "All",
    },
  });
}

export function emailAppUrl() {
  const networkUrl = process.env.TEST_LAN_URL;
  const appUrl = process.env.APP_URL;

  if (process.env.LOCAL_NETWORK_TESTING === "true" && networkUrl) {
    return networkUrl;
  }

  if (!appUrl) {
    throw new Error("APP_URL is not configured.");
  }

  return appUrl;
}
