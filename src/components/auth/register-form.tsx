"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  registerSchema,
  type RegisterInput,
} from "@/lib/validations/auth";

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const {
    register,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      jobTitle: "",
      bio: "",
      avatarDataUrl: "",
      password: "",
      confirmPassword: "",
      acceptTerms: false,
    },
  });

  async function onSubmit(data: RegisterInput) {
    setServerError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as {
        error?: string;
        developmentVerificationCode?: string;
      };

      if (!response.ok) {
        setServerError(
          result.error ?? "Unable to create your account.",
        );
        return;
      }

      const verificationUrl = new URL("/verify-email", window.location.origin);
      verificationUrl.searchParams.set("registered", "true");
      verificationUrl.searchParams.set("email", data.email.trim().toLowerCase());
      window.localStorage.setItem("teamflow_pending_verification_email", data.email.trim().toLowerCase());
      router.push(verificationUrl.pathname + verificationUrl.search);
    } catch {
      setServerError(
        "Unable to connect to the server. Please try again.",
      );
    }
  }

  function chooseAvatar(file: File | null) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 1_000_000) {
      setServerError("Choose a PNG, JPEG, or WebP profile image smaller than 1 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const image = typeof reader.result === "string" ? reader.result : "";
      setAvatarPreview(image);
      setValue("avatarDataUrl", image, { shouldValidate: true });
    };
    reader.readAsDataURL(file);
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
            aria-describedby={errors.name ? "name-error" : undefined}
            className={inputClassName}
            {...register("name")}
          />

          <ErrorMessage
            id="name-error"
            message={errors.name?.message}
          />
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="font-medium text-slate-100">Profile details</p>
          <p className="mt-1 text-sm text-slate-400">Help your teammates recognize you. These details can be changed later.</p>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-violet-500/20 text-xl font-bold text-violet-200">{avatarPreview ? <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" /> : "?"}</div>
            <label className="cursor-pointer rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/10">Add profile photo<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => chooseAvatar(event.target.files?.[0] ?? null)} /></label>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div><label htmlFor="job-title" className="mb-2 block text-sm font-medium text-slate-200">Job title</label><input id="job-title" type="text" placeholder="Product designer" className={inputClassName} {...register("jobTitle")} /><ErrorMessage id="job-title-error" message={errors.jobTitle?.message} /></div>
            <div><label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-200">Phone number <span className="text-slate-500">(optional)</span></label><input id="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" className={inputClassName} {...register("phone")} /><ErrorMessage id="phone-error" message={errors.phone?.message} /></div>
          </div>
          <div className="mt-4"><label htmlFor="bio" className="mb-2 block text-sm font-medium text-slate-200">Short bio <span className="text-slate-500">(optional)</span></label><textarea id="bio" rows={3} maxLength={500} placeholder="Tell your team what you work on." className={inputClassName} {...register("bio")} /><ErrorMessage id="bio-error" message={errors.bio?.message} /></div>
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
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClassName}
            {...register("email")}
          />

          <ErrorMessage
            id="email-error"
            message={errors.email?.message}
          />
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
            aria-describedby={
              errors.password ? "password-error" : undefined
            }
            className={inputClassName}
            {...register("password")}
          />

          <ErrorMessage
            id="password-error"
            message={errors.password?.message}
          />
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
            aria-describedby={
              errors.confirmPassword
                ? "confirm-password-error"
                : undefined
            }
            className={inputClassName}
            {...register("confirmPassword")}
          />

          <ErrorMessage
            id="confirm-password-error"
            message={errors.confirmPassword?.message}
          />
        </div>

        <div>
          <label className="flex items-start gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              aria-invalid={Boolean(errors.acceptTerms)}
              aria-describedby={
                errors.acceptTerms ? "terms-error" : undefined
              }
              className="mt-1 h-4 w-4 accent-violet-500"
              {...register("acceptTerms")}
            />

            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                className="text-violet-400 hover:underline"
              >
                Terms
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="text-violet-400 hover:underline"
              >
                Privacy Policy
              </Link>
            </span>
          </label>

          <ErrorMessage
            id="terms-error"
            message={errors.acceptTerms?.message}
          />
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
  id: string;
  message?: string;
};

function ErrorMessage({ id, message }: ErrorMessageProps) {
  if (!message) {
    return null;
  }

  return (
    <p id={id} className="mt-2 text-sm text-red-400">
      {message}
    </p>
  );
}
