"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { authFetch } from "@/lib/auth-fetch";

type DashboardInvitation = {
  id: string;
  workspaceName: string;
  role: "owner" | "admin" | "member";
  expiresAt: string;
  requestedAt: string | null;
};

export function DashboardInvitations({ invitations }: { invitations: DashboardInvitation[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [waitingIds, setWaitingIds] = useState(() => new Set(invitations.filter((invitation) => invitation.requestedAt).map((invitation) => invitation.id)));

  useEffect(() => {
    if (waitingIds.size === 0) return;
    const timer = window.setInterval(async () => {
      for (const invitationId of waitingIds) {
        const response = await authFetch(`/api/invitations/accept?invitationId=${encodeURIComponent(invitationId)}`);
        if (!response.ok) continue;
        const result = await response.json() as { status?: string; workspaceSlug?: string };
        if (result.status === "approved" && result.workspaceSlug) {
          router.replace(`/workspaces/${result.workspaceSlug}`);
          router.refresh();
          return;
        }
        if (result.status === "rejected") {
          setWaitingIds((current) => { const next = new Set(current); next.delete(invitationId); return next; });
          setError("The workspace Owner rejected this join request.");
        }
      }
    }, 3000);
    return () => window.clearInterval(timer);
  }, [router, waitingIds]);

  if (invitations.length === 0) return null;

  async function accept(invitationId: string) {
    setBusyId(invitationId);
    setError(null);
    try {
      const response = await authFetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      const result = await response.json() as { error?: string; workspaceSlug?: string };
      if (!response.ok || !result.workspaceSlug) {
        setError(result.error || "Could not accept this invitation.");
        return;
      }
      setWaitingIds((current) => new Set(current).add(invitationId));
    } catch {
      setError("Unable to connect to TeamFlow. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-7 rounded-3xl border border-cyan-400/25 bg-gradient-to-r from-cyan-400/10 via-slate-900 to-violet-500/10 p-6">
      <p className="text-xs font-bold tracking-[0.2em] text-cyan-300">YOU&apos;RE INVITED</p>
      <h2 className="mt-2 text-2xl font-bold">Join your team workspace</h2>
      <p className="mt-2 text-sm text-slate-300">Accept the invitation, then the workspace Owner will approve your request. Invited users are never asked to pay.</p>
      <div className="mt-5 grid gap-3">
        {invitations.map((invitation) => (
          <article key={invitation.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">{invitation.workspaceName}</p>
              <p className="mt-1 text-sm text-slate-400">Role: <span className="capitalize text-violet-300">{invitation.role}</span> · Expires {formatUtcDate(invitation.expiresAt)}</p>
            </div>
            <button type="button" onClick={() => void accept(invitation.id)} disabled={busyId !== null || waitingIds.has(invitation.id)} className="rounded-xl bg-cyan-400 px-5 py-3 font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60">
              {busyId === invitation.id ? "Accepting…" : waitingIds.has(invitation.id) ? "Accepted · Waiting for Owner" : "Accept invitation"}
            </button>
          </article>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
    </section>
  );
}

function formatUtcDate(value: string) {
  const date = new Date(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getUTCDate()).padStart(2, "0")} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
