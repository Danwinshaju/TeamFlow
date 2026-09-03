import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { projects, tasks, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { taskPriorities, taskStatuses } from "@/lib/validations/task";

export const metadata = { title: "My Tasks" };

type MyTasksPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    priority?: string | string[];
  }>;
};

export default async function MyTasksPage({ searchParams }: MyTasksPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const parameters = await searchParams;
  const requestedStatus = typeof parameters.status === "string" ? parameters.status : "open";
  const requestedPriority = typeof parameters.priority === "string" ? parameters.priority : "all";
  const status = requestedStatus === "all" || requestedStatus === "open" || taskStatuses.includes(requestedStatus as (typeof taskStatuses)[number]) ? requestedStatus : "open";
  const priority = requestedPriority === "all" || taskPriorities.includes(requestedPriority as (typeof taskPriorities)[number]) ? requestedPriority : "all";

  const assignedTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueAt: tasks.dueAt,
      projectId: projects.id,
      projectName: projects.name,
      projectKey: projects.key,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(workspaces, eq(tasks.workspaceId, workspaces.id))
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, tasks.workspaceId),
        eq(workspaceMembers.userId, currentUser.id),
      ),
    )
    .where(eq(tasks.assigneeId, currentUser.id))
    .orderBy(asc(tasks.dueAt), asc(tasks.createdAt));

  const filteredTasks = assignedTasks.filter((task) => {
    const statusMatches = status === "all" || (status === "open" ? task.status !== "done" : task.status === status);
    const priorityMatches = priority === "all" || task.priority === priority;
    return statusMatches && priorityMatches;
  });

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="text-xl font-bold">Team<span className="text-violet-400">Flow</span></Link>
          <Link href="/dashboard" className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">Back to dashboard</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm font-medium text-violet-400">Personal overview</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">My tasks</h1>
        <p className="mt-3 text-slate-400">Everything assigned to you across your workspaces.</p>

        <form className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <label htmlFor="status" className="mb-2 block text-sm text-slate-300">Status</label>
            <select id="status" name="status" defaultValue={status} className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm outline-none">
              <option value="open">Open tasks</option><option value="all">All statuses</option><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
            </select>
          </div>
          <div>
            <label htmlFor="priority" className="mb-2 block text-sm text-slate-300">Priority</label>
            <select id="priority" name="priority" defaultValue={priority} className="w-full rounded-xl border border-white/15 bg-slate-950 px-3 py-2.5 text-sm outline-none">
              <option value="all">All priorities</option><option value="urgent">Urgent</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
            </select>
          </div>
          <button className="self-end rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold transition hover:bg-violet-400">Apply filters</button>
        </form>

        <div className="mt-8 flex items-center justify-between"><h2 className="text-xl font-semibold">Assigned work</h2><span className="text-sm text-slate-400">{filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}</span></div>

        {filteredTasks.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-white/15 px-6 py-14 text-center"><p className="font-medium text-slate-300">No tasks match these filters.</p><p className="mt-2 text-sm text-slate-500">Try another status or priority.</p></div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTasks.map((task) => (
              <Link key={task.id} href={`/workspaces/${task.workspaceSlug}/projects/${task.projectId}/tasks/${task.id}`} className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-violet-400/40 hover:bg-white/[0.07]">
                <div className="flex items-start justify-between gap-3"><h3 className="font-semibold transition group-hover:text-violet-300">{task.title}</h3><span className={`text-xs font-semibold capitalize ${priorityColor(task.priority)}`}>{task.priority}</span></div>
                {task.description && <p className="mt-2 line-clamp-2 text-sm text-slate-400">{task.description}</p>}
                <div className="mt-5 space-y-1 text-xs text-slate-500"><p>{task.workspaceName} · {task.projectKey}</p><p className="capitalize">{task.status.replace("_", " ")}</p><p className={isOverdue(task.dueAt, task.status) ? "text-red-300" : ""}>{task.dueAt ? `Due ${formatDate(task.dueAt)}` : "No due date"}</p></div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function priorityColor(priority: (typeof taskPriorities)[number]) {
  if (priority === "urgent") return "text-red-300";
  if (priority === "high") return "text-orange-300";
  if (priority === "medium") return "text-amber-300";
  return "text-emerald-300";
}

function isOverdue(dueAt: Date | null, status: (typeof taskStatuses)[number]) {
  return Boolean(dueAt && status !== "done" && dueAt.getTime() < Date.now());
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric" }).format(value);
}
