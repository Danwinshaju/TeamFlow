import Stripe from "stripe";

function secretKey() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return key;
}

export function stripeClient() {
  return new Stripe(secretKey(), { maxNetworkRetries: 2 });
}

export function stripePriceId() {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) throw new Error("STRIPE_PRO_PRICE_ID is not configured.");
  return priceId;
}

export function mapStripeStatus(status: Stripe.Subscription.Status) {
  if (status === "active" || status === "trialing") return "active" as const;
  if (status === "past_due" || status === "unpaid" || status === "paused") return "halted" as const;
  if (status === "canceled" || status === "incomplete_expired") return "cancelled" as const;
  return "created" as const;
}

export function stripeSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    start: item?.current_period_start ? new Date(item.current_period_start * 1000) : null,
    end: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
  };
}

export function stripeObjectId(value: string | { id: string } | null) {
  return typeof value === "string" ? value : value?.id ?? null;
}
