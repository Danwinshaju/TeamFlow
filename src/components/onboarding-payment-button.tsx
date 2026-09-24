"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth-fetch";
export function OnboardingPaymentButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  async function begin() { setLoading(true); setError(""); try { const response = await authFetch("/api/onboarding/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intent: "become_owner" }) }); const result = await response.json() as { checkoutUrl?: string; error?: string }; if (!response.ok || !result.checkoutUrl) { setError(result.error || "Could not open secure checkout."); return; } window.location.assign(result.checkoutUrl); } catch { router.push("/onboarding/payment-failed?reason=network"); } finally { setLoading(false); } }
  return <div><button type="button" onClick={() => void begin()} disabled={loading} className="w-full rounded-2xl bg-violet-500 px-6 py-4 font-semibold hover:bg-violet-400 disabled:opacity-60">{loading ? "Opening secure checkout…" : "Subscribe for ₹499/month"}</button>{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}</div>;
}
