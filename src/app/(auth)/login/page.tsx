import Link from "next/link";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <div>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome back
        </h1>

        <p className="mt-3 text-slate-400">
          Sign in to continue to your TeamFlow workspace.
        </p>
      </div>

      <form className="mt-8 space-y-5">
        <div>
          <label
            htmlFor="email"
            className="mb-2 block text-sm font-medium text-slate-200"
          >
            Email address
          </label>

          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            required
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-200"
            >
              Password
            </label>

            <Link
              href="/forgot-password"
              className="text-sm font-medium text-violet-400 hover:text-violet-300"
            >
              Forgot password?
            </Link>
          </div>

          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Enter your password"
            required
            minLength={8}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 outline-none transition placeholder:text-slate-600 focus:border-violet-400 focus:ring-4 focus:ring-violet-400/10"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-xl bg-violet-500 px-5 py-3 font-semibold transition hover:bg-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-400/30"
        >
          Sign in
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-slate-400">
        Do not have an account?{" "}
        <Link
          href="/register"
          className="font-semibold text-violet-400 hover:text-violet-300"
        >
          Create one
        </Link>
      </p>
    </div>
  );
}