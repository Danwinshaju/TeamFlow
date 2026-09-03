"use client";

import Script from "next/script";
import { useState } from "react";

type CheckoutButtonProps = { amount: number };
type CheckoutResponse = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type Razorpay = new (options: {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: CheckoutResponse) => void;
  modal: { ondismiss: () => void };
}) => { open: () => void; on: (event: string, callback: (response: { error?: { description?: string } }) => void) => void };

export function StandardCheckoutButton({ amount }: CheckoutButtonProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    setMessage(null);
    try {
      const orderResponse = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const order = (await orderResponse.json()) as { order_id?: string; amount?: number; currency?: string; error?: string };
      if (!orderResponse.ok || !order.order_id || !order.amount || !order.currency) throw new Error(order.error || "Could not create order.");
      const RazorpayConstructor = (window as unknown as { Razorpay?: Razorpay }).Razorpay;
      if (!RazorpayConstructor) throw new Error("Payment checkout is still loading. Try again.");
      const checkout = new RazorpayConstructor({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
        amount: order.amount,
        currency: order.currency,
        name: "TeamFlow",
        description: "TeamFlow Pro",
        order_id: order.order_id,
        handler: async (payment) => {
          const response = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payment),
          });
          const result = (await response.json()) as { success?: boolean; error?: string };
          setMessage(response.ok && result.success ? "Payment verified successfully." : result.error || "Payment verification failed.");
        },
        modal: { ondismiss: () => setMessage("Payment cancelled.") },
      });
      checkout.on("payment.failed", (failure) => {
        setMessage(failure.error?.description || "Payment failed. Please try again.");
      });
      checkout.open();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment could not be started.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <button type="button" onClick={() => void pay()} disabled={busy} className="rounded-lg bg-violet-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-violet-300 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "Starting payment..." : `Pay INR ${(amount / 100).toFixed(2)}`}
      </button>
      {message && <p role="status" className="mt-3 text-sm text-slate-300">{message}</p>}
    </div>
  );
}
