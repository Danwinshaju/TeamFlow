"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  loginSchema,
  type LoginInput,
} from "@/lib/validations/auth";

type LoginFormProps = {
  registrationComplete?: boolean;
  emailVerified?: boolean;
};

export function LoginForm({ registrationComplete = false, emailVerified = false }: LoginFormProps) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [verificationEmail, setVerificationEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(data: LoginInput) {
    setServerError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as {
        error?: string;
        next?: string;
        verificationRequired?: boolean;
        email?: string;
      };

      if (!response.ok) {
        if (result.verificationRequired && result.email) {
          setVerificationEmail(result.email);
          window.localStorage.setItem("teamflow_pending_verification_email", result.email);
        }
        setServerError(
          result.error ?? "Unable to sign in.",
        );
        return;
      }

      router.push(result.next ?? "/dashboard");
      router.refresh();
    } catch {
      setServerError(
        "Unable to connect to the server. Please try again.",
      );
    }
  }

  async function resendOtp() {
    if (!verificationEmail || resending) return;
    setResending(true); setResendMessage("");
    try {
      const response = await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: verificationEmail }) });
      const result = await response.json() as { message?: string; error?: string };
      setResendMessage(result.message || result.error || "A new OTP has been requested.");
    } catch { setResendMessage("Unable to send a new OTP. Check your connection and try again."); }
    finally { setResending(false); }
  }

  const inputClassName =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        Welcome back
      </h1>

      <p className="mt-3 text-slate-400">
        Sign in to continue to your TeamFlow workspace.
      </p>

      {registrationComplete && (
        <div role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-200">
          Account created successfully. Open the verification email we sent you, verify your account, then sign in here.
        </div>
      )}

      {emailVerified && (
        <div role="status" className="mt-5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-200">
          OTP verified and registration completed successfully. Sign in to continue.
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-8 space-y-5"
      >
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Email address
          </label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={
              errors.email ? "login-email-error" : undefined
            }
            className={inputClassName}
            {...register("email")}
          />

          {errors.email && (
            <p
              id="login-email-error"
              className="mt-2 text-sm text-red-400"
            >
              {errors.email.message}
            </p>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-200"
            >
              Password
            </label>

            <Link
              href="/forgot-password"
              className="text-sm font-medium text-violet-400 hover:text-violet-300"
            >
              Forgot password?
            </Link>
          </div>

          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              errors.password
                ? "login-password-error"
                : undefined
            }
            className={inputClassName}
            {...register("password")}
          />

          {errors.password && (
            <p
              id="login-password-error"
              className="mt-2 text-sm text-red-400"
            >
              {errors.password.message}
            </p>
          )}
        </div>

        {serverError && (
          <div
            role="alert"
            className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300"
          >
            {serverError}
          </div>
        )}

        {verificationEmail && <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"><p className="font-semibold text-amber-200">Email verification required</p><p className="mt-1 text-sm text-slate-300">Continue with the OTP already sent to <span className="font-medium">{verificationEmail}</span>, or request a new code.</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => router.push(`/verify-email?email=${encodeURIComponent(verificationEmail)}`)} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold hover:bg-violet-400">Enter OTP</button><button type="button" disabled={resending} onClick={() => void resendOtp()} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold hover:bg-white/10 disabled:opacity-50">{resending ? "Sending…" : "Resend OTP"}</button></div>{resendMessage && <p role="status" className="mt-3 text-sm text-amber-100">{resendMessage}</p>}</div>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="app-button-primary w-full rounded-xl px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-400">
        Do not have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-violet-400 hover:text-violet-300"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}
