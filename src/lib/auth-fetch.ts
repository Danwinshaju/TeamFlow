"use client";

let pendingRefresh: Promise<boolean> | null = null;

export async function refreshAuthentication(): Promise<boolean> {
  if (!pendingRefresh) {
    const renew = async () => {
      const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "same-origin", cache: "no-store" });
      return response.ok;
    };
    // Serialize rotations across tabs where Web Locks is available.
    pendingRefresh = (async () => {
      try {
        return navigator.locks?.request
          ? await navigator.locks.request("teamflow-refresh", renew)
          : await renew();
      } catch {
        // Some mobile browsers expose Web Locks but reject it on local HTTP/LAN origins.
        return renew();
      }
    })()
      .finally(() => { pendingRefresh = null; });
  }
  return pendingRefresh;
}

export async function authFetch(input: string, init?: RequestInit) {
  const response = await fetch(input, { ...init, credentials: "same-origin" });
  if (response.status !== 401) return response;
  if (!(await refreshAuthentication())) return response;
  // Retry once only, after the original request was rejected before doing any work.
  return fetch(input, { ...init, credentials: "same-origin" });
}
