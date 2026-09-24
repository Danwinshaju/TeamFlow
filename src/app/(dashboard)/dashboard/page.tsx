import Link from "next/link";
import { redirect } from "next/navigation";
import { and, count, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";

import { WorkspaceForm } from "@/components/workspace-form";
import { ProfileMenu } from "@/components/profile-menu";
import { DashboardInvitations } from "@/components/dashboard-invitations";
import { DashboardJoinRequests } from "@/components/dashboard-join-requests";
import { db } from "@/db";
import { tasks, userAccessRequests, workspaceInvitations, workspaceMembers, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";
import { getUserAccessDestination } from "@/lib/billing/access";

export const metadata = {
  title: "Dashboard",
};

type DashboardPageProps = {
  searchParams: Promise<{
    verification?: string | string[];
    workspace?: string | string[];
  }>;
};

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "active") redirect("/verify-email?required=true");
  const accessDestination = await getUserAccessDestination(user.id);
  if (!accessDestination.startsWith("/dashboard")) redirect(accessDestination);

  const parameters = await searchParams;

  const verification =
    typeof parameters.verification === "string"
      ? parameters.verification
      : null;
  const workspaceNotice = typeof parameters.workspace === "string" ? parameters.workspace : null;

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
  const [paidOwnerAccess] = await db.select({ id: userAccessRequests.id }).from(userAccessRequests).where(and(
    eq(userAccessRequests.userId, user.id),
    eq(userAccessRequests.status, "approved"),
    isNotNull(userAccessRequests.stripeSubscriptionId),
  )).limit(1);
  const pendingInvitations = await db.select({
    id: workspaceInvitations.id,
    workspaceName: workspaces.name,
    role: workspaceInvitations.role,
    expiresAt: workspaceInvitations.expiresAt,
    requestedAt: workspaceInvitations.requestedAt,
  }).from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
    .where(and(
      eq(workspaceInvitations.email, user.email),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
      gt(workspaceInvitations.expiresAt, new Date()),
    ));
  const joinRequests = await db.select({
    id: workspaceInvitations.id,
    email: workspaceInvitations.email,
    role: workspaceInvitations.role,
    requestedAt: workspaceInvitations.requestedAt,
    workspaceName: workspaces.name,
    workspaceSlug: workspaces.slug,
  }).from(workspaceInvitations)
    .innerJoin(workspaces, eq(workspaceInvitations.workspaceId, workspaces.id))
    .innerJoin(workspaceMembers, and(
      eq(workspaceMembers.workspaceId, workspaces.id),
      eq(workspaceMembers.userId, user.id),
      eq(workspaceMembers.role, "owner"),
    ))
    .where(and(
      isNotNull(workspaceInvitations.requestedAt),
      isNull(workspaceInvitations.acceptedAt),
      isNull(workspaceInvitations.revokedAt),
      gt(workspaceInvitations.expiresAt, new Date()),
    ));
  const [openTaskResult] = await db
    .select({ value: count() })
    .from(tasks)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, tasks.workspaceId),
        eq(workspaceMembers.userId, user.id),
      ),
    )
    .where(and(eq(tasks.assigneeId, user.id), ne(tasks.status, "done")));

  const openTaskCount = openTaskResult.value;

  return (
    <main className="app-shell">
      <header className="app-topbar">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="app-brand flex items-center gap-3 text-xl font-bold tracking-tight">
            <span className="app-button-primary grid h-9 w-9 place-items-center rounded-xl text-sm">TF</span><span>Team<span className="text-violet-400">Flow</span></span>
          </Link>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:flex"><Link href="/dashboard" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium">Overview</Link><Link href="/my-tasks" className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">My tasks</Link></nav>
            <ProfileMenu user={user} />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
        <div id="invitations" className="scroll-mt-24">
          <DashboardInvitations invitations={pendingInvitations.map((invitation) => ({ ...invitation, expiresAt: invitation.expiresAt.toISOString(), requestedAt: invitation.requestedAt?.toISOString() ?? null }))} />
          <DashboardJoinRequests requests={joinRequests.map((request) => ({
            ...request,
            requestedAt: request.requestedAt!.toISOString(),
          }))} />
        </div>
        {verification === "sent" && (
          <div
            role="status"
            className="mb-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-5 py-4 text-emerald-200"
          >
            Verification email sent. Check your inbox.
          </div>
        )}

        {verification === "limited" && <p role="alert" className="mb-4 text-sm text-amber-200">Please wait before requesting another verification email. You can request one per minute, up to five per hour.</p>}
        {verification === "failed" && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-400/30 bg-red-400/10 px-5 py-4 text-red-200"
          >
            We could not send the verification email. Please try
            again.
          </div>
        )}

        <section className="app-panel relative overflow-hidden rounded-3xl p-7 sm:p-10"><div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-violet-500/20 blur-3xl" />
          <p className="app-eyebrow">Your command center</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Welcome back, {user.name}</h1>
          <p className="mt-3 max-w-xl text-slate-300">See your work at a glance and jump straight into what needs your attention.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            {primaryWorkspace && <Link href={`/workspaces/${primaryWorkspace.slug}`} className="app-button-primary rounded-xl px-5 py-3 text-sm font-semibold">Open workspace</Link>}
            <Link href="/my-tasks" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-semibold transition hover:bg-white/10">My tasks</Link>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3">
          <DashboardCard
            label="Workspaces"
            value={String(userWorkspaces.length)}
            description={
              userWorkspaces.length === 0
                ? "Create your first workspace"
                : "Your active workspaces"
            }
            href="#your-workspaces"
          />

          <DashboardCard
            label="My open tasks"
            value={String(openTaskCount)}
            description={openTaskCount === 0 ? "Nothing assigned" : "Assigned to you"}
            href="/my-tasks"
          />

          <DashboardCard
            label="Invitations"
            value={String(pendingInvitations.length + joinRequests.length)}
            description={pendingInvitations.length + joinRequests.length === 0 ? "No action needed" : "Waiting for your action"}
            href="#invitations"
          />
        </section>

        {userWorkspaces.length > 0 && (
          <section id="your-workspaces" className="mt-10 scroll-mt-24">
            <div className="flex items-end justify-between"><div><h2 className="text-xl font-semibold">Your workspaces</h2><p className="mt-1 text-sm text-slate-400">Choose a workspace to manage projects and tasks.</p></div><span className="text-sm text-slate-500">{userWorkspaces.length} total</span></div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {userWorkspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/workspaces/${workspace.slug}`}
                  className="app-card group rounded-2xl p-6 transition"
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
        {workspaceNotice === "paused" && <div role="status" className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-amber-100"><p className="font-semibold">Workspace temporarily paused</p><p className="mt-1 text-sm text-amber-200/80">The workspace Owner’s subscription is no longer active. Messages, projects, and tasks are safely preserved and will be available again when the Owner renews.</p></div>}

        {!paidOwnerAccess && userWorkspaces.length > 0 && <section className="app-panel mt-10 overflow-hidden rounded-3xl p-7 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="app-eyebrow">Build your own team</p><h2 className="mt-2 text-2xl font-bold">Want a workspace of your own?</h2><p className="mt-2 max-w-2xl text-slate-400">Subscribe to create a separate workspace where you are Owner. Your current Member or Admin roles will not change.</p></div>
            <Link href="/onboarding/billing?intent=become-owner" className="app-button-primary shrink-0 rounded-xl px-6 py-3 text-center font-semibold">Start my own workspace</Link>
          </div>
        </section>}

        {paidOwnerAccess && <section className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-8">
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
        </section>}
      </div>
    </main>
  );
}

type DashboardCardProps = {
  label: string;
  value: string;
  description: string;
  href: string;
};

function DashboardCard({
  label,
  value,
  description,
  href,
}: DashboardCardProps) {
  return (
    <Link href={href} className="app-card group rounded-2xl p-6 transition hover:-translate-y-0.5">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
      <p className="mt-2 text-sm text-slate-500">
        {description}
      </p>
      <p className="mt-4 text-sm font-semibold text-violet-300 transition group-hover:text-violet-200">Open →</p>
    </Link>
  );
}
