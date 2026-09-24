"use client";

import { useEffect } from "react";
import { FriendlyErrorState } from "@/components/friendly-error-state";

export default function ApplicationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("TeamFlow page failed", error); }, [error]);
  return <FriendlyErrorState eyebrow="TEAMFLOW HIT A BUMP" title="Something didn't load correctly" description="Your data is safe. Try loading this page again, or return to the dashboard." actionLabel="Try again" onRetry={reset} />;
}
