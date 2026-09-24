"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type VerifyEmailFormProps = {
  token: string | null;
  email: string | null;
};

type VerificationState =
  | "idle"
  | "loading"
  | "success"
  | "error";

export function VerifyEmailForm({
  token,
  email,
}: VerifyEmailFormProps) {
  const router = useRouter();
  const automaticVerificationStarted = useRef(false);
  const [verificationCode, setVerificationCode] = useState(token ?? "");
  const [status, setStatus] =
    useState<VerificationState>("idle");

  const [message, setMessage] = useState<string | null>(
    null,
  );
  const [resending, setResending] = useState(false);
  const resolvedEmail = email ?? "";

  useEffect(() => {
    if (email) {
      window.localStorage.setItem("teamflow_pending_verification_email", email);
    }
  }, [email]);

  async function resendCode() {
    if (!resolvedEmail || resending) return;
    setResending(true); setMessage(null);
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: resolvedEmail }) });
      const result = await response.json() as { message?: string; error?: string };
      setMessage(result.message || result.error || "If this account is waiting for verification, a new OTP has been sent.");
      setStatus(response.ok ? "idle" : "error");
    } catch { setStatus("error"); setMessage("Unable to request another OTP. Check your connection and try again."); }
    finally { setResending(false); }
  }

  const verifyEmail = useCallback(async () => {
    const submittedCode = verificationCode.trim();
    if (!submittedCode) {
      setMessage("Enter the one-time code sent to your email.");
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
        body: JSON.stringify({ token: submittedCode, email: resolvedEmail || undefined }),
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
      window.localStorage.removeItem("teamflow_pending_verification_email");
      setMessage(
        result.message ?? "Your email address is verified.",
      );
      window.setTimeout(() => router.replace("/login?verified=true"), 900);
    } catch {
      setStatus("error");
      setMessage(
        "Unable to connect to the server. Please try again.",
      );
    }
  }, [router, verificationCode, resolvedEmail]);

  useEffect(() => {
    if (!token || !/^\d{6}$/.test(token) || automaticVerificationStarted.current) return;
    automaticVerificationStarted.current = true;
    void verifyEmail();
  }, [token, verifyEmail]);

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
              href="/login?verified=true"
              className="mt-6 block rounded-xl bg-violet-500 px-5 py-3 text-center font-semibold hover:bg-violet-400"
            >
              Continue to sign in
            </Link>
          </>
        ) : token && status === "loading" ? (
          <div role="status" className="py-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-300/30 border-t-violet-400" />
            <p className="mt-4 font-semibold text-slate-200">Verifying your email…</p>
            <p className="mt-2 text-sm text-slate-400">Please wait while we complete your registration.</p>
          </div>
        ) : (
          <>
            <label htmlFor="verification-code" className="text-sm text-slate-300">Enter the one-time code sent to your email.</label>
            <input id="verification-code" value={verificationCode} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" maxLength={6} className="mt-3 w-full rounded-xl border border-white/15 bg-slate-950 px-4 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none focus:border-violet-400" placeholder="000000" />

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
              disabled={verificationCode.length !== 6 || status === "loading"}
              className="mt-6 w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "loading"
                ? "Verifying..."
                : "Verify email"}
            </button>
            {resolvedEmail && <button type="button" disabled={resending} onClick={() => void resendCode()} className="mt-3 w-full rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-60">{resending ? "Sending a new OTP…" : "Didn’t receive it? Resend OTP"}</button>}
            {resolvedEmail && <p className="mt-3 text-center text-xs text-slate-500">Sending to {resolvedEmail}</p>}
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
