"use client";

import Link from "next/link";
import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

type Project = { id: string; name: string; status: "active" | "archived" };
type Member = { id: string; name: string; email: string };
type Priority = "low" | "medium" | "high" | "urgent";

export function WorkspaceTaskAssigner({ workspaceSlug, projects, members }: { workspaceSlug: string; projects: Project[]; members: Member[] }) {
  const activeProjects = projects.filter((project) => project.status === "active");
  const [projectId, setProjectId] = useState(activeProjects[0]?.id || "");
  const [assigneeId, setAssigneeId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [createdProjectId, setCreatedProjectId] = useState("");
  const field = "mt-2 w-full rounded-xl border border-white/15 bg-slate-950/70 px-4 py-3 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10";

  async function assign(event: React.FormEvent) {
    event.preventDefault();
    const form = new FormData(event.currentTarget as HTMLFormElement);
    const selectedProjectId = String(form.get("projectId") || projectId);
    const selectedAssigneeId = String(form.get("assigneeId") || assigneeId);
    if (!selectedProjectId || !selectedAssigneeId) { setMessage("Choose a project and the person responsible for this task."); return; }
    setSubmitting(true); setMessage(""); setCreatedProjectId("");
    try {
      const response = await authFetch(`/api/workspaces/${workspaceSlug}/projects/${selectedProjectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, priority, assigneeId: selectedAssigneeId, dueDate }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setMessage(result.error || "Unable to assign the task."); return; }
      const assignee = members.find((member) => member.id === selectedAssigneeId);
      setMessage(`Task assigned successfully to ${assignee?.name || "the selected member"}. They have also received a private message.`);
      setCreatedProjectId(selectedProjectId); setTitle(""); setDescription(""); setPriority("medium"); setDueDate("");
    } catch { setMessage("Unable to connect to TeamFlow. Please try again."); }
    finally { setSubmitting(false); }
  }

  return <section id="assign-task" className="app-panel mb-6 scroll-mt-24 overflow-hidden rounded-3xl border-violet-400/20 p-6 sm:p-7">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Manager actions</p><h2 className="mt-2 text-2xl font-bold">Assign work to your team</h2><p className="mt-2 text-sm text-slate-400">Choose a workspace member, project, priority and deadline.</p></div><span className="w-fit rounded-full bg-violet-400/10 px-3 py-1.5 text-xs font-semibold text-violet-300">Owner & Admin</span></div>
    {activeProjects.length === 0 ? <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-5"><p className="font-semibold text-amber-200">Create an active project first</p><p className="mt-1 text-sm text-slate-400">Tasks must belong to a project. Use the Create project form below, then this assignment form will appear automatically.</p><a href="#project-rooms" className="mt-4 inline-block rounded-xl bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950">Create a project</a></div> : <form onSubmit={assign} className="mt-6 grid gap-4 lg:grid-cols-2">
      <label className="text-sm font-medium">Task title<input required maxLength={160} value={title} onChange={(event) => setTitle(event.target.value)} className={field} placeholder="Prepare the client presentation" /></label>
      <label className="text-sm font-medium">Assign to<select name="assigneeId" required value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={field}><option value="">Choose a team member</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label>
      <label className="text-sm font-medium">Project<select name="projectId" required value={projectId} onChange={(event) => setProjectId(event.target.value)} className={field}>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
      <label className="text-sm font-medium">Priority<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className={field}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
      <label className="text-sm font-medium lg:col-span-2">Description<textarea rows={3} maxLength={2000} value={description} onChange={(event) => setDescription(event.target.value)} className={`${field} resize-y`} placeholder="Explain the expected result and important details." /></label>
      <label className="text-sm font-medium">Due date<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} min={new Date().toISOString().slice(0, 10)} className={field} /></label>
      <div className="flex items-end"><button disabled={submitting} className="w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:opacity-50">{submitting ? "Assigning…" : "Assign task"}</button></div>
      {message && <div role="status" className={`rounded-xl border px-4 py-3 text-sm lg:col-span-2 ${createdProjectId ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200" : "border-amber-400/20 bg-amber-400/10 text-amber-200"}`}>{message}{createdProjectId && <Link href={`/workspaces/${workspaceSlug}/projects/${createdProjectId}`} className="ml-2 font-semibold underline">Open project board</Link>}</div>}
    </form>}
  </section>;
}
