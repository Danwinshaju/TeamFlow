"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AcceptInvitationFormProps = {
  token: string | null;
};

export function AcceptInvitationForm({
  token,
}: AcceptInvitationFormProps) {
  const router = useRouter();

  const [status, setStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const [message, setMessage] = useState<string | null>(
    token
      ? null
      : "This invitation link is incomplete.",
  );

  async function acceptInvitation() {
    if (!token) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch(
        "/api/invitations/accept",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            token,
          }),
        },
      );

      const result = (await response.json()) as {
        message?: string;
        error?: string;
        workspaceSlug?: string;
      };

      if (!response.ok) {
        setStatus("error");

        setMessage(
          result.error ??
            "Unable to accept this invitation.",
        );

        return;
      }

      if (!result.workspaceSlug) {
        setStatus("error");

        setMessage(
          "The workspace destination is missing.",
        );

        return;
      }

      router.push(
        `/workspaces/${result.workspaceSlug}`,
      );

      router.refresh();
    } catch {
      setStatus("error");

      setMessage(
        "Unable to connect to the server. Please try again.",
      );
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        Workspace invitation
      </h1>

      <p className="mt-3 text-slate-400">
        Accept this invitation to join the TeamFlow
        workspace.
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="text-sm text-slate-300">
          You must sign in using the same email address
          that received the invitation.
        </p>

        {message && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300"
          >
            {message}
          </div>
        )}

        <button
          type="button"
          onClick={acceptInvitation}
          disabled={
            !token ||
            status === "loading"
          }
          className="mt-6 w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "loading"
            ? "Accepting invitation..."
            : "Accept invitation"}
        </button>
      </div>

      <p className="mt-7 text-center text-sm text-slate-400">
        Need to use another account?{" "}

        <Link
          href="/login"
          className="font-semibold text-violet-400 hover:text-violet-300"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}