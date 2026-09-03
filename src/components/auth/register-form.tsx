"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registerSchema,
  type RegisterInput,
} from "@/lib/validations/auth";

export function RegisterForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  async function onSubmit(data: RegisterInput) {
    console.log("Validated registration:", data);
  }

  const inputClassName =
    "w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10";

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight">
        Create your account
      </h1>

      <p className="mt-3 text-slate-400">
        Start building a better workflow for your team.
      </p>

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="mt-8 space-y-5"
      >
        <div>
          <label
            htmlFor="name"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Full name
          </label>

          <input
            id="name"
            type="text"
            autoComplete="name"
            placeholder="Your name"
            aria-invalid={Boolean(errors.name)}
            className={inputClassName}
            {...register("name")}
          />

          <ErrorMessage message={errors.name?.message} />
        </div>

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
            className={inputClassName}
            {...register("email")}
          />

          <ErrorMessage message={errors.email?.message} />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Password
          </label>

          <input
            id="password"
            type="password"
            autoComplete="new-password"
            placeholder="Create a strong password"
            aria-invalid={Boolean(errors.password)}
            className={inputClassName}
            {...register("password")}
          />

          <ErrorMessage message={errors.password?.message} />
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Confirm password
          </label>

          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="Enter your password again"
            aria-invalid={Boolean(errors.confirmPassword)}
            className={inputClassName}
            {...register("confirmPassword")}
          />

          <ErrorMessage message={errors.confirmPassword?.message} />
        </div>

        <div>
          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-violet-500"
              {...register("acceptTerms")}
            />

            <span>
              I agree to the{" "}
              <Link href="/terms" className="text-violet-400 hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-violet-400 hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>

          <ErrorMessage message={errors.acceptTerms?.message} />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-400">
        Already have an account?{" "}
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

type ErrorMessageProps = {
  message?: string;
};

function ErrorMessage({ message }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return <p className="mt-2 text-sm text-red-400">{message}</p>;
}