"use client";
import { authFetch as fetch } from "@/lib/auth-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
} from "@/lib/validations/workspace";

export function WorkspaceForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(data: CreateWorkspaceInput) {
    setServerError(null);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as {
        error?: string;
        workspace?: { slug: string };
      };

      if (!response.ok) {
        setServerError(result.error ?? "Unable to create the workspace.");
        return;
      }

      if (!result.workspace?.slug) {
        setServerError("Workspace created, but it could not be opened.");
        return;
      }
      reset();
      router.push(`/workspaces/${result.workspace.slug}`);
      router.refresh();
    } catch {
      setServerError("Unable to connect to the server. Please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-6 max-w-xl">
      <label htmlFor="workspace-name" className="mb-2 block text-sm font-medium text-slate-200">
        Workspace name
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="workspace-name"
          type="text"
          autoComplete="organization"
          placeholder="Acme product team"
          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10"
          {...register("name")}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "Creating..." : "Create workspace"}
        </button>
      </div>
      {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
      {serverError && <div role="alert" className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{serverError}</div>}
    </form>
  );
}
