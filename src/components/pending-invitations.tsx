"use client";
import { authFetch as fetch } from "@/lib/auth-fetch";

import {
  useEffect,
  useState,
} from "react";

type PendingInvitation = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expiresAt: string;
  createdAt: string;
  requestedAt: string | null;
};

type PendingInvitationsProps = {
  workspaceSlug: string;
};

export function PendingInvitations({
  workspaceSlug,
}: PendingInvitationsProps) {
  const [invitations, setInvitations] =
    useState<PendingInvitation[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [revokingId, setRevokingId] =
    useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInvitations() {
      try {
        const response = await fetch(
          `/api/workspaces/${workspaceSlug}/invitations`,
          {
            signal: controller.signal,
          },
        );

        const result = (await response.json()) as {
          invitations?: PendingInvitation[];
          error?: string;
        };

        if (!response.ok) {
          setError(
            result.error ??
              "Unable to load invitations.",
          );

          return;
        }

        setInvitations(
          result.invitations ?? [],
        );
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === "AbortError"
        ) {
          return;
        }

        setError(
          "Unable to connect to the server.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadInvitations();
    const timer = window.setInterval(() => void loadInvitations(), 5000);

    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [workspaceSlug]);

  async function revokeInvitation(
    invitationId: string,
  ) {
    setRevokingId(invitationId);
    setError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/invitations/${invitationId}`,
        {
          method: "DELETE",
        },
      );

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setError(
          result.error ??
            "Unable to revoke the invitation.",
        );

        return;
      }

      setInvitations((currentInvitations) =>
        currentInvitations.filter(
          (invitation) =>
            invitation.id !== invitationId,
        ),
      );
    } catch {
      setError(
        "Unable to connect to the server.",
      );
    } finally {
      setRevokingId(null);
    }
  }

  async function decideInvitation(invitationId: string, decision: "accept" | "reject") {
    setDecidingId(invitationId);
    setError(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/invitations/${invitationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error || "Unable to update this join request."); return; }
      setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId));
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setDecidingId(null);
    }
  }

  if (isLoading) {
    return (
      <p className="mt-4 text-sm text-slate-400">
        Loading invitations...
      </p>
    );
  }

  return (
    <div className="mt-6 border-t border-white/10 pt-6">
      <section className="mb-7 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5">
        <h3 className="font-semibold text-cyan-100">Join requests</h3>
        <p className="mt-1 text-sm text-slate-400">People waiting for the workspace Owner&apos;s decision.</p>
        {invitations.filter((invitation) => invitation.requestedAt).length === 0 ? <p className="mt-4 text-sm text-slate-500">No join requests waiting.</p> : <div className="mt-4 space-y-3">{invitations.filter((invitation) => invitation.requestedAt).map((invitation) => <div key={invitation.id} className="flex flex-col gap-3 rounded-xl border border-white/10 bg-slate-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{invitation.email}</p><p className="mt-1 text-xs capitalize text-violet-300">Requested {invitation.role} access</p></div><div className="flex gap-2"><button type="button" onClick={() => void decideInvitation(invitation.id, "accept")} disabled={decidingId !== null} className="rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-60">Accept</button><button type="button" onClick={() => void decideInvitation(invitation.id, "reject")} disabled={decidingId !== null} className="rounded-lg border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-60">Reject</button></div></div>)}</div>}
      </section>
      <h3 className="font-semibold">
        Pending invitations
      </h3>

      <p className="mt-1 text-sm text-slate-400">
        Invitations that have not yet been accepted.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </div>
      )}

      {invitations.filter((invitation) => !invitation.requestedAt).length === 0 ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-500">
          No pending invitations.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-white/10">
          {invitations.filter((invitation) => !invitation.requestedAt).map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {invitation.email}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  <span className="capitalize">
                    {invitation.role}
                  </span>

                  {" · Expires "}

                  {formatDate(
                    invitation.expiresAt,
                  )}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  revokeInvitation(
                    invitation.id,
                  )
                }
                disabled={
                  revokingId === invitation.id
                }
                className="rounded-lg border border-red-400/30 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {revokingId === invitation.id
                  ? "Revoking..."
                  : "Revoke"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(date.getUTCDate()).padStart(2, "0")} ${months[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}
