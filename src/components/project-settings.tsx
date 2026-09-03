"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ProjectSettings({ apiUrl, initialName, initialDescription, initialStatus }: { apiUrl: string; initialName: string; initialDescription: string | null; initialStatus: "active" | "archived" }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldClassName = "w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm outline-none transition focus:border-violet-400";

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(null); setError(null);
    try {
      const response = await fetch(apiUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description, status }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) { setError(result.error ?? "Unable to update the project."); return; }
      setMessage("Project settings updated."); router.refresh();
    } catch { setError("Unable to connect to the server."); } finally { setSaving(false); }
  }

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6"><h2 className="text-xl font-semibold">Project settings</h2><p className="mt-1 text-sm text-slate-400">Update project information or archive this project.</p><form onSubmit={save} className="mt-5 grid gap-4 sm:grid-cols-2"><div><label htmlFor="project-settings-name" className="mb-2 block text-sm text-slate-300">Name</label><input id="project-settings-name" value={name} onChange={(event) => setName(event.target.value)} className={fieldClassName} minLength={2} maxLength={100} required /></div><div><label htmlFor="project-settings-status" className="mb-2 block text-sm text-slate-300">Status</label><select id="project-settings-status" value={status} onChange={(event) => setStatus(event.target.value as "active" | "archived")} className={fieldClassName}><option value="active">Active</option><option value="archived">Archived</option></select></div><div className="sm:col-span-2"><label htmlFor="project-settings-description" className="mb-2 block text-sm text-slate-300">Description</label><textarea id="project-settings-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={3} maxLength={1000} className={`${fieldClassName} resize-y`} /></div>{message && <p className="text-sm text-emerald-300 sm:col-span-2">{message}</p>}{error && <p role="alert" className="text-sm text-red-300 sm:col-span-2">{error}</p>}<button disabled={saving} className="rounded-xl bg-violet-500 px-5 py-3 font-semibold disabled:opacity-60 sm:col-span-2">{saving ? "Saving..." : "Save project settings"}</button></form></section>
  );
}
