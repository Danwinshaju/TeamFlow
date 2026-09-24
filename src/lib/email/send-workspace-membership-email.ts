import { sendEmail } from "@/lib/email/mailer";

type MembershipEmailOptions = {
  email: string;
  name: string;
  workspaceName: string;
  action: "removed" | "left";
};

export async function sendWorkspaceMembershipEmail({ email, name, workspaceName, action }: MembershipEmailOptions) {
  const safeName = escapeHtml(name);
  const safeWorkspace = escapeHtml(workspaceName);
  const removed = action === "removed";
  const subject = removed ? `Your access to ${workspaceName} was removed` : `You left ${workspaceName}`;
  const message = removed
    ? `Your membership in ${workspaceName} has been removed by the workspace Owner.`
    : `You have successfully left ${workspaceName}.`;

  await sendEmail({
    to: email,
    subject,
    text: `Hello ${name},\n\n${message}\n\nYour TeamFlow account and access to any other workspaces are unchanged.`,
    html: `<div style="font-family:Arial,sans-serif;color:#111827"><h1>${removed ? "Workspace access removed" : "You left a workspace"}</h1><p>Hello ${safeName},</p><p>${removed ? `Your membership in <strong>${safeWorkspace}</strong> has been removed by the workspace Owner.` : `You have successfully left <strong>${safeWorkspace}</strong>.`}</p><p>Your TeamFlow account and access to any other workspaces are unchanged.</p></div>`,
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}
