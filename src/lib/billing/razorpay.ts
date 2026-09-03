import { createHmac, timingSafeEqual } from "node:crypto";

const razorpayApiUrl = "https://api.razorpay.com/v1";

function getRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay credentials are not configured.");
  }

  return { keyId, keySecret };
}

export function getRazorpayKeyId() {
  return getRazorpayCredentials().keyId;
}

async function razorpayRequest<T>(path: string, init: RequestInit = {}) {
  const { keyId, keySecret } = getRazorpayCredentials();
  const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch(`${razorpayApiUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const body = (await response.json()) as T & { error?: { description?: string } };
  if (!response.ok) {
    throw new Error(body.error?.description || "Razorpay request failed.");
  }

  return body;
}

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  status: "created" | "authenticated" | "active" | "pending" | "halted" | "cancelled" | "completed" | "expired";
  current_start?: number;
  current_end?: number;
  charge_at?: number;
};

export function createRazorpaySubscription(planId: string) {
  return razorpayRequest<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      total_count: 12,
      customer_notify: 1,
    }),
  });
}

export function cancelRazorpaySubscription(subscriptionId: string) {
  return razorpayRequest<RazorpaySubscription>(
    `/subscriptions/${subscriptionId}/cancel`,
    {
      method: "POST",
      body: JSON.stringify({ cancel_at_cycle_end: 1 }),
    },
  );
}

export function verifyRazorpayPaymentSignature(
  subscriptionId: string,
  paymentId: string,
  signature: string,
) {
  const { keySecret } = getRazorpayCredentials();
  const expected = createHmac("sha256", keySecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");

  return safeEqual(expected, signature);
}

export function verifyRazorpayWebhookSignature(
  payload: string,
  signature: string,
) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("Razorpay webhook secret is not configured.");
  }

  const expected = createHmac("sha256", webhookSecret)
    .update(payload)
    .digest("hex");

  return safeEqual(expected, signature);
}

function safeEqual(expected: string, actual: string) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}