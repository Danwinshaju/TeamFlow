"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

export function AccountActions({ ownedWorkspaceCount }: { ownedWorkspaceCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [refunding, setRefunding] = useState(false);

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    setDeleting(true);
    setError("");
    try {
      const response = await authFetch("/api/profile", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmation }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) setError(result.error || "Could not delete your account.");
      else router.replace("/");
    } catch {
      setError("Unable to connect to TeamFlow.");
    } finally {
      setDeleting(false);
    }
  }

  async function requestRefund(event: React.FormEvent) {
    event.preventDefault();
    setRefunding(true);
    setRefundError("");
    try {
      const response = await authFetch("/api/billing/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setRefundError(result.error || "Could not process the refund."); return; }
      router.replace("/login?refund=complete");
    } catch {
      setRefundError("Unable to connect to TeamFlow.");
    } finally {
      setRefunding(false);
    }
  }

  return <>
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <h2 className="text-xl font-semibold">Account & security</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Manage your password, active session, and account.</p>
      <div className="mt-5 grid gap-3">
        <Link href="/forgot-password" className="rounded-xl border border-white/10 px-4 py-3 text-center text-sm font-semibold transition hover:bg-white/10">Reset password</Link>
        <form action="/api/auth/logout" method="post">
          <button className="w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold transition hover:bg-white/10">Sign out</button>
        </form>
      </div>
    </section>
    <section className="rounded-3xl border border-rose-400/20 bg-rose-500/[0.05] p-6">
      <h2 className="text-lg font-semibold text-rose-200">Danger zone</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Permanently delete your profile, messages, tasks, and memberships.</p>
      <button type="button" onClick={() => setOpen(true)} className="mt-5 rounded-xl border border-rose-400/40 px-4 py-2.5 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/10">Delete account</button>
    </section>

    <section className="rounded-3xl border border-amber-400/20 bg-amber-400/[0.05] p-6">
      <h2 className="text-lg font-semibold text-amber-100">Billing & refund</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">Owner payments have a seven-day money-back guarantee. A successful refund cancels Pro immediately and signs out every device.</p>
      <button type="button" onClick={() => setRefundOpen(true)} className="mt-5 rounded-xl border border-amber-400/40 px-4 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-400/10">Request refund</button>
    </section>

    {open && <div role="dialog" aria-modal="true" aria-labelledby="delete-account-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form onSubmit={deleteAccount} className="w-full max-w-md rounded-3xl border border-rose-400/25 bg-slate-900 p-6 shadow-2xl">
        <h2 id="delete-account-title" className="text-2xl font-bold">Delete your account?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">This cannot be undone. {ownedWorkspaceCount > 0 ? `Your ${ownedWorkspaceCount} owned workspace${ownedWorkspaceCount === 1 ? "" : "s"}, its projects, tasks, and conversations will also be deleted.` : "You will be removed from every workspace."} Active subscriptions will be cancelled.</p>
        <label className="mt-5 block text-sm font-medium">Current password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 outline-none focus:border-rose-400" /></label>
        <label className="mt-4 block text-sm font-medium">Type <strong>DELETE</strong> to confirm<input required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 outline-none focus:border-rose-400" /></label>
        {error && <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={() => { setOpen(false); setError(""); }} className="flex-1 rounded-xl border border-white/15 px-4 py-3 font-semibold hover:bg-white/10">Keep account</button>
          <button disabled={deleting || confirmation !== "DELETE" || !password} className="flex-1 rounded-xl bg-rose-500 px-4 py-3 font-semibold hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50">{deleting ? "Deleting…" : "Delete forever"}</button>
        </div>
      </form>
    </div>}
    {refundOpen && <div role="dialog" aria-modal="true" aria-labelledby="refund-title" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <form onSubmit={requestRefund} className="w-full max-w-md rounded-3xl border border-amber-400/25 bg-slate-900 p-6 shadow-2xl">
        <p className="text-xs font-bold tracking-[0.18em] text-amber-300">SECURE BILLING ACTION</p>
        <h2 id="refund-title" className="mt-2 text-2xl font-bold">Cancel and refund?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-300">If your first successful Owner payment was made in the last seven days, TeamFlow will cancel the subscription and start a full refund to the original payment method. The server validates your account and payment with Stripe first. You will be signed out from all devices and receive a confirmation email.</p>
        {refundError && <p role="alert" className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">{refundError}</p>}
        <div className="mt-6 flex gap-3"><button type="button" onClick={() => { setRefundOpen(false); setRefundError(""); }} className="flex-1 rounded-xl border border-white/15 px-4 py-3 font-semibold hover:bg-white/10">Keep subscription</button><button disabled={refunding} className="flex-1 rounded-xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50">{refunding ? "Processing…" : "Cancel & refund"}</button></div>
      </form>
    </div>}
  </>;
}
