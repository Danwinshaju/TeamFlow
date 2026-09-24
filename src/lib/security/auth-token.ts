import { createHash, randomBytes, randomInt } from "node:crypto";
import {
  and,
  eq,
  gt,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import { authTokens, sessions, users } from "@/db/schema";

const EMAIL_OTP_DURATION_MINUTES = 10;
const PASSWORD_RESET_DURATION_MINUTES = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export class EmailRateLimitError extends Error {
  constructor() { super("Please wait before requesting another email. Limit: one per minute and five per hour."); }
}

async function createLimitedEmailToken(userId: string, type: "email_verification" | "password_reset", durationMs: number) {
  return db.transaction(async (transaction) => {
    // Serialize requests for this account, including across server processes.
    await transaction.select({ id: users.id }).from(users).where(eq(users.id, userId)).for("update");
    const now = new Date();
    const recent = await transaction.select({ createdAt: authTokens.createdAt }).from(authTokens).where(and(
      eq(authTokens.userId, userId), eq(authTokens.type, type),
      gt(authTokens.createdAt, new Date(now.getTime() - 60 * 60_000)),
    ));
    if (recent.length >= 5 || recent.some((entry) => entry.createdAt.getTime() > now.getTime() - 60_000)) {
      throw new EmailRateLimitError();
    }
    // Keep issuance history for rate limiting while invalidating previous links.
    await transaction.update(authTokens).set({ usedAt: now }).where(and(
      eq(authTokens.userId, userId), eq(authTokens.type, type), isNull(authTokens.usedAt),
    ));
    const token = type === "email_verification"
      ? randomInt(0, 1_000_000).toString().padStart(6, "0")
      : randomBytes(32).toString("base64url");
    await transaction.insert(authTokens).values({
      userId, type, tokenHash: hashToken(token), createdAt: now,
      expiresAt: new Date(now.getTime() + durationMs),
    });
    return token;
  });
}

export async function createEmailVerificationToken(userId: string) {
  return createLimitedEmailToken(userId, "email_verification", EMAIL_OTP_DURATION_MINUTES * 60_000);
}

export async function verifyEmailToken(token: string) {
  if (!/^\d{6}$/.test(token)) {
    return false;
  }

  const tokenHash = hashToken(token);
  const now = new Date();

  return db.transaction(async (transaction) => {
    const [storedToken] = await transaction
      .select({
        id: authTokens.id,
        userId: authTokens.userId,
      })
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, tokenHash),
          eq(authTokens.type, "email_verification"),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!storedToken) {
      return false;
    }

    const [claimedToken] = await transaction
      .update(authTokens)
      .set({
        usedAt: now,
      })
      .where(
        and(
          eq(authTokens.id, storedToken.id),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      )
      .returning({
        userId: authTokens.userId,
      });

    if (!claimedToken) {
      return false;
    }

    await transaction
      .update(users)
      .set({
        status: "active",
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, claimedToken.userId));

    const [verifiedUser] = await transaction.select({
      id: users.id,
      name: users.name,
      email: users.email,
    }).from(users).where(eq(users.id, claimedToken.userId)).limit(1);

    return verifiedUser || false;
  });
}

export async function createPasswordResetToken(userId: string) {
  return createLimitedEmailToken(userId, "password_reset", PASSWORD_RESET_DURATION_MINUTES * 60_000);
}

export async function consumePasswordResetToken(
  token: string,
  passwordHash: string,
) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
    return false;
  }

  const now = new Date();

  return db.transaction(async (transaction) => {
    const [storedToken] = await transaction
      .select({
        id: authTokens.id,
        userId: authTokens.userId,
      })
      .from(authTokens)
      .where(
        and(
          eq(authTokens.tokenHash, hashToken(token)),
          eq(authTokens.type, "password_reset"),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      )
      .limit(1);

    if (!storedToken) {
      return false;
    }

    const [claimedToken] = await transaction
      .update(authTokens)
      .set({ usedAt: now })
      .where(
        and(
          eq(authTokens.id, storedToken.id),
          isNull(authTokens.usedAt),
          gt(authTokens.expiresAt, now),
        ),
      )
      .returning({ userId: authTokens.userId });

    if (!claimedToken) {
      return false;
    }

    await transaction
      .update(users)
      .set({ passwordHash, updatedAt: now })
      .where(eq(users.id, claimedToken.userId));

    // Commit password replacement and revocation together. Access JWTs check this session row.
    await transaction.delete(sessions).where(eq(sessions.userId, claimedToken.userId));
    return claimedToken.userId;
  });
}
