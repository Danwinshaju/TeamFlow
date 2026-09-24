import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";

import { PendingInvitations } from "@/components/pending-invitations";
import { ProjectForm } from "@/components/project-form";
import { WorkspaceInvitationForm } from "@/components/workspace-invitation-form";
import { WorkspaceSettings } from "@/components/workspace-settings";
import { WorkspaceChat } from "@/components/workspace-chat";
import { WorkspaceTaskAssigner } from "@/components/workspace-task-assigner";
import { LeaveWorkspaceButton } from "@/components/leave-workspace-button";
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

export const metadata = {
  title: "Workspace",
};

type WorkspacePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function WorkspacePage({
  params,
}: WorkspacePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { slug } = await params;

  const [membership] = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
      createdAt: workspaces.createdAt,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(
      workspaces,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(
      and(
        eq(workspaces.slug, slug),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .limit(1);

  if (!membership) {
    notFound();
  }

  if (!(await hasPaidWorkspaceAccess(user.id, slug))) redirect(membership.role === "owner" ? "/onboarding/billing?required=true" : "/dashboard?workspace=paused");

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      avatarDataUrl: users.avatarDataUrl,
      availabilityStatus: users.availabilityStatus,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(
      eq(workspaceMembers.workspaceId, membership.workspaceId),
    );

  const workspaceProjects = await db
    .select({
      id: projects.id,
      name: projects.name,
      key: projects.key,
      description: projects.description,
      status: projects.status,
    })
    .from(projects)
    .where(eq(projects.workspaceId, membership.workspaceId));

  const [openTaskResult] = await db
    .select({ value: count() })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, membership.workspaceId), ne(tasks.status, "done")));

  const canManageWorkspace =
    membership.role === "owner" || membership.role === "admin";

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="app-brand flex items-center gap-3 text-xl font-bold">
            <span className="app-button-primary grid h-9 w-9 place-items-center rounded-xl text-sm">TF</span><span>Team<span className="text-violet-400">Flow</span></span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Dashboard
            </Link>
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-slate-400">{user.email}</p>
            </div>
          </div>
        </div>
      </header>
      <section className="mx-auto max-w-[1500px] px-6 pt-7">
        <div className="app-panel mb-5 rounded-3xl p-6">
          <p className="text-xs font-bold tracking-[0.2em] text-violet-300">TEAM ROOM</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div><h1 className="text-3xl font-bold">{membership.workspaceName}</h1><p className="mt-2 text-slate-300">Talk, decide, assign work, and follow progress together.</p></div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href={`/workspaces/${membership.workspaceSlug}/messages`} className="rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2 font-semibold text-violet-200 hover:bg-violet-400/20">Open messages</Link>
              {canManageWorkspace && <a href="#assign-task" className="rounded-xl bg-violet-500 px-4 py-2 font-semibold text-white hover:bg-violet-400">Assign task</a>}
              <span className="rounded-full bg-emerald-400/10 px-3 py-1.5 text-emerald-300">{members.length} teammates</span><span className="rounded-full bg-violet-400/10 px-3 py-1.5 text-violet-300">{openTaskResult.value} open tasks</span>
            </div>
          </div>
        </div>
        {canManageWorkspace && <WorkspaceTaskAssigner workspaceSlug={membership.workspaceSlug} projects={workspaceProjects} members={members.map(({ id, name, email }) => ({ id, name, email }))} />}
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_340px]">
          <WorkspaceChat workspaceSlug={slug} userId={user.id} members={members.map(({ id, name, avatarDataUrl, availabilityStatus }) => ({ id, name, avatarDataUrl, availabilityStatus }))} />
          <aside className="app-panel rounded-3xl p-5">
            <div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">People</h2><p className="mt-1 text-sm text-slate-400">Everyone in this group</p></div><span className="flex items-center gap-2 text-xs text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" />Team</span></div>
            <div className="mt-5 space-y-3">
              {members.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-slate-950/50 p-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-bold">{member.name.split(" ").filter(Boolean).slice(0,2).map((part) => part[0]?.toUpperCase()).join("")}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{member.id === user.id ? `${member.name} (You)` : member.name}</p><p className="text-xs capitalize text-slate-500">{member.role}</p></div></div>)}
            </div>
            <a href="#workspace-management" className="mt-4 block rounded-xl border border-white/10 px-4 py-2.5 text-center text-sm font-medium text-slate-300 hover:bg-white/10">Manage team</a>
            {membership.role !== "owner" && <LeaveWorkspaceButton workspaceSlug={membership.workspaceSlug} workspaceName={membership.workspaceName} userId={user.id} />}
          </aside>
        </div>
      </section>

      <div className="mx-auto max-w-[1500px] px-6 py-10">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-cyan-300">
              Shared work overview
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              Projects and assignments
            </h1>
            <p className="mt-3 text-slate-400">
              {membership.workspaceName} · Created {formatDate(membership.createdAt)} · You are {" "}
              <span className="capitalize text-slate-300">
                {membership.role}
              </span>
            </p>
          </div>

          <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-200">
            Workspace access active
          </span>

        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            label="Members"
            value={String(members.length)}
            description="People in this workspace"
          />
          <SummaryCard
            label="Projects"
            value={String(workspaceProjects.length)}
            description={
              workspaceProjects.length === 0
                ? "No projects created yet"
                : "Projects in this workspace"
            }
          />
          <SummaryCard
            label="Open tasks"
            value={String(openTaskResult.value)}
            description={openTaskResult.value === 0 ? "No open tasks" : "Tasks still in progress"}
          />
        </section>

        <div id="workspace-management" className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="app-panel rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
              <h2 className="text-xl font-semibold">Manage your group</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Invite people and control their workspace access.
                </p>
              </div>
            </div>

            <div className="mt-6 divide-y divide-white/10">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{member.name}</p>
                    <p className="truncate text-sm text-slate-400">
                      {member.email}
                    </p>
                  </div>
                  <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-medium capitalize text-violet-300">
                    {member.role}
                  </span>
                </div>
              ))}
            </div>

            {canManageWorkspace && (
              <div className="mt-6 border-t border-white/10 pt-6">
                <h3 className="font-semibold">
                  Invite a team member
                </h3>

                <p className="mt-1 text-sm text-slate-400">
                  Send someone a secure invitation to this
                  workspace.
                </p>

                <WorkspaceInvitationForm
                  workspaceSlug={membership.workspaceSlug}
                />

                <PendingInvitations
                  workspaceSlug={membership.workspaceSlug}
                />
              </div>
            )}
          </section>

          <div className="space-y-6">
            <section id="project-rooms" className="app-panel scroll-mt-24 rounded-3xl p-6">
              <h2 className="text-xl font-semibold">Project rooms</h2>
              <p className="mt-2 text-sm text-slate-400">
                Open a project to create tasks, choose an assignee, set priority, and track delivery.
              </p>

              {workspaceProjects.length > 0 && (
                <div className="mt-5 space-y-3">
                  {workspaceProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/workspaces/${membership.workspaceSlug}/projects/${project.id}`}
                      className="block rounded-xl border border-white/10 bg-slate-950/50 p-4 transition hover:border-violet-400/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold">{project.name}</p>
                        <span className="text-xs font-medium text-violet-300">{project.key}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-slate-400">
                        {project.description || "No description"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}

              {canManageWorkspace && (
                <ProjectForm workspaceSlug={membership.workspaceSlug} />
              )}
            </section>

            {membership.role === "owner" && (
              <WorkspaceSettings workspaceSlug={membership.workspaceSlug} initialName={membership.workspaceName} members={members.map((member) => ({ id: member.id, name: member.name, email: member.email, role: member.role }))} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

type SummaryCardProps = {
  label: string;
  value: string;
  description: string;
};

function SummaryCard({
  label,
  value,
  description,
}: SummaryCardProps) {
  return (
    <article className="app-card rounded-2xl p-6 transition">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </article>
  );
}
