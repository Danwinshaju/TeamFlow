import { emailAppUrl, sendEmail } from "@/lib/email/mailer";

type SendWorkspaceInvitationEmailOptions = {
  email: string;
  token: string;
  workspaceName: string;
  inviterName: string;
};

export async function sendWorkspaceInvitationEmail({
  email,
  token,
  workspaceName,
  inviterName,
}: SendWorkspaceInvitationEmailOptions) {
  const appUrl = emailAppUrl();

  const invitationUrl = new URL(
    "/accept-invitation",
    appUrl,
  );

  invitationUrl.searchParams.set("token", token);

  const safeWorkspaceName = escapeHtml(workspaceName);
  const safeInviterName = escapeHtml(inviterName);

  await sendEmail({
    to: email,
    subject: `Join ${workspaceName} on TeamFlow`,
    text: [
          `${inviterName} invited you to join ${workspaceName} on TeamFlow.`,
          "",
          "Accept the invitation using this link:",
          invitationUrl.toString(),
          "",
          "This invitation expires in 7 days.",
    ].join("\n"),
    html: `
          <div style="font-family: Arial, sans-serif; color: #111827;">
            <h1>Join ${safeWorkspaceName}</h1>

            <p>
              ${safeInviterName} invited you to join
              ${safeWorkspaceName} on TeamFlow.
            </p>

            <p>
              <a
                href="${invitationUrl.toString()}"
                style="display:inline-block;padding:12px 20px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;"
              >
                Accept invitation
              </a>
            </p>

            <p>This invitation expires in 7 days.</p>
          </div>
        `,
  });
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
}
