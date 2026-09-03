import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { projects, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";

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
          <span className="w-fit rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-sm capitalize text-emerald-300">{project.status}</span>
        </div>

        <section className="mt-10 grid gap-5 sm:grid-cols-3">
          <ProjectCard label="Open tasks" value="0" description="No tasks created" />
          <ProjectCard label="Completed" value="0" description="Nothing completed yet" />
          <ProjectCard label="Team" value="1" description="Workspace members" />
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-semibold">Project board</h2>
          <p className="mt-2 text-slate-400">Tasks, assignments, priorities, and workflow columns will appear here.</p>
          <button type="button" disabled className="mt-6 rounded-xl bg-violet-500 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60">Task management coming next</button>
        </section>
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
