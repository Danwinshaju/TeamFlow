import Link from "next/link";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";

import { WorkspaceForm } from "@/components/workspace-form";
import { db } from "@/db";
import { workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";

export const metadata = {
  title: "Dashboard",
};

type DashboardPageProps = {
  searchParams: Promise<{
    verification?: string | string[];
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const parameters = await searchParams;

  const verification =
    typeof parameters.verification === "string"
      ? parameters.verification
      : null;

  const userWorkspaces = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(
      workspaces,
      eq(workspaceMembers.workspaceId, workspaces.id),
    )
    .where(eq(workspaceMembers.userId, user.id));

  const primaryWorkspace = userWorkspaces[0];
  let memberCount = 0;

  if (primaryWorkspace) {
    const [result] = await db
      .select({ value: count() })
      .from(workspaceMembers)
      .where(
        eq(workspaceMembers.workspaceId, primaryWorkspace.id),
      );

    memberCount = result.value;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/dashboard" className="text-xl font-bold">
            Team<span className="text-violet-400">Flow</span>
          </Link>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-slate-400">
                {user.email}
              </p>
            </div>

            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10">
        {verification === "sent" && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-emerald-200"
          >
            Verification email sent. Check your inbox.
          </div>
        )}

        {verification === "failed" && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-red-200"
          >
            We could not send the verification email. Please try
            again.
          </div>
        )}

        {user.status === "pending_verification" && (
          <div className="mb-8 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4">
            <p className="font-semibold text-amber-200">
              Verify your email address
            </p>

            <p className="mt-1 text-sm text-amber-100/70">
              Your workspace is available, but sensitive actions
              will remain restricted until your email is verified.
            </p>

            <form
              action="/api/auth/resend-verification"
              method="post"
              className="mt-4"
            >
              <button
                type="submit"
                className="rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-200"
              >
                Send verification email
              </button>
            </form>
          </div>
        )}

        <section>
          <p className="text-sm font-medium text-violet-400">
            Workspace overview
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Welcome back, {user.name}
          </h1>

          <p className="mt-3 text-slate-400">
            Here is what is happening across your team.
          </p>
        </section>

        <section className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <DashboardCard
            label="Workspaces"
            value={String(userWorkspaces.length)}
            description={
              userWorkspaces.length === 0
                ? "Create your first workspace"
                : "Your active workspaces"
            }
          />

          <DashboardCard
            label="Open tasks"
            value="0"
            description="Nothing assigned"
          />

          <DashboardCard
            label="Team members"
            value={String(memberCount)}
            description={
              primaryWorkspace
                ? primaryWorkspace.name
                : "No workspace selected"
            }
          />

          <DashboardCard
            label="Plan"
            value="Free"
            description="Upgrade anytime"
          />
        </section>

        {userWorkspaces.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-semibold">Your workspaces</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {userWorkspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspaces/${workspace.slug}`}
                  className="group rounded-2xl border border-white/10 bg-white/5 p-6 transition hover:border-violet-400/40 hover:bg-white/[0.07]"
                >
                  <p className="text-lg font-semibold">{workspace.name}</p>
                  <p className="mt-1 text-sm capitalize text-violet-300">{workspace.role}</p>
                  <p className="mt-4 text-sm font-medium text-slate-400 transition group-hover:text-white">
                    Open workspace →
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-semibold">
            {userWorkspaces.length === 0
              ? "Create your first workspace"
              : "Create another workspace"}
          </h2>

          <p className="mt-2 max-w-2xl text-slate-400">
            Workspaces will contain your team members, projects,
            permissions, tasks, and subscription.
          </p>

          {user.status === "active" ? (
            <WorkspaceForm />
          ) : (
            <p className="mt-6 text-sm text-amber-200">
              Verify your email to create a workspace.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

type DashboardCardProps = {
  label: string;
  value: string;
  description: string;
};

function DashboardCard({
  label,
  value,
  description,
}: DashboardCardProps) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
    </article>
  );
}
