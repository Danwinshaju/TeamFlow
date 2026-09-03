import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import {
  users,
  workspaceMembers,
  workspaces,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";

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

  const members = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(
      eq(workspaceMembers.workspaceId, membership.workspaceId),
    );

  const canManageWorkspace =
    membership.role === "owner" || membership.role === "admin";

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="text-xl font-bold">
            Team<span className="text-violet-400">Flow</span>
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

      <div className="mx-auto max-w-7xl px-6 py-10">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-violet-400">
              Workspace overview
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {membership.workspaceName}
            </h1>
            <p className="mt-3 text-slate-400">
              Created {formatDate(membership.createdAt)} · You are {" "}
              <span className="capitalize text-slate-300">
                {membership.role}
              </span>
            </p>
          </div>

          {canManageWorkspace && (
            <button
              type="button"
              disabled
              className="rounded-xl bg-violet-500 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              Invite member — coming next
            </button>
          )}
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <SummaryCard
            label="Members"
            value={String(members.length)}
            description="People in this workspace"
          />
          <SummaryCard
            label="Projects"
            value="0"
            description="No projects created yet"
          />
          <SummaryCard
            label="Open tasks"
            value="0"
            description="No tasks assigned yet"
          />
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Team members</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Everyone who can access this workspace.
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
          </section>

          <div className="space-y-6">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold">Projects</h2>
              <p className="mt-2 text-sm text-slate-400">
                Organize your team&apos;s work into projects.
              </p>
              <button
                type="button"
                disabled
                className="mt-5 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create project — coming next
              </button>
            </section>

            {canManageWorkspace && (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <h2 className="text-xl font-semibold">Workspace settings</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Manage the workspace name, members, and permissions.
                </p>
                <p className="mt-5 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-xs text-slate-500">
                  Settings controls will be added after invitations.
                </p>
              </section>
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
    <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
    </article>
  );
}
