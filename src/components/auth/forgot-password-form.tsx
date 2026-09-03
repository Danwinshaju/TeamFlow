"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ForgotPasswordInput) {
    setMessage(null);
    setServerError(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setServerError(result.error ?? "Unable to request a reset link.");
        return;
      }

      setMessage(result.message ?? "Check your email for a reset link.");
    } catch {
      setServerError("Unable to connect to the server. Please try again.");
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">Forgot password?</h1>
      <p className="mt-3 text-slate-400">
        Enter your email and we will send you a secure reset link.
      </p>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-200">Email address</label>
          <input id="email" type="email" autoComplete="email" placeholder="you@company.com" className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10" {...register("email")} />
          {errors.email && <p className="mt-2 text-sm text-red-400">{errors.email.message}</p>}
        </div>
        {serverError && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{serverError}</div>}
        {message && <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">{message}</div>}
        <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60">{isSubmitting ? "Sending..." : "Send reset link"}</button>
      </form>
      <p className="mt-7 text-center text-sm text-slate-400"><Link href="/login" className="font-semibold text-violet-400 hover:text-violet-300">Return to sign in</Link></p>
    </div>
  );
}
