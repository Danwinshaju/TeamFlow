import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { TaskBoard } from "@/components/task-board";
import { ProjectSettings } from "@/components/project-settings";
import { db } from "@/db";
import {
  projects,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { hasPaidWorkspaceAccess } from "@/lib/billing/access";

export const metadata = { title: "Project" };

type ProjectPageProps = {
  params: Promise<{ slug: string; projectId: string }>;
};

export default async function ProjectPage({ params }: ProjectPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { slug, projectId } = await params;
  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      key: projects.key,
      description: projects.description,
      status: projects.status,
      createdAt: projects.createdAt,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      memberRole: workspaceMembers.role,
    })
    .from(projects)
    .innerJoin(workspaces, eq(projects.workspaceId, workspaces.id))
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .where(and(eq(projects.id, projectId), eq(workspaces.slug, slug)))
    .limit(1);

  if (!project) {
    notFound();
  }

  if (!(await hasPaidWorkspaceAccess(user.id, slug))) redirect(project.memberRole === "owner" ? "/onboarding/billing?required=true" : "/dashboard?workspace=paused");

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, project.workspaceId));

  const projectTasks = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      assigneeId: tasks.assigneeId,
      assigneeName: users.name,
      dueAt: tasks.dueAt,
      createdByUserId: tasks.createdByUserId,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(
      eq(tasks.projectId, project.id),
      project.memberRole === "member" ? eq(tasks.assigneeId, user.id) : undefined,
    ));

  const completedTasks = projectTasks.filter(
    (task) => task.status === "done",
  ).length;
  const openTasks = projectTasks.length - completedTasks;
  const today = new Date();
  const overdueTasks = projectTasks.filter((task) => task.dueAt && task.status !== "done" && task.dueAt < today).length;
  const highPriorityTasks = projectTasks.filter((task) => (task.priority === "high" || task.priority === "urgent") && task.status !== "done").length;
  const progress = projectTasks.length === 0 ? 0 : Math.round((completedTasks / projectTasks.length) * 100);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="text-xl font-bold">Team<span className="text-violet-400">Flow</span></Link>
          <Link href={`/workspaces/${project.workspaceSlug}`} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white">Back to workspace</Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        <p className="text-sm font-medium text-violet-400">{project.workspaceName} / {project.key}</p>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{project.name}</h1>
            <p className="mt-3 max-w-3xl text-slate-400">{project.description || "No project description yet."}</p>
          </div>
          <div className="flex items-center gap-3">
            {(project.memberRole === "owner" || project.memberRole === "admin") && project.status === "active" && <a href="#assign-task" className="rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold hover:bg-violet-400">Assign task</a>}
            <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm capitalize text-emerald-300">{project.status}</span>
          </div>
        </div>

        <section className="mt-10 grid gap-5 sm:grid-cols-3">
          <ProjectCard label="Open tasks" value={String(openTasks)} description="Tasks still in progress" />
          <ProjectCard label="Completed" value={String(completedTasks)} description="Finished tasks" />
          <ProjectCard label="Team" value={String(members.length)} description="Workspace members" />
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-semibold">Project health</h2><p className="text-sm text-slate-400">A quick view of what needs attention.</p></div>
            <span className="text-2xl font-bold text-violet-300">{progress}% complete</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3"><Insight label="Completed" value={String(completedTasks)} tone="text-emerald-300" /><Insight label="Overdue" value={String(overdueTasks)} tone={overdueTasks ? "text-red-300" : "text-slate-300"} /><Insight label="High priority open" value={String(highPriorityTasks)} tone={highPriorityTasks ? "text-orange-300" : "text-slate-300"} /></div>
        </section>

        {project.status === "active" ? (
          <TaskBoard workspaceSlug={project.workspaceSlug} projectId={project.id} members={members} currentUserId={user.id} currentUserRole={project.memberRole} initialTasks={projectTasks.map((task) => ({ ...task, dueAt: task.dueAt?.toISOString() ?? null }))} />
        ) : (
          <div className="mt-10 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-6 text-amber-200">This project is archived. Reactivate it to create or edit tasks.</div>
        )}

        {(project.memberRole === "owner" || project.memberRole === "admin") && (
          <ProjectSettings apiUrl={`/api/workspaces/${project.workspaceSlug}/projects/${project.id}/settings`} initialName={project.name} initialDescription={project.description} initialStatus={project.status} />
        )}
      </div>
    </main>
  );
}

function ProjectCard({ label, value, description }: { label: string; value: string; description: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </article>
  );
}

function Insight({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4"><p className="text-xs text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p></div>;
}
