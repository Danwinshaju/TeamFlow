"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/lib/auth-fetch";

type Availability = "active" | "offline";

export function ProfileMenu({ user }: { user: { name: string; email: string; avatarDataUrl: string | null; availabilityStatus: string } }) {
  const [open, setOpen] = useState(false);
  const [availability, setAvailability] = useState<Availability>(user.availabilityStatus === "offline" ? "offline" : "active");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = user.name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function changeAvailability(status: Availability) {
    if (status === availability || saving) return;
    setSaving(true);
    const previous = availability;
    setAvailability(status);
    try {
      const response = await authFetch("/api/profile/availability", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      if (!response.ok) setAvailability(previous);
    } catch {
      setAvailability(previous);
    } finally {
      setSaving(false);
    }
  }

  return <div ref={menuRef} className="relative">
    <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)} className="flex max-w-[230px] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-1.5 pr-3 text-left transition hover:bg-white/[0.07]">
      <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-bold">
        {user.avatarDataUrl ? <Image src={user.avatarDataUrl} alt="" width={40} height={40} unoptimized className="h-full w-full object-cover" /> : initials}
        <span className={`absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 ${availability === "active" ? "bg-emerald-400" : "bg-slate-500"}`} />
      </span>
      <span className="hidden min-w-0 sm:block"><span className="block truncate text-sm font-semibold">{user.name}</span><span className={`block text-xs ${availability === "active" ? "text-emerald-300" : "text-slate-400"}`}>{availability === "active" ? "Active" : "Offline"}</span></span>
      <span className="hidden text-xs text-slate-500 sm:block">⌄</span>
    </button>
    {open && <div role="menu" className="absolute right-0 top-[calc(100%+0.6rem)] z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-2xl shadow-black/40">
      <div className="border-b border-white/10 px-3 py-3"><p className="truncate font-semibold">{user.name}</p><p className="mt-0.5 truncate text-xs text-slate-400">{user.email}</p></div>
      <div className="p-2"><p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Your availability</p><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => changeAvailability("active")} disabled={saving} className={`rounded-xl border px-3 py-2 text-sm ${availability === "active" ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-300" : "border-white/10 text-slate-400 hover:bg-white/5"}`}>● Active</button><button type="button" onClick={() => changeAvailability("offline")} disabled={saving} className={`rounded-xl border px-3 py-2 text-sm ${availability === "offline" ? "border-slate-400/40 bg-white/10 text-white" : "border-white/10 text-slate-400 hover:bg-white/5"}`}>● Offline</button></div></div>
      <div className="border-t border-white/10 p-2"><Link role="menuitem" href="/profile" className="block rounded-lg px-3 py-2.5 text-sm hover:bg-white/[0.07]">View and edit profile</Link><Link role="menuitem" href="/my-tasks" className="block rounded-lg px-3 py-2.5 text-sm hover:bg-white/[0.07]">My tasks</Link><form action="/api/auth/logout" method="post"><button role="menuitem" className="mt-1 w-full rounded-lg px-3 py-2.5 text-left text-sm text-rose-300 hover:bg-rose-500/10">Sign out</button></form></div>
    </div>}
  </div>;
}
