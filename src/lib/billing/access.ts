import { and, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";

import { db } from "@/db";
import { userAccessRequests, users, workspaceInvitations, workspaceMembers, workspaceSubscriptions, workspaces } from "@/db/schema";

export function isPlatformOwner(email: string) {
  return email.toLowerCase() === (process.env.PLATFORM_OWNER_EMAIL || "thecuriouscorner25@gmail.com").toLowerCase();
}

export async function getUserAccessDestination(userId: string) {
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return "/login";

  const [existingMembership] = await db.select({ id: workspaceMembers.id })
    .from(workspaceMembers).where(eq(workspaceMembers.userId, userId)).limit(1);
  if (existingMembership) return "/dashboard";

  const [pendingInvitation] = await db.select({ id: workspaceInvitations.id })
    .from(workspaceInvitations)
    .where(and(
      eq(workspaceInvitations.email, user.email),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
      gt(workspaceInvitations.expiresAt, new Date()),
    )).limit(1);
  if (pendingInvitation) return "/dashboard";

  let [request] = await db.select({ status: userAccessRequests.status })
    .from(userAccessRequests).where(eq(userAccessRequests.userId, userId)).limit(1);

  if (!request) {
    [request] = await db.insert(userAccessRequests)
      .values({ userId, status: "awaiting_payment" })
      .returning({ status: userAccessRequests.status });
  }

  if (!request) return "/onboarding/waiting";
  if (request.status === "payment_failed") return "/onboarding/payment-failed?reason=declined";
  if (request.status === "awaiting_payment") return "/onboarding/billing";
  if (request.status === "pending_approval") return "/onboarding/waiting";
  if (request.status === "rejected") return "/onboarding/waiting?status=rejected";

  if (request.status === "approved") return "/dashboard";
  return "/onboarding/waiting";
}

export async function completeUserAccessPayment(userId: string, payment: {
  customerId: string;
  subscriptionId: string;
  priceId: string;
}) {
  const [identity] = await db.select({ email: users.email }).from(users)
    .where(eq(users.id, userId)).limit(1);
  if (!identity) throw new Error("The paid user no longer exists.");

  const [pendingInvitation] = await db.select({ id: workspaceInvitations.id })
    .from(workspaceInvitations).where(and(
      eq(workspaceInvitations.email, identity.email),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
      gt(workspaceInvitations.expiresAt, new Date()),
    )).limit(1);
  if (pendingInvitation) throw new Error("Invited users join their workspace without payment.");

  // A delayed Stripe event for a refunded subscription must never restore access.
  const [previousAccess] = await db.select({ status: userAccessRequests.status, stripeSubscriptionId: userAccessRequests.stripeSubscriptionId })
    .from(userAccessRequests).where(eq(userAccessRequests.userId, userId)).limit(1);
  if (previousAccess?.status === "refunded" && previousAccess.stripeSubscriptionId === payment.subscriptionId) return;

  await db.transaction(async (tx) => {
    await tx.insert(userAccessRequests).values({
      userId,
      status: "approved",
      stripeCustomerId: payment.customerId,
      stripeSubscriptionId: payment.subscriptionId,
      stripePriceId: payment.priceId,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: userAccessRequests.userId,
      set: {
        status: "approved",
        stripeCustomerId: payment.customerId,
        stripeSubscriptionId: payment.subscriptionId,
        stripePriceId: payment.priceId,
        updatedAt: new Date(),
      },
    });
  });
}

export async function hasPaidWorkspaceAccess(userId: string, slug: string) {
  const [identity] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!identity) return false;

  const [membership] = await db.select({
    workspaceId: workspaces.id,
    ownerId: workspaces.ownerId,
    role: workspaceMembers.role,
  }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaces.slug, slug)))
    .limit(1);
  if (!membership) return false;
  if (isPlatformOwner(identity.email)) return true;

  if (membership.role === "owner") {
    const [paidOwner] = await db.select({ id: userAccessRequests.id }).from(userAccessRequests)
      .where(and(
        eq(userAccessRequests.userId, userId),
        eq(userAccessRequests.status, "approved"),
        isNotNull(userAccessRequests.stripeCustomerId),
        isNotNull(userAccessRequests.stripeSubscriptionId),
        isNotNull(userAccessRequests.stripePriceId),
      )).limit(1);
    return Boolean(paidOwner);
  }

  // A Member or Admin never pays for an invitation, but their workspace is
  // active only while its Owner has an active paid Owner subscription.
  const [workspaceOwnerPayment] = await db.select({ id: userAccessRequests.id }).from(userAccessRequests)
    .where(and(
      eq(userAccessRequests.userId, membership.ownerId),
      eq(userAccessRequests.status, "approved"),
      isNotNull(userAccessRequests.stripeCustomerId),
      isNotNull(userAccessRequests.stripeSubscriptionId),
      isNotNull(userAccessRequests.stripePriceId),
    )).limit(1);
  if (workspaceOwnerPayment) return true;

  const [activeWorkspaceSubscription] = await db.select({ id: workspaceSubscriptions.id })
    .from(workspaceSubscriptions)
    .where(and(
      eq(workspaceSubscriptions.workspaceId, membership.workspaceId),
      eq(workspaceSubscriptions.billingProvider, "stripe"),
      inArray(workspaceSubscriptions.status, ["authenticated", "active"]),
    )).limit(1);
  return Boolean(activeWorkspaceSubscription);
}

export async function hasAnyPaidWorkspaceAccess(userId: string) {
  const [identity] = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!identity) return false;
  if (isPlatformOwner(identity.email)) return true;

  const memberships = await db.select({ slug: workspaces.slug })
    .from(workspaceMembers).innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));
  for (const membership of memberships) {
    if (await hasPaidWorkspaceAccess(userId, membership.slug)) return true;
  }

  const [approvedAccess] = await db.select({ id: userAccessRequests.id }).from(userAccessRequests)
    .where(and(
      eq(userAccessRequests.userId, userId),
      eq(userAccessRequests.status, "approved"),
      isNotNull(userAccessRequests.stripeSubscriptionId),
    ))
    .limit(1);
  if (approvedAccess) return true;

  const [access] = await db.select({ id: workspaces.id }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .innerJoin(workspaceSubscriptions, eq(workspaceSubscriptions.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceSubscriptions.billingProvider, "stripe"), inArray(workspaceSubscriptions.status, ["authenticated", "active"])))
    .limit(1);
  return Boolean(access);
}
