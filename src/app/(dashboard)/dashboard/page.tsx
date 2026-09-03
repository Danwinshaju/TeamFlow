import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/security/session";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
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
                <p className="text-xs text-slate-400">{user.email}</p>
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
        {user.status === "pending_verification" && (
          <div className="mb-8 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4">
            <p className="font-semibold text-amber-200">
              Verify your email address
            </p>

            <p className="mt-1 text-sm text-amber-100/70">
              Your workspace is available, but sensitive actions will
              remain restricted until your email is verified.
            </p>
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
            label="Active projects"
            value="0"
            description="No projects created"
          />

          <DashboardCard
            label="Open tasks"
            value="0"
            description="Nothing assigned"
          />

          <DashboardCard
            label="Team members"
            value="1"
            description="Your workspace"
          />

          <DashboardCard
            label="Plan"
            value="Free"
            description="Upgrade anytime"
          />
        </section>

        <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8">
          <h2 className="text-xl font-semibold">
            Create your first workspace
          </h2>

          <p className="mt-2 max-w-2xl text-slate-400">
            Workspaces will contain your team members, projects,
            permissions, tasks, and subscription.
          </p>

          <button
            type="button"
            disabled
            className="mt-6 rounded-xl bg-violet-500 px-5 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-60"
          >
            Workspace setup coming next
          </button>
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
