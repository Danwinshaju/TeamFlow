"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { authFetch } from "@/lib/auth-fetch";

type JoinRequest = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  requestedAt: string;
  workspaceName: string;
  workspaceSlug: string;
};

export function DashboardJoinRequests({ requests: initialRequests }: { requests: JoinRequest[] }) {
  const router = useRouter();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requests = initialRequests.filter((request) => !hiddenIds.has(request.id));

  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [router]);

  if (requests.length === 0) return null;

  async function decide(request: JoinRequest, decision: "accept" | "reject") {
    setBusyId(request.id);
    setError(null);
    try {
      const response = await authFetch(`/api/workspaces/${encodeURIComponent(request.workspaceSlug)}/invitations/${encodeURIComponent(request.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error || "Unable to update this join request.");
        return;
      }
      setHiddenIds((current) => new Set(current).add(request.id));
      router.refresh();
    } catch {
      setError("Unable to connect to TeamFlow. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mb-7 rounded-3xl border border-amber-300/25 bg-gradient-to-r from-amber-300/10 via-slate-900 to-emerald-400/10 p-6">
      <p className="text-xs font-bold tracking-[0.2em] text-amber-200">OWNER APPROVAL NEEDED</p>
      <h2 className="mt-2 text-2xl font-bold">People waiting to join</h2>
      <p className="mt-2 text-sm text-slate-300">Review requests across all workspaces you own. Approval adds the person only to the named workspace.</p>
      <div className="mt-5 grid gap-3">
        {requests.map((request) => (
          <article key={request.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{request.email}</p>
              <p className="mt-1 text-sm text-slate-400">
                Wants to join <span className="text-white">{request.workspaceName}</span> as <span className="capitalize text-violet-300">{request.role}</span>
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void decide(request, "accept")} disabled={busyId !== null} className="rounded-xl bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60">
                {busyId === request.id ? "Updating…" : "Approve"}
              </button>
              <button type="button" onClick={() => void decide(request, "reject")} disabled={busyId !== null} className="rounded-xl border border-red-400/40 px-5 py-3 font-semibold text-red-200 hover:bg-red-400/10 disabled:opacity-60">Reject</button>
            </div>
          </article>
        ))}
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-200">{error}</p>}
    </section>
  );
}
