"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/validations/auth";

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(
    token ? null : "This password reset link is incomplete.",
  );
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: token ?? "",
      password: "",
      confirmPassword: "",
    },
  });

  async function onSubmit(data: ResetPasswordInput) {
    setMessage(null);
    setServerError(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setServerError(result.error ?? "Unable to reset your password.");
        return;
      }

      setMessage(result.message ?? "Password updated.");
    } catch {
      setServerError("Unable to connect to the server. Please try again.");
    }
  }

  const inputClassName =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Reset your password</h1>
      <p className="mt-3 text-slate-400">Choose a strong new password for your TeamFlow account.</p>
      {message ? (
        <div className="mt-8">
          <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{message}</div>
          <Link href="/login" className="mt-5 block rounded-xl bg-violet-500 px-5 py-3 text-center font-semibold hover:bg-violet-400">Continue to sign in</Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
          <input type="hidden" {...register("token")} />
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-200">New password</label>
            <input id="password" type="password" autoComplete="new-password" className={inputClassName} {...register("password")} />
            {errors.password && <p className="mt-2 text-sm text-red-400">{errors.password.message}</p>}
          </div>
          <div>
            <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-200">Confirm new password</label>
            <input id="confirmPassword" type="password" autoComplete="new-password" className={inputClassName} {...register("confirmPassword")} />
            {errors.confirmPassword && <p className="mt-2 text-sm text-red-400">{errors.confirmPassword.message}</p>}
          </div>
          {serverError && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{serverError}</div>}
          <button type="submit" disabled={!token || isSubmitting} className="w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Updating..." : "Update password"}</button>
        </form>
      )}
      <p className="mt-7 text-center text-sm text-slate-400"><Link href="/login" className="font-semibold text-violet-400 hover:text-violet-300">Return to sign in</Link></p>
    </div>
  );
}
