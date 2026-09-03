"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";

type TaskDetailsPanelProps = {
  apiBase: string;
  task: {
    id: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    assigneeId: string | null;
    dueAt: string | null;
  };
  members: Array<{ id: string; name: string }>;
  comments: Array<{
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
  }>;
};

export function TaskDetailsPanel({ apiBase, task, members, comments: initialComments }: TaskDetailsPanelProps) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(task.dueAt?.slice(0, 10) ?? "");
  const [comments, setComments] = useState(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fieldClassName = "w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10";

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSaving(true);
    try {
      const response = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, status, priority, assigneeId, dueDate }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to save the task.");
        return;
      }
      setMessage("Task updated.");
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setIsSaving(false);
    }
  }

  async function addComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsCommenting(true);
    try {
      const response = await fetch(`${apiBase}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: commentBody }),
      });
      const result = (await response.json()) as {
        comment?: { id: string; body: string; authorName: string; createdAt: string };
        error?: string;
      };
      if (!response.ok || !result.comment) {
        setError(result.error ?? "Unable to add the comment.");
        return;
      }
      setComments((current) => [...current, result.comment!]);
      setCommentBody("");
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setIsCommenting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Task details</h2>
          <form onSubmit={saveTask} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label htmlFor="details-title" className="mb-2 block text-sm text-slate-300">Title</label><input id="details-title" value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClassName} required /></div>
            <div className="sm:col-span-2"><label htmlFor="details-description" className="mb-2 block text-sm text-slate-300">Description</label><textarea id="details-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={5} className={`${fieldClassName} resize-y`} placeholder="Add task details" /></div>
            <div><label htmlFor="details-status" className="mb-2 block text-sm text-slate-300">Status</label><select id="details-status" value={status} onChange={(event) => setStatus(event.target.value as TaskStatus)} className={fieldClassName}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></div>
            <div><label htmlFor="details-priority" className="mb-2 block text-sm text-slate-300">Priority</label><select id="details-priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className={fieldClassName}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
            <div><label htmlFor="details-assignee" className="mb-2 block text-sm text-slate-300">Assignee</label><select id="details-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={fieldClassName}><option value="">Unassigned</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></div>
            <div><label htmlFor="details-due" className="mb-2 block text-sm text-slate-300">Due date</label><input id="details-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={fieldClassName} /></div>
            {message && <p className="text-sm text-emerald-300 sm:col-span-2">{message}</p>}
            {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 sm:col-span-2">{error}</p>}
            <button disabled={isSaving} className="rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:opacity-60 sm:col-span-2">{isSaving ? "Saving..." : "Save task"}</button>
          </form>
        </section>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Comments</h2>
        <div className="mt-5 max-h-[420px] space-y-3 overflow-y-auto">
          {comments.length === 0 && <p className="text-sm text-slate-500">No comments yet.</p>}
          {comments.map((comment) => <article key={comment.id} className="rounded-xl border border-white/10 bg-slate-950/60 p-4"><div className="flex justify-between gap-3 text-xs"><span className="font-medium text-slate-300">{comment.authorName}</span><time className="text-slate-600">{formatDateTime(comment.createdAt)}</time></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-400">{comment.body}</p></article>)}
        </div>
        <form onSubmit={addComment} className="mt-5">
          <label htmlFor="new-comment" className="mb-2 block text-sm text-slate-300">Add a comment</label>
          <textarea id="new-comment" value={commentBody} onChange={(event) => setCommentBody(event.target.value)} rows={3} maxLength={2000} className={`${fieldClassName} resize-y`} required />
          <button disabled={isCommenting} className="mt-3 w-full rounded-xl border border-violet-400/40 bg-violet-400/10 px-4 py-2.5 text-sm font-semibold text-violet-200 transition hover:bg-violet-400/20 disabled:opacity-60">{isCommenting ? "Adding..." : "Add comment"}</button>
        </form>
      </section>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
