"use client";

import { useEffect, useState } from "react";
import { refreshAuthentication } from "@/lib/auth-fetch";

export default function RefreshSessionPage() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void refreshAuthentication().then((success) => {
      if (!active) return;
      if (!success) { window.location.replace("/login"); return; }
      const next = new URLSearchParams(window.location.search).get("next") || "/dashboard";
      const destination = new URL(next, window.location.origin);
      const safe = destination.origin === window.location.origin &&
        (destination.pathname === "/dashboard" || destination.pathname === "/my-tasks" || destination.pathname.startsWith("/workspaces/"));
      window.location.replace(safe ? destination.href : "/dashboard");
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
    <div role="status" className="text-center">
      <p>{failed ? "We could not reconnect. Please try again." : "Restoring your session…"}</p>
      {failed && <button className="mt-4 rounded-lg bg-violet-500 px-4 py-2" onClick={() => window.location.reload()}>Try again</button>}
    </div>
  </main>;
}
