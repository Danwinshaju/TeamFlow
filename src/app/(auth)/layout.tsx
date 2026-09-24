import Link from "next/link";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="app-shell grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(520px,.85fr)]">
      <section className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        <Link href="/" className="app-brand flex items-center gap-3 text-xl font-bold tracking-tight">
          <span className="app-button-primary grid h-10 w-10 place-items-center rounded-xl text-sm">TF</span><span>Team<span className="text-violet-400">Flow</span></span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md rounded-3xl border border-white/[0.07] bg-white/[0.025] p-1 sm:p-6">{children}</div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden border-l border-white/10 bg-gradient-to-br from-violet-700 via-indigo-800 to-slate-950 lg:flex lg:items-end">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-950/60 blur-3xl" />

        <div className="absolute inset-8 rounded-[2rem] border border-white/10 bg-white/[0.055] backdrop-blur-sm" /><div className="relative z-10 p-16">
          <div className="mb-8 flex gap-3"><span className="rounded-full bg-emerald-300/15 px-3 py-1.5 text-sm text-emerald-200">Secure access</span><span className="rounded-full bg-white/10 px-3 py-1.5 text-sm text-violet-100">Real-time teamwork</span></div>
          <p className="max-w-xl text-3xl font-semibold leading-snug">
            “TeamFlow gives every person the context they need to move work
            forward.”
          </p>

          <p className="mt-6 text-violet-100">
            One secure workspace for projects, tasks, and teams.
          </p>
        </div>
      </section>
    </main>
  );
}
