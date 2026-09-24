import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { ProfileMenu } from "@/components/profile-menu";
import { WorkspaceChat } from "@/components/workspace-chat";
import { db } from "@/db";
import { users, workspaceMembers, workspaces } from "@/db/schema";
import { hasPaidWorkspaceAccess } from "@/lib/billing/access";
import { getCurrentUser } from "@/lib/security/session";

export const metadata = { title: "Messages | TeamFlow" };

export default async function WorkspaceMessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { slug } = await params;

  const [workspace] = await db.select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  if (!workspace) notFound();
  if (!(await hasPaidWorkspaceAccess(user.id, slug))) redirect(workspace.role === "owner" ? "/onboarding/billing?required=true" : "/dashboard?workspace=paused");

  const members = await db.select({ id: users.id, name: users.name, email: users.email, role: workspaceMembers.role, avatarDataUrl: users.avatarDataUrl, availabilityStatus: users.availabilityStatus })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspace.id));

  return <main className="min-h-screen bg-slate-950 text-white">
    <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-5">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-bold"><span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500 text-xs">TF</span><span className="hidden sm:inline">Team<span className="text-violet-400">Flow</span></span></Link>
          <div className="hidden h-7 w-px bg-white/10 sm:block" />
          <div className="min-w-0"><p className="truncate font-semibold">{workspace.name}</p><p className="text-xs text-slate-500">Messages</p></div>
        </div>
        <nav className="hidden items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1 md:flex"><Link href={`/workspaces/${slug}`} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">Workspace</Link><span className="rounded-lg bg-white/10 px-3 py-2 text-sm font-medium">Messages</span><Link href="/my-tasks" className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-white/5 hover:text-white">My tasks</Link></nav>
        <ProfileMenu user={user} />
      </div>
    </header>

    <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">Workspace communication</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">Messages</h1><p className="mt-1 text-sm text-slate-400">Talk with the whole team or choose a teammate for a private conversation.</p></div><Link href={`/workspaces/${slug}`} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/5">← Workspace overview</Link></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_290px]">
        <WorkspaceChat workspaceSlug={slug} userId={user.id} members={members.map(({ id, name, avatarDataUrl, availabilityStatus }) => ({ id, name, avatarDataUrl, availabilityStatus }))} />
        <aside className="hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5 xl:block"><h2 className="font-semibold">Workspace people</h2><p className="mt-1 text-sm text-slate-500">Select a person in the chat to message privately.</p><div className="mt-4 space-y-2">{members.map((member) => <div key={member.id} className="flex items-center gap-3 rounded-xl bg-slate-950/60 p-3"><span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-bold">{initials(member.name)}<span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${member.availabilityStatus === "offline" ? "bg-slate-500" : "bg-emerald-400"}`} /></span><div className="min-w-0"><p className="truncate text-sm font-medium">{member.name}{member.id === user.id ? " (You)" : ""}</p><p className="text-xs capitalize text-slate-500">{member.role} · {member.availabilityStatus === "offline" ? "Offline" : "Active"}</p></div></div>)}</div></aside>
      </div>
    </div>
  </main>;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}
