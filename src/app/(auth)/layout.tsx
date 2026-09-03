import Link from "next/link";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="grid min-h-screen bg-slate-950 text-white lg:grid-cols-2">
      <section className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Team<span className="text-violet-400">Flow</span>
        </Link>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </section>

      <section className="relative hidden overflow-hidden border-l border-white/10 bg-violet-600 lg:flex lg:items-end">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-fuchsia-400/30 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-indigo-950/60 blur-3xl" />

        <div className="relative z-10 p-14">
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