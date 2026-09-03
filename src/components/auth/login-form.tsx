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

export function LoginForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

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
      };

      if (!response.ok) {
        setServerError(
          result.error ?? "Unable to sign in.",
        );
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setServerError(
        "Unable to connect to the server. Please try again.",
      );
    }
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
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