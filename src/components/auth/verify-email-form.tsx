"use client";

import { useState } from "react";
import Link from "next/link";

type VerifyEmailFormProps = {
  token: string | null;
};

type VerificationState =
  | "idle"
  | "loading"
  | "success"
  | "error";

export function VerifyEmailForm({
  token,
}: VerifyEmailFormProps) {
  const [status, setStatus] =
    useState<VerificationState>("idle");

  const [message, setMessage] = useState<string | null>(
    token ? null : "This verification link is incomplete.",
  );

  async function verifyEmail() {
    if (!token) {
      return;
    }

    setStatus("loading");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token }),
      });

      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setStatus("error");
        setMessage(
          result.error ?? "Unable to verify your email.",
        );
        return;
      }

      setStatus("success");
      setMessage(
        result.message ?? "Your email address is verified.",
      );
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
        Verify your email
      </h1>

      <p className="mt-3 text-slate-400">
        Confirm your email address to unlock all TeamFlow
        features.
      </p>

      <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
        {status === "success" ? (
          <>
            <p className="font-semibold text-emerald-300">
              Email verified
            </p>

            <p className="mt-2 text-sm text-slate-300">
              {message}
            </p>

            <Link
              href="/dashboard"
              className="mt-6 block rounded-xl bg-violet-500 px-5 py-3 text-center font-semibold hover:bg-violet-400"
            >
              Continue to dashboard
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-300">
              Click below to confirm that this email address
              belongs to you.
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
              onClick={verifyEmail}
              disabled={!token || status === "loading"}
              className="mt-6 w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading"
                ? "Verifying..."
                : "Verify email"}
            </button>
          </>
        )}
      </div>

      <p className="mt-7 text-center text-sm text-slate-400">
        <Link
          href="/login"
          className="font-semibold text-violet-400 hover:text-violet-300"
        >
          Return to sign in
        </Link>
      </p>
    </div>
  );
}