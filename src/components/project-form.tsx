"use client";
import { authFetch as fetch } from "@/lib/auth-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  createProjectSchema,
  type CreateProjectInput,
} from "@/lib/validations/project";

export function ProjectForm({ workspaceSlug }: { workspaceSlug: string }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectInput>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: { name: "", description: "" },
  });

  async function onSubmit(data: CreateProjectInput) {
    setServerError(null);

    try {
      const response = await fetch(
        `/api/workspaces/${workspaceSlug}/projects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
      );
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setServerError(result.error ?? "Unable to create the project.");
        return;
      }

      reset();
      router.refresh();
    } catch {
      setServerError("Unable to connect to the server. Please try again.");
    }
  }

  const fieldClassName =
    "w-full rounded-xl border border-white/15 bg-slate-950/60 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10";

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 space-y-4">
      <div>
        <label htmlFor="project-name" className="mb-2 block text-sm font-medium text-slate-200">Project name</label>
        <input id="project-name" type="text" placeholder="Website launch" className={fieldClassName} {...register("name")} />
        {errors.name && <p className="mt-2 text-sm text-red-400">{errors.name.message}</p>}
      </div>
      <div>
        <label htmlFor="project-description" className="mb-2 block text-sm font-medium text-slate-200">Description <span className="text-slate-500">(optional)</span></label>
        <textarea id="project-description" rows={3} placeholder="What is this project for?" className={`${fieldClassName} resize-none`} {...register("description")} />
        {errors.description && <p className="mt-2 text-sm text-red-400">{errors.description.message}</p>}
      </div>
      {serverError && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{serverError}</div>}
      <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "Creating project..." : "Create project"}
      </button>
    </form>
  );
}
