"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createInvitationSchema,
  type CreateInvitationInput,
} from "@/lib/validations/invitation";

type WorkspaceInvitationFormProps = {
  workspaceSlug: string;
};

export function WorkspaceInvitationForm({
  workspaceSlug,
}: WorkspaceInvitationFormProps) {
  const router = useRouter();

  const [serverError, setServerError] =
    useState<string | null>(null);

  const [successMessage, setSuccessMessage] =
    useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: {
      errors,
      isSubmitting,
    },
  } = useForm<CreateInvitationInput>({
    resolver: zodResolver(createInvitationSchema),
    defaultValues: {
      email: "",
      role: "member",
    },
  });

  async function onSubmit(
    data: CreateInvitationInput,
  ) {
    setServerError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/invitations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        },
      );

      const result = (await response.json()) as {
        message?: string;
        error?: string;
      };

      if (!response.ok) {
        setServerError(
          result.error ??
            "Unable to send the invitation.",
        );

        return;
      }

      reset();

      setSuccessMessage(
        result.message ??
          "Invitation sent successfully.",
      );

      router.refresh();
    } catch {
      setServerError(
        "Unable to connect to the server. Please try again.",
      );
    }
  }

  const inputClassName =
    "w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10";

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="mt-6 space-y-4"
    >
      <div>
        <label
          htmlFor="invitation-email"
          className="mb-2 block text-sm font-medium text-slate-200"
        >
          Email address
        </label>

        <input
          id="invitation-email"
          type="email"
          autoComplete="email"
          placeholder="member@company.com"
          className={inputClassName}
          {...register("email")}
        />

        {errors.email && (
          <p className="mt-2 text-sm text-red-400">
            {errors.email.message}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor="invitation-role"
          className="mb-2 block text-sm font-medium text-slate-200"
        >
          Workspace role
        </label>

        <select
          id="invitation-role"
          className={inputClassName}
          {...register("role")}
        >
          <option value="member">
            Member
          </option>

          <option value="admin">
            Admin
          </option>
        </select>

        {errors.role && (
          <p className="mt-2 text-sm text-red-400">
            {errors.role.message}
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

      {successMessage && (
        <div
          role="status"
          className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300"
        >
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting
          ? "Sending invitation..."
          : "Send invitation"}
      </button>
    </form>
  );
}