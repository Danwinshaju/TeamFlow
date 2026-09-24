"use client";

import Link from "next/link";

type FriendlyErrorStateProps = {
  eyebrow?: string;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onRetry?: () => void;
};

export function FriendlyErrorState({
  eyebrow = "LET'S GET YOU BACK ON TRACK",
  title,
  description,
  actionLabel = "Go to dashboard",
  actionHref = "/dashboard",
  onRetry,
}: FriendlyErrorStateProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-14 text-white">
      <section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/90 shadow-2xl shadow-violet-950/40">
        <div className="relative flex min-h-72 items-center justify-center overflow-hidden bg-gradient-to-br from-violet-500/25 via-fuchsia-500/10 to-cyan-400/20 p-8">
          <div className="absolute -left-12 -top-12 h-40 w-40 rounded-full bg-violet-400/20 blur-2xl" />
          <div className="absolute -bottom-12 -right-8 h-44 w-44 rounded-full bg-cyan-300/15 blur-2xl" />
          <svg viewBox="0 0 360 230" role="img" aria-label="A friendly TeamFlow helper repairing a broken workflow" className="relative w-full max-w-sm drop-shadow-2xl">
            <path d="M49 191h264" stroke="#94a3b8" strokeOpacity=".35" strokeWidth="8" strokeLinecap="round" />
            <rect x="91" y="42" width="177" height="129" rx="24" fill="#111827" stroke="#8b5cf6" strokeWidth="5" />
            <circle cx="145" cy="101" r="9" fill="#c4b5fd" />
            <circle cx="215" cy="101" r="9" fill="#c4b5fd" />
            <path d="M144 136c20-14 52-14 72 0" fill="none" stroke="#f9a8d4" strokeWidth="7" strokeLinecap="round" />
            <path d="M76 83 44 61M284 83l32-22" stroke="#67e8f9" strokeWidth="9" strokeLinecap="round" />
            <circle cx="43" cy="60" r="13" fill="#22d3ee" />
            <path d="m285 158 28 26M75 158l-28 26" stroke="#a78bfa" strokeWidth="10" strokeLinecap="round" />
            <path d="M286 44 305 25m-2 38 28-4m-45-35 4-18" stroke="#fbbf24" strokeWidth="6" strokeLinecap="round" />
            <rect x="151" y="157" width="58" height="37" rx="12" fill="#7c3aed" />
            <path d="m169 176 8 8 17-19" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="p-7 text-center sm:p-10">
          <p className="text-xs font-bold tracking-[0.22em] text-violet-300">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-4 max-w-lg leading-7 text-slate-300">{description}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {onRetry ? (
              <button type="button" onClick={onRetry} className="rounded-xl bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400">{actionLabel}</button>
            ) : (
              <Link href={actionHref} className="rounded-xl bg-violet-500 px-6 py-3 font-semibold hover:bg-violet-400">{actionLabel}</Link>
            )}
            <Link href="/login" className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-slate-300 hover:bg-white/10">Return to sign in</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
