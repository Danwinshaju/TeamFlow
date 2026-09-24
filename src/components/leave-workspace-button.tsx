"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

export function LeaveWorkspaceButton(props: { workspaceSlug: string; workspaceName: string; userId: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leaveWorkspace() {
    if (!window.confirm(`Leave ${props.workspaceName}? You will lose access to this workspace.`)) return;
    setLeaving(true);
    setError(null);
    try {
      const response = await authFetch(`/api/workspaces/${props.workspaceSlug}/members/${props.userId}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) {
        setError(result.error ?? "Unable to leave this workspace.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Unable to connect to the server.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={() => void leaveWorkspace()} disabled={leaving} className="w-full rounded-xl border border-red-400/30 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-60">
        {leaving ? "Leaving…" : "Leave workspace"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
