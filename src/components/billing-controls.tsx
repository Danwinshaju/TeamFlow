"use client";
import { authFetch as fetch } from "@/lib/auth-fetch";

import { useState } from "react";

type BillingControlsProps = {
  workspaceSlug: string;
  canManage: boolean;
  subscriptionStatus: string | null;
  cancelAtCycleEnd: boolean;
};

export function BillingControls({
  workspaceSlug,
  canManage,
  subscriptionStatus,
  cancelAtCycleEnd,
}: BillingControlsProps) {
  const [scheduledForCancellation, setScheduledForCancellation] = useState(cancelAtCycleEnd);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/billing/subscribe`, { method: "POST" });
      const data = (await response.json()) as { checkoutUrl?: string; error?: string };
      if (!response.ok || !data.checkoutUrl) throw new Error(data.error || "Could not start checkout.");
      window.location.assign(data.checkoutUrl);
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : "Could not start checkout.");
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

  const isPaid = subscriptionStatus === "authenticated" || subscriptionStatus === "active";

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {canManage && !isPaid && (
          <button type="button" onClick={() => void startCheckout()} disabled={busy} className="rounded-lg bg-violet-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60">
            {busy ? "Opening Stripe Checkout..." : "Upgrade to Pro"}
          </button>
        )}
        {canManage && isPaid && !scheduledForCancellation && (
          <button type="button" onClick={() => { if (window.confirm("Cancel Pro at the end of the current billing period? Your benefits stay active until then.")) void cancelSubscription(); }} disabled={busy} className="rounded-lg border border-red-400/30 px-4 py-2 text-sm font-medium text-red-200 transition hover:bg-red-400/10 disabled:opacity-60">
            {busy ? "Updating..." : "Cancel Pro subscription"}
          </button>
        )}
      </div>
      {canManage && !isPaid && <p className="mt-3 text-sm text-slate-400">Pay ₹499 per month on Stripe&apos;s secure hosted Checkout. Available payment methods depend on the methods enabled in your Stripe account.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      {scheduledForCancellation && <p className="mt-3 text-sm text-amber-200">Your subscription will remain active until the current period ends.</p>}
    </>
  );
}
