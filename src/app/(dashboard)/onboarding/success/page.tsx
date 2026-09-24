import { redirect } from "next/navigation";
import { completeUserAccessPayment } from "@/lib/billing/access";
import { stripeClient, stripeObjectId } from "@/lib/billing/stripe";
import { getCurrentUser } from "@/lib/security/session";
type Props = { searchParams: Promise<{ session_id?: string | string[] }> };
export default async function OnboardingSuccess({ searchParams }: Props) {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  const values = await searchParams; const sessionId = typeof values.session_id === "string" ? values.session_id : null;
  if (!sessionId) redirect("/onboarding/billing?payment=invalid");
  try {
    const stripe = stripeClient(); const session = await stripe.checkout.sessions.retrieve(sessionId);
    const subscriptionId = stripeObjectId(session.subscription); const customerId = stripeObjectId(session.customer);
    if (session.status !== "complete" || session.metadata?.kind !== "user_access" || session.metadata.purpose !== "create_owned_workspace" || session.metadata.userId !== user.id || !subscriptionId || !customerId) redirect("/onboarding/billing?payment=invalid");
    const subscription = await stripe.subscriptions.retrieve(subscriptionId); const priceId = subscription.items.data[0]?.price.id;
    if (!priceId) redirect("/onboarding/billing?payment=pending");
    await completeUserAccessPayment(user.id, { customerId, subscriptionId, priceId });
  } catch (error) { console.error("Failed to verify onboarding payment", error); redirect("/onboarding/billing?payment=pending"); }
  redirect("/dashboard");
}
