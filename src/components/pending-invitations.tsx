"use client";

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

    return () => {
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

  if (isLoading) {
    return (
      <p className="mt-4 text-sm text-slate-400">
        Loading invitations...
      </p>
    );
  }

  return (
    <div className="mt-6 border-t border-white/10 pt-6">
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

      {invitations.length === 0 ? (
        <p className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-500">
          No pending invitations.
        </p>
      ) : (
        <div className="mt-4 divide-y divide-white/10">
          {invitations.map((invitation) => (
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
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}