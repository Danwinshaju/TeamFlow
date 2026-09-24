import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";

import { TaskDetailsPanel } from "@/components/task-details-panel";
import { db } from "@/db";
import { projects, taskActivities, taskComments, tasks, users, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { hasPaidWorkspaceAccess } from "@/lib/billing/access";

export const metadata = { title: "Task details" };

type TaskPageProps = {
  params: Promise<{ slug: string; projectId: string; taskId: string }>;
};

export default async function TaskPage({ params }: TaskPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { slug, projectId, taskId } = await params;
  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      dueAt: tasks.dueAt,
      createdAt: tasks.createdAt,
      projectName: projects.name,
      projectKey: projects.key,
      projectStatus: projects.status,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      memberRole: workspaceMembers.role,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, currentUser.id)))
    .where(and(eq(tasks.id, taskId), eq(projects.id, projectId), eq(workspaces.slug, slug)))
    .limit(1);

  if (!task) notFound();

  if (task.memberRole === "member" && task.assigneeId !== currentUser.id) notFound();

  if (!(await hasPaidWorkspaceAccess(currentUser.id, slug))) redirect(task.memberRole === "owner" ? "/onboarding/billing?required=true" : "/dashboard?workspace=paused");

  const [members, comments, activities] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(workspaceMembers).innerJoin(users, eq(workspaceMembers.userId, users.id)).where(eq(workspaceMembers.workspaceId, task.workspaceId)),
    db.select({ id: taskComments.id, body: taskComments.body, authorName: users.name, createdAt: taskComments.createdAt }).from(taskComments).innerJoin(users, eq(taskComments.userId, users.id)).where(eq(taskComments.taskId, task.id)).orderBy(asc(taskComments.createdAt)),
    db.select({ id: taskActivities.id, action: taskActivities.action, details: taskActivities.details, actorName: users.name, createdAt: taskActivities.createdAt }).from(taskActivities).innerJoin(users, eq(taskActivities.actorUserId, users.id)).where(eq(taskActivities.taskId, task.id)).orderBy(desc(taskActivities.createdAt)).limit(50),
  ]);

  const taskApiBase = `/api/workspaces/${slug}/projects/${projectId}/tasks/${task.id}`;

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><Link href="/dashboard" className="text-xl font-bold">Team<span className="text-violet-400">Flow</span></Link><Link href={`/workspaces/${slug}/projects/${projectId}`} className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10 hover:text-white">Back to project</Link></div></header>
      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm font-medium text-violet-400">{task.workspaceName} / {task.projectKey}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{task.title}</h1>
        <p className="mt-2 text-sm text-slate-500">Created {formatDate(task.createdAt)}</p>
        {task.projectStatus === "archived" && <div className="mt-6 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-200">This project is archived. Task details are read-only.</div>}
        <div className="mt-8"><TaskDetailsPanel apiBase={taskApiBase} readOnly={task.projectStatus === "archived"} canManageTasks={(task.memberRole === "owner" || task.memberRole === "admin") && task.assigneeId !== currentUser.id} canUpdateStatus={task.assigneeId === currentUser.id} task={{ ...task, dueAt: task.dueAt?.toISOString() ?? null }} members={members} comments={comments.map((comment) => ({ ...comment, createdAt: comment.createdAt.toISOString() }))} /></div>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-xl font-semibold">Activity history</h2>
          <div className="mt-5 space-y-4">
            {activities.length === 0 && <p className="text-sm text-slate-500">No recorded activity yet.</p>}
            {activities.map((activity) => <div key={activity.id} className="flex gap-3 border-l-2 border-violet-400/30 pl-4"><div><p className="text-sm text-slate-300"><span className="font-medium text-white">{activity.actorName}</span> {activity.details ?? activity.action}</p><time className="mt-1 block text-xs text-slate-600">{formatDate(activity.createdAt)}</time></div></div>)}
          </div>
        </section>
      </div>
    </main>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
