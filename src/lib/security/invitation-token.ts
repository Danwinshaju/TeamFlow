import {
  createHash,
  randomBytes,
} from "node:crypto";

const INVITATION_DURATION_DAYS = 7;

export function hashInvitationToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

export function createInvitationToken() {
  const token = randomBytes(32).toString("base64url");

  const expiresAt = new Date();

  expiresAt.setDate(
    expiresAt.getDate() + INVITATION_DURATION_DAYS,
  );

  return {
    token,
    tokenHash: hashInvitationToken(token),
    expiresAt,
  };
}

export function isValidInvitationToken(token: string) {
  return /^[A-Za-z0-9_-]{40,100}$/.test(token);
}
