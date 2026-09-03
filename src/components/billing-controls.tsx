"use client";

import Script from "next/script";
import { useState } from "react";

type BillingControlsProps = {
  workspaceSlug: string;
  canManage: boolean;
  subscriptionStatus: string | null;
  cancelAtCycleEnd: boolean;
};

type RazorpayInstance = { open: () => void };
type RazorpayConstructor = new (options: {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_subscription_id: string;
    razorpay_signature: string;
  }) => void;
}) => RazorpayInstance;

export function BillingControls({
  workspaceSlug,
  canManage,
  subscriptionStatus,
  cancelAtCycleEnd,
}: BillingControlsProps) {
  const [status, setStatus] = useState<string | null>(subscriptionStatus);
  const [scheduledForCancellation, setScheduledForCancellation] = useState(cancelAtCycleEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/billing/subscribe`, { method: "POST" });
      const data = (await response.json()) as { keyId?: string; subscriptionId?: string; error?: string };
      if (!response.ok || !data.keyId || !data.subscriptionId) throw new Error(data.error || "Could not start checkout.");
      const Razorpay = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (!Razorpay) throw new Error("Checkout is still loading. Try again in a moment.");
      const checkout = new Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "TeamFlow",
        description: "TeamFlow Pro workspace subscription",
        handler: async (payment) => {
          const verification = await fetch(`/api/workspaces/${workspaceSlug}/billing/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payment),
          });
          if (!verification.ok) throw new Error("Payment verification failed.");
          setStatus("active");
        },
      });
      checkout.open();
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelSubscription() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/billing/cancel`, { method: "POST" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not cancel the subscription.");
      setScheduledForCancellation(true);
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel the subscription.");
    } finally {
      setBusy(false);
    }
  }

  const isPaid = status && !["cancelled", "completed", "expired"].includes(status);

  return (
    <>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canManage && !isPaid && (
          <button type="button" onClick={() => void startCheckout()} disabled={busy} className="rounded-lg bg-violet-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? "Starting checkout..." : "Upgrade to Pro"}
          </button>
        )}
        {canManage && isPaid && !scheduledForCancellation && (
          <button type="button" onClick={() => void cancelSubscription()} disabled={busy} className="rounded-lg border border-red-400/30 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-400/10 disabled:opacity-60">
            {busy ? "Updating..." : "Cancel at period end"}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {scheduledForCancellation && <p className="mt-3 text-sm text-amber-200">Your subscription will remain active until the current period ends.</p>}
    </>
  );
}
