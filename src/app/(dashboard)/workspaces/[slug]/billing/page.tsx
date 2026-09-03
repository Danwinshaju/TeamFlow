import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";

import { BillingControls } from "@/components/billing-controls";
import { StandardCheckoutButton } from "@/components/standard-checkout-button";
import { db } from "@/db";
import { workspaceMembers, workspaceSubscriptions, workspaces } from "@/db/schema";
import { getCurrentUser } from "@/lib/security/session";

type BillingPageProps = { params: Promise<{ slug: string }> };

export default async function BillingPage({ params }: BillingPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { slug } = await params;
  const [workspace] = await db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaces.slug, slug), eq(workspaceMembers.userId, user.id)))
    .limit(1);
  if (!workspace) notFound();

  const [subscription] = await db
    .select({ status: workspaceSubscriptions.status, cancelAtCycleEnd: workspaceSubscriptions.cancelAtCycleEnd })
    .from(workspaceSubscriptions)
    .where(eq(workspaceSubscriptions.workspaceId, workspace.id))
    .limit(1);

  const status = subscription?.status ?? null;
  const isPaid = status && !["cancelled", "completed", "expired"].includes(status);

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link href={`/workspaces/${slug}`} className="text-sm text-slate-400 hover:text-white">← {workspace.name}</Link>
          <span className="text-xl font-bold">Team<span className="text-violet-400">Flow</span></span>
        </div>
      </header>
      <div className="mx-auto max-w-4xl px-6 py-10">
        <p className="text-sm font-medium text-violet-400">Workspace billing</p>
        <h1 className="mt-2 text-3xl font-bold">Plans for {workspace.name}</h1>
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xl font-semibold">TeamFlow Pro</p>
              <p className="mt-2 max-w-xl text-sm text-slate-400">Unlock higher workspace limits and keep your team moving with a paid workspace subscription.</p>
            </div>
            <span className="rounded-full border border-white/15 px-3 py-1 text-xs font-medium capitalize text-slate-300">{isPaid ? status : "free"}</span>
          </div>
          <BillingControls workspaceSlug={slug} canManage={workspace.role === "owner"} subscriptionStatus={status} cancelAtCycleEnd={subscription?.cancelAtCycleEnd === 1} />
          <div className="mt-6 border-t border-white/10 pt-6">
            <p className="text-sm text-slate-400">Standard Web Checkout test payment</p>
            <div className="mt-3">
              <StandardCheckoutButton amount={Number(process.env.NEXT_PUBLIC_RAZORPAY_AMOUNT_PAISE ?? 50000)} />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}