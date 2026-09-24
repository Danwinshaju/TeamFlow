import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingPaymentButton } from "@/components/onboarding-payment-button";
import { getCurrentUser } from "@/lib/security/session";

type PaymentFailedPageProps = { searchParams: Promise<{ reason?: string | string[] }> };

export default async function PaymentFailedPage({ searchParams }: PaymentFailedPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const parameters = await searchParams;
  const reason = typeof parameters.reason === "string" ? parameters.reason : "failed";
  const message = reason === "cancelled"
    ? "Checkout was closed before payment finished. You were not charged."
    : reason === "network"
      ? "TeamFlow could not reach the secure checkout service. Check your connection and try again."
      : reason === "setup"
        ? "The secure checkout could not be opened. Please try once more."
        : "Stripe could not confirm the payment. No paid access was unlocked.";

  return <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 py-14 text-white"><section className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-rose-400/20 bg-slate-900 shadow-2xl"><div className="flex min-h-64 items-center justify-center bg-gradient-to-br from-rose-500/20 via-violet-500/15 to-cyan-400/10 p-8"><svg viewBox="0 0 340 220" role="img" aria-label="A friendly card character asking to retry payment" className="w-full max-w-sm"><rect x="69" y="50" width="202" height="126" rx="25" fill="#172033" stroke="#fb7185" strokeWidth="5"/><circle cx="130" cy="109" r="9" fill="#fda4af"/><circle cx="210" cy="109" r="9" fill="#fda4af"/><path d="M134 148c20-15 52-15 72 0" fill="none" stroke="#fda4af" strokeWidth="7" strokeLinecap="round"/><rect x="89" y="69" width="64" height="13" rx="6" fill="#8b5cf6"/><circle cx="272" cy="48" r="28" fill="#fb7185"/><path d="m261 37 22 22m0-22-22 22" stroke="white" strokeWidth="7" strokeLinecap="round"/><path d="M65 145 37 171m238-26 28 26" stroke="#67e8f9" strokeWidth="10" strokeLinecap="round"/></svg></div><div className="p-7 text-center sm:p-10"><p className="text-xs font-bold tracking-[0.22em] text-rose-300">PAYMENT NOT COMPLETED</p><h1 className="mt-3 text-3xl font-bold">No worries—let&apos;s try again</h1><p className="mx-auto mt-4 max-w-lg leading-7 text-slate-300">{message}</p><div className="mx-auto mt-7 max-w-sm"><OnboardingPaymentButton /></div><Link href="/login" className="mt-5 inline-block text-sm font-medium text-slate-400 hover:text-white">Return to sign in</Link></div></section></main>;
}
