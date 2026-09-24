import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userAccessRequests } from "@/db/schema";
import { stripeClient, stripePriceId } from "@/lib/billing/stripe";
import { getCurrentUser } from "@/lib/security/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Authentication required." }, { status: 401 });
  if (user.status !== "active") return Response.json({ error: "Verify your email first." }, { status: 403 });
  const body = await request.json().catch(() => null) as { intent?: string } | null;
  if (body?.intent !== "become_owner") return Response.json({ error: "Choose Start my own workspace before opening Owner checkout." }, { status: 400 });
  const [existing] = await db.select({ status: userAccessRequests.status, stripeSubscriptionId: userAccessRequests.stripeSubscriptionId }).from(userAccessRequests).where(eq(userAccessRequests.userId, user.id)).limit(1);
  if (existing?.status === "approved" && existing.stripeSubscriptionId) return Response.json({ error: "Your Owner subscription is already active." }, { status: 409 });
  try {
    const stripe = stripeClient(); const priceId = stripePriceId(); const price = await stripe.prices.retrieve(priceId);
    if (!price.active || price.type !== "recurring" || price.currency !== "inr" || price.unit_amount !== 49900 || price.recurring?.interval !== "month") return Response.json({ error: "The TeamFlow test price is not configured correctly." }, { status: 503 });
    await db.insert(userAccessRequests).values({ userId: user.id, status: "awaiting_payment" }).onConflictDoUpdate({ target: userAccessRequests.userId, set: { status: "awaiting_payment", updatedAt: new Date() } });
    const origin = checkoutReturnOrigin(request);
    const session = await stripe.checkout.sessions.create({ mode: "subscription", line_items: [{ price: priceId, quantity: 1 }], customer_email: user.email, client_reference_id: user.id, metadata: { kind: "user_access", purpose: "create_owned_workspace", userId: user.id }, subscription_data: { metadata: { kind: "user_access", purpose: "create_owned_workspace", userId: user.id } }, success_url: `${origin}/onboarding/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/onboarding/payment-failed?reason=cancelled` });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return Response.json({ checkoutUrl: session.url });
  } catch (error) { console.error("Failed to start user onboarding checkout", error); return Response.json({ error: "Could not start Stripe Checkout." }, { status: 502 }); }
}

function checkoutReturnOrigin(request: Request) {
  const allowedOrigins = new Set<string>();
  if (process.env.APP_URL) allowedOrigins.add(new URL(process.env.APP_URL).origin);
  if (process.env.LOCAL_NETWORK_TESTING === "true" && process.env.TEST_LAN_URL) {
    allowedOrigins.add(new URL(process.env.TEST_LAN_URL).origin);
  }

  const browserOrigin = request.headers.get("origin");
  if (browserOrigin && allowedOrigins.has(browserOrigin)) return browserOrigin;

  const requestOrigin = new URL(request.url).origin;
  if (allowedOrigins.has(requestOrigin)) return requestOrigin;

  return process.env.APP_URL ? new URL(process.env.APP_URL).origin : requestOrigin;
}
