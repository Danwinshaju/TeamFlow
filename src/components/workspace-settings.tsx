"use client";
import { authFetch as fetch } from "@/lib/auth-fetch";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ManagedMember = { id: string; name: string; email: string; role: "owner" | "admin" | "member" };

export function WorkspaceSettings({ workspaceSlug, initialName, members }: { workspaceSlug: string; initialName: string; members: ManagedMember[] }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [hiddenMemberIds, setHiddenMemberIds] = useState<Set<string>>(() => new Set());
  const [memberRoles, setMemberRoles] = useState<Record<string, "admin" | "member">>(() => Object.fromEntries(
    members.filter((member) => member.role !== "owner").map((member) => [member.id, member.role as "admin" | "member"]),
  ));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputClassName = "w-full rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm outline-none transition focus:border-violet-400";

  async function renameWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) { setError(result.error ?? "Unable to update the workspace."); return; }
      setMessage("Workspace name updated."); router.refresh();
    } catch { setError("Unable to connect to the server."); } finally { setSaving(false); }
  }

  async function changeRole(memberId: string, role: "admin" | "member") {
    setUpdatingMemberId(memberId); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/members/${memberId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const result = await readJson(response);
      if (!response.ok) { setError(result.error ?? "Unable to change the member role."); return; }
      setMemberRoles((current) => ({ ...current, [memberId]: role }));
      setMessage(`Member role changed to ${role === "admin" ? "Admin" : "Member"}.`); router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to connect to the server.");
    } finally { setUpdatingMemberId(null); }
  }

  async function removeMember(member: ManagedMember) {
    if (!window.confirm(`Remove ${member.name} from this workspace? Their account and other workspaces will stay active.`)) return;
    setRemovingMemberId(member.id); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/workspaces/${workspaceSlug}/members/${member.id}`, { method: "DELETE" });
      const result = await readJson(response);
      if (!response.ok) { setError(result.error ?? "Unable to remove this member."); return; }
      setHiddenMemberIds((current) => new Set(current).add(member.id));
      setMessage(result.emailSent === false ? "Member removed, but the email notification failed." : "Member removed and notified by email.");
      router.refresh();
    } catch { setError("Unable to connect to the server."); } finally { setRemovingMemberId(null); }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-xl font-semibold">Workspace settings</h2>
      <form onSubmit={renameWorkspace} className="mt-5"><label htmlFor="workspace-name" className="mb-2 block text-sm text-slate-300">Workspace name</label><div className="flex gap-3"><input id="workspace-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} className={inputClassName} required /><button disabled={saving} className="rounded-xl bg-violet-500 px-4 py-2.5 text-sm font-semibold disabled:opacity-60">{saving ? "Saving..." : "Save"}</button></div></form>
      <div className="mt-6 border-t border-white/10 pt-6"><h3 className="font-semibold">Member roles</h3><div className="mt-3 space-y-3">{members.map((member) => <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{member.name}</p><p className="truncate text-xs text-slate-500">{member.email}</p></div>{member.role === "owner" ? <span className="text-xs capitalize text-violet-300">Owner</span> : <select aria-label={`Role for ${member.name}`} value={memberRoles[member.id] ?? member.role} disabled={updatingMemberId === member.id} onChange={(event) => void changeRole(member.id, event.target.value as "admin" | "member")} className="rounded-lg border border-white/15 bg-slate-950 px-2 py-1.5 text-xs"><option value="member">Member</option><option value="admin">Admin</option></select>}</div>)}</div></div>
      <div className="mt-6 border-t border-white/10 pt-6">
        <h3 className="font-semibold">Remove members</h3>
        <p className="mt-1 text-xs text-slate-500">Removal affects this workspace only. The member will receive an email.</p>
        <div className="mt-3 space-y-2">
          {members.filter((member) => member.role !== "owner" && !hiddenMemberIds.has(member.id)).map((member) => (
            <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
              <div className="min-w-0"><p className="truncate text-sm font-medium">{member.name}</p><p className="truncate text-xs text-slate-500">{member.email}</p></div>
              <button type="button" onClick={() => void removeMember(member)} disabled={removingMemberId !== null} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-400/10 disabled:opacity-60">{removingMemberId === member.id ? "Removing…" : "Remove"}</button>
            </div>
          ))}
        </div>
      </div>
      {message && <p className="mt-4 text-sm text-emerald-300">{message}</p>}{error && <p role="alert" className="mt-4 text-sm text-red-300">{error}</p>}
    </section>
  );
}

async function readJson(response: Response): Promise<{ error?: string; emailSent?: boolean }> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as { error?: string; emailSent?: boolean };
  } catch {
    throw new Error(`The server returned an invalid response (${response.status}). Restart TeamFlow and try again.`);
  }
}
