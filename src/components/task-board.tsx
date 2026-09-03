"use client";

import Link from "next/link";
import { useState } from "react";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high" | "urgent";
type WorkspaceRole = "owner" | "admin" | "member";

type BoardTask = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName: string | null;
  dueAt: string | null;
  createdByUserId: string;
};

type Member = { id: string; name: string; email: string };

type TaskBoardProps = {
  workspaceSlug: string;
  projectId: string;
  initialTasks: BoardTask[];
  members: Member[];
  currentUserId: string;
  currentUserRole: WorkspaceRole;
};

const columns: Array<{ status: TaskStatus; label: string }> = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "done", label: "Done" },
];

export function TaskBoard({
  workspaceSlug,
  projectId,
  initialTasks,
  members,
  currentUserId,
  currentUserRole,
}: TaskBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("todo");
  const [editPriority, setEditPriority] = useState<TaskPriority>("medium");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | TaskPriority>("all");

  const apiBase = `/api/workspaces/${workspaceSlug}/projects/${projectId}/tasks`;

  async function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsCreating(true);

    try {
      const response = await fetch(apiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priority,
          assigneeId,
          dueDate,
        }),
      });
      const result = (await response.json()) as {
        task?: BoardTask;
        error?: string;
      };

      if (!response.ok || !result.task) {
        setError(result.error ?? "Unable to create the task.");
        return;
      }

      setTasks((current) => [...current, result.task!]);
      setTitle("");
      setDescription("");
      setPriority("medium");
      setAssigneeId("");
      setDueDate("");
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setIsCreating(false);
    }
  }

  async function moveTask(taskId: string, status: TaskStatus) {
    setError(null);
    setMovingId(taskId);

    try {
      const response = await fetch(`${apiBase}/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to move the task.");
        return;
      }

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId ? { ...task, status } : task,
        ),
      );
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setMovingId(null);
    }
  }

  async function assignTask(taskId: string, nextAssigneeId: string) {
    setError(null);
    setMovingId(taskId);
    try {
      const response = await fetch(`${apiBase}/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: nextAssigneeId }),
      });
      const result = (await response.json()) as { task?: BoardTask; error?: string };
      if (!response.ok || !result.task) {
        setError(result.error ?? "Unable to assign the task.");
        return;
      }
      setTasks((current) => current.map((task) => task.id === taskId ? result.task! : task));
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setMovingId(null);
    }
  }

  function beginEditing(task: BoardTask) {
    setError(null);
    setEditingId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description ?? "");
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditAssigneeId(task.assigneeId ?? "");
    setEditDueDate(task.dueAt?.slice(0, 10) ?? "");
  }

  async function saveTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    setError(null);
    setMovingId(editingId);

    try {
      const response = await fetch(`${apiBase}/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          status: editStatus,
          priority: editPriority,
          assigneeId: editAssigneeId,
          dueDate: editDueDate,
        }),
      });
      const result = (await response.json()) as { task?: BoardTask; error?: string };

      if (!response.ok || !result.task) {
        setError(result.error ?? "Unable to update the task.");
        return;
      }

      setTasks((current) =>
        current.map((task) => task.id === editingId ? result.task! : task),
      );
      setEditingId(null);
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setMovingId(null);
    }
  }

  async function deleteTask(task: BoardTask) {
    const confirmed = window.confirm(
      `Permanently delete “${task.title}”? This cannot be undone.`,
    );
    if (!confirmed) return;

    setError(null);
    setDeletingId(task.id);
    try {
      const response = await fetch(`${apiBase}/${task.id}`, { method: "DELETE" });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? "Unable to delete the task.");
        return;
      }

      setTasks((current) => current.filter((item) => item.id !== task.id));
      if (editingId === task.id) setEditingId(null);
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setDeletingId(null);
    }
  }

  const fieldClassName =
    "w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10";

  return (
    <div className="mt-10">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-xl font-semibold">Create task</h2>
        <form onSubmit={createTask} className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <label htmlFor="task-title" className="mb-2 block text-sm text-slate-300">Title</label>
            <input id="task-title" value={title} onChange={(event) => setTitle(event.target.value)} className={fieldClassName} placeholder="Prepare launch checklist" required />
          </div>
          <div>
            <label htmlFor="task-assignee" className="mb-2 block text-sm text-slate-300">Assignee</label>
            <select id="task-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={fieldClassName}>
              <option value="">Unassigned</option>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label htmlFor="task-description" className="mb-2 block text-sm text-slate-300">Description</label>
            <textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} className={`${fieldClassName} resize-none`} rows={2} placeholder="Add details (optional)" />
          </div>
          <div>
            <label htmlFor="task-priority" className="mb-2 block text-sm text-slate-300">Priority</label>
            <select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)} className={fieldClassName}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <label htmlFor="task-due-date" className="mb-2 block text-sm text-slate-300">Due date</label>
            <input id="task-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={fieldClassName} />
          </div>
          {error && <div role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300 lg:col-span-2">{error}</div>}
          <button type="submit" disabled={isCreating} className="rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:opacity-60 lg:col-span-2">
            {isCreating ? "Creating task..." : "Create task"}
          </button>
        </form>
      </section>

      {editingId && (
        <section className="mt-6 rounded-2xl border border-violet-400/30 bg-violet-400/5 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Edit task</h2>
            <button type="button" onClick={() => setEditingId(null)} className="text-sm text-slate-400 transition hover:text-white">Cancel</button>
          </div>
          <form onSubmit={saveTask} className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="edit-task-title" className="mb-2 block text-sm text-slate-300">Title</label>
              <input id="edit-task-title" value={editTitle} onChange={(event) => setEditTitle(event.target.value)} className={fieldClassName} required />
            </div>
            <div>
              <label htmlFor="edit-task-assignee" className="mb-2 block text-sm text-slate-300">Assignee</label>
              <select id="edit-task-assignee" value={editAssigneeId} onChange={(event) => setEditAssigneeId(event.target.value)} className={fieldClassName}>
                <option value="">Unassigned</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="edit-task-description" className="mb-2 block text-sm text-slate-300">Description</label>
              <textarea id="edit-task-description" value={editDescription} onChange={(event) => setEditDescription(event.target.value)} className={`${fieldClassName} resize-none`} rows={2} />
            </div>
            <div>
              <label htmlFor="edit-task-status" className="mb-2 block text-sm text-slate-300">Status</label>
              <select id="edit-task-status" value={editStatus} onChange={(event) => setEditStatus(event.target.value as TaskStatus)} className={fieldClassName}>
                {columns.map((option) => <option key={option.status} value={option.status}>{option.label}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="edit-task-priority" className="mb-2 block text-sm text-slate-300">Priority</label>
              <select id="edit-task-priority" value={editPriority} onChange={(event) => setEditPriority(event.target.value as TaskPriority)} className={fieldClassName}>
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="lg:col-span-2">
              <label htmlFor="edit-task-due-date" className="mb-2 block text-sm text-slate-300">Due date</label>
              <input id="edit-task-due-date" type="date" value={editDueDate} onChange={(event) => setEditDueDate(event.target.value)} className={fieldClassName} />
            </div>
            <button type="submit" disabled={movingId === editingId} className="rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 disabled:opacity-60 lg:col-span-2">
              {movingId === editingId ? "Saving changes..." : "Save changes"}
            </button>
          </form>
        </section>
      )}

      <section className="mt-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Project board</h2>
            <p className="mt-1 text-sm text-slate-400">Move work through each stage.</p>
          </div>
          <span className="text-sm text-slate-400">
            {tasks.length} {tasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_180px]">
          <input aria-label="Search tasks" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
          <select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as "all" | TaskPriority)} className="rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm outline-none focus:border-violet-400">
            <option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
          </select>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          {columns.map((column) => {
            const query = search.trim().toLowerCase();
            const columnTasks = tasks.filter((task) => task.status === column.status && (!query || `${task.title} ${task.description ?? ""} ${task.assigneeName ?? ""}`.toLowerCase().includes(query)) && (priorityFilter === "all" || task.priority === priorityFilter));
            return (
              <div key={column.status} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{column.label}</h3>
                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-slate-300">{columnTasks.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {columnTasks.length === 0 && <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-slate-600">No tasks</p>}
                  {columnTasks.map((task) => (
                    <article key={task.id} className="rounded-xl border border-white/10 bg-slate-900 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <Link href={`/workspaces/${workspaceSlug}/projects/${projectId}/tasks/${task.id}`} className="font-medium transition hover:text-violet-300">{task.title}</Link>
                        <span className={`text-xs font-semibold capitalize ${priorityColor(task.priority)}`}>{task.priority}</span>
                      </div>
                      {task.description && <p className="mt-2 text-sm text-slate-400">{task.description}</p>}
                      <div className="mt-3 space-y-1 text-xs text-slate-500">
                        <p>{task.assigneeName ?? "Unassigned"}</p>
                        {task.dueAt && <p>Due {formatDate(task.dueAt)}</p>}
                      </div>
                      <select aria-label={`Assign ${task.title}`} value={task.assigneeId ?? ""} disabled={movingId === task.id} onChange={(event) => void assignTask(task.id, event.target.value)} className="mt-3 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs outline-none">
                        <option value="">Unassigned</option>
                        {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                      </select>
                      <select
                        aria-label={`Move ${task.title}`}
                        value={task.status}
                        disabled={movingId === task.id}
                        onChange={(event) => void moveTask(task.id, event.target.value as TaskStatus)}
                        className="mt-4 w-full rounded-lg border border-white/10 bg-slate-950 px-2 py-2 text-xs outline-none"
                      >
                        {columns.map((option) => <option key={option.status} value={option.status}>{option.label}</option>)}
                      </select>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={() => beginEditing(task)} className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">Edit</button>
                        {(currentUserRole === "owner" || currentUserRole === "admin" || task.createdByUserId === currentUserId) && (
                          <button type="button" disabled={deletingId === task.id} onClick={() => void deleteTask(task)} className="flex-1 rounded-lg border border-red-400/20 px-3 py-2 text-xs font-medium text-red-300 transition hover:bg-red-400/10 disabled:opacity-60">
                            {deletingId === task.id ? "Deleting..." : "Delete"}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function priorityColor(priority: TaskPriority) {
  if (priority === "urgent") return "text-red-300";
  if (priority === "high") return "text-orange-300";
  if (priority === "medium") return "text-amber-300";
  return "text-emerald-300";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
