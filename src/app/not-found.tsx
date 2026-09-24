import { FriendlyErrorState } from "@/components/friendly-error-state";

export default function NotFoundPage() {
  return <FriendlyErrorState eyebrow="404 · LOST IN THE WORKFLOW" title="We couldn't find that page" description="The link may be old, or this test workspace may have been cleared during a server restart." actionLabel="Open dashboard" />;
}
