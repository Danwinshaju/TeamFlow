import Link from "next/link";
import { redirect } from "next/navigation";

import { getUserAccessDestination } from "@/lib/billing/access";
import { getCurrentUser } from "@/lib/security/session";

const features = [
  {
    title: "Organize projects",
    description:
      "Keep projects, tasks, deadlines, and responsibilities in one workspace.",
  },
  {
    title: "Manage your team",
    description:
      "Invite members and control access with owner, admin, member, and viewer roles.",
  },
  {
    title: "Track progress",
    description:
      "Understand what is finished, what is delayed, and what your team should do next.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.status !== "active") redirect("/verify-email?required=true");
  redirect(await getUserAccessDestination(user.id));

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <nav className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link href="/" className="text-xl font-bold tracking-tight">
            Team<span className="text-violet-400">Flow</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white"
            >
              Sign in
            </Link>

            <Link
              href="/register"
              className="rounded-lg bg-violet-500 px-4 py-2 text-sm font-semibold transition hover:bg-violet-400"
            >
              Start free
            </Link>
          </div>
        </div>
      </nav>

      <section className="mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div>
          <p className="mb-5 inline-flex rounded-full border border-violet-400/30 bg-violet-400/10 px-4 py-2 text-sm text-violet-300">
            One workspace for your entire team
          </p>

          <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Move projects forward without losing the details.
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            TeamFlow helps growing teams plan projects, assign work, collaborate,
            and monitor progress from one secure workspace.
          </p>

          <div className="mt-9 flex flex-col gap-4 sm:flex-row">
            <Link
              href="/register"
              className="rounded-xl bg-violet-500 px-6 py-3 text-center font-semibold transition hover:bg-violet-400"
            >
              Create your workspace
            </Link>

            <Link
              href="#features"
              className="rounded-xl border border-white/15 px-6 py-3 text-center font-semibold transition hover:bg-white/10"
            >
              Explore features
            </Link>
          </div>

          <p className="mt-5 text-sm text-slate-400">
            Start free. No credit card required.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl shadow-violet-950/50">
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Current project</p>
                <h2 className="mt-1 text-xl font-semibold">Product launch</h2>
              </div>

              <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-sm text-emerald-300">
                On track
              </span>
            </div>

            <div className="space-y-4">
              {[
                ["Research", "Complete", "100%"],
                ["Design", "In progress", "72%"],
                ["Development", "In progress", "48%"],
                ["Launch", "Not started", "0%"],
              ].map(([name, status, progress]) => (
                <div
                  key={name}
                  className="rounded-xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{name}</p>
                      <p className="mt-1 text-sm text-slate-400">{status}</p>
                    </div>
                    <span className="text-sm font-semibold text-violet-300">
                      {progress}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="border-t border-white/10 bg-slate-900/50"
      >
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="font-semibold text-violet-400">Built for teamwork</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Everything your team needs to deliver excellent work
            </h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6"
              >
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500 font-bold">
                  {index + 1}
                </div>

                <h3 className="text-xl font-semibold">{feature.title}</h3>
                <p className="mt-3 leading-7 text-slate-400">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
