import { createHash, randomBytes } from "node:crypto";
import {
  and,
  eq,
  gt,
  isNull,
} from "drizzle-orm";

import { db } from "@/db";
import { authTokens, users } from "@/db/schema";

const EMAIL_TOKEN_DURATION_HOURS = 24;
const PASSWORD_RESET_DURATION_MINUTES = 30;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createEmailVerificationToken(
  userId: string,
) {
  await db
    .delete(authTokens)
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.type, "email_verification"),
        isNull(authTokens.usedAt),
      ),
    );

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date();

  expiresAt.setHours(
    expiresAt.getHours() + EMAIL_TOKEN_DURATION_HOURS,
  );

  await db.insert(authTokens).values({
    userId,
    type: "email_verification",
    tokenHash,
    expiresAt,
  });

  return token;
}

export async function verifyEmailToken(token: string) {
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) {
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

    return true;
  });
}

export async function createPasswordResetToken(userId: string) {
  await db
    .delete(authTokens)
    .where(
      and(
        eq(authTokens.userId, userId),
        eq(authTokens.type, "password_reset"),
        isNull(authTokens.usedAt),
      ),
    );

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_DURATION_MINUTES * 60_000,
  );

  await db.insert(authTokens).values({
    userId,
    type: "password_reset",
    tokenHash: hashToken(token),
    expiresAt,
  });

  return token;
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

    return claimedToken.userId;
  });
}
