export default function MyTasksLoading() {
  return <main className="min-h-screen bg-slate-950 text-white">
    <header className="border-b border-white/10"><div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5"><div className="h-7 w-28 animate-pulse rounded-lg bg-white/10" /><div className="h-10 w-36 animate-pulse rounded-lg bg-white/10" /></div></header>
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="h-4 w-32 animate-pulse rounded bg-violet-400/20" />
      <div className="mt-4 h-10 w-52 animate-pulse rounded-xl bg-white/10" />
      <div className="mt-3 h-5 w-96 max-w-full animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-8 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:grid-cols-3"><div className="h-16 animate-pulse rounded-xl bg-white/[0.06]" /><div className="h-16 animate-pulse rounded-xl bg-white/[0.06]" /><div className="h-16 animate-pulse rounded-xl bg-violet-400/15" /></div>
      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />)}</div>
      <p className="mt-7 text-center text-sm text-slate-500">Loading your assigned work…</p>
    </div>
  </main>;
}
