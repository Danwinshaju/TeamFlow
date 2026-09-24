"use client";
/* Chat images are authenticated data URLs, so Next image optimization cannot cache them. */
/* eslint-disable @next/next/no-img-element */

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { authFetch, refreshAuthentication } from "@/lib/auth-fetch";

type Attachment = { type: "image" | "audio" | "file"; name: string; mimeType: string; dataUrl: string };
type Member = { id: string; name: string; avatarDataUrl: string | null; availabilityStatus: string };
type Message = { id: string; body: string; name: string; userId: string; createdAt: string; recipientUserId?: string | null; replyToId?: string | null; replyBody?: string | null; replyName?: string | null; replyDeletedAt?: string | null; deletedAt?: string | null; attachmentType?: Attachment["type"] | null; attachmentName?: string | null; attachmentMimeType?: string | null; attachmentDataUrl?: string | null };
type Reply = { error?: string; ok?: boolean; message?: Message; messages?: Message[] };

export function WorkspaceChat({ workspaceSlug, userId, members }: { workspaceSlug: string; userId: string; members: Member[] }) {
  const socket = useRef<Socket | null>(null);
  const refreshing = useRef(false);
  const stopping = useRef(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [recipientUserId, setRecipientUserId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [connected, setConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const otherMembers = members.filter((member) => member.id !== userId);
  const selectedMember = otherMembers.find((member) => member.id === recipientUserId);
  const visibleMessages = useMemo(() => messages.filter((message) => recipientUserId
    ? (message.userId === userId && message.recipientUserId === recipientUserId) || (message.userId === recipientUserId && message.recipientUserId === userId)
    : !message.recipientUserId), [messages, recipientUserId, userId]);
  function merge(incoming: Message[]) {
    setMessages((previous) => {
      const byId = new Map(previous.map((message) => [message.id, message]));
      for (const message of incoming) {
        const existing = byId.get(message.id);
        byId.set(message.id, {
          ...existing,
          ...message,
          replyToId: message.replyToId ?? existing?.replyToId,
          replyBody: message.replyBody ?? existing?.replyBody,
          replyName: message.replyName ?? existing?.replyName,
          replyDeletedAt: message.replyDeletedAt ?? existing?.replyDeletedAt,
        });
      }
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(-100);
    });
  }
  useEffect(() => {
    stopping.current = false;
    const client = io({ auth: { workspaceSlug }, autoConnect: false });
    socket.current = client;
    client.on("connect", () => {
      setConnected(true); setError("");
      client.timeout(15000).emit("messages:history", (timeout: Error | null, reply: Reply) => {
        if (timeout || reply?.error) setError(reply?.error || "Could not load message history.");
        else merge(reply.messages || []);
      });
    });
    client.on("messages:new", (message: Message) => merge([message]));
    client.on("messages:deleted", ({ id, deletedAt }: { id: string; deletedAt: string }) => setMessages((current) => current.map((message) => message.id === id ? { ...message, body: "", attachmentType: null, attachmentDataUrl: null, deletedAt } : message)));
    const restoreConnection = async () => {
      if (stopping.current || refreshing.current) return;
      refreshing.current = true;
      setConnected(false); setError("Restoring your secure connection…");
      try {
        if (await refreshAuthentication()) { setError(""); if (!stopping.current) client.connect(); }
        else setError("Your secure session is no longer available. Sign in again once; future server restarts will keep your session.");
      } catch { setError("Unable to reconnect. Check your network and try again."); }
      finally { refreshing.current = false; }
    };
    client.on("disconnect", reason => { setConnected(false); if (reason === "io server disconnect") void restoreConnection(); else setError("Connection interrupted. Reconnecting…"); });
    client.on("connect_error", (connectionError: Error) => {
      const reason = connectionError.message || "Unable to connect to team messaging.";
      setError(`Chat connection failed: ${reason}`);
      if (/session|sign in|token/i.test(reason)) void restoreConnection();
    });
    client.connect();
    return () => { stopping.current = true; client.removeAllListeners(); client.disconnect(); socket.current = null; };
  }, [workspaceSlug]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [visibleMessages]);
  async function reconnect() {
    try {
      if (!(await refreshAuthentication())) { setError("Please sign in again to use messaging."); return; }
      socket.current?.disconnect().connect();
    } catch { setError("Unable to reconnect. Check your connection."); }
  }
  function readFile(file: File | null, forcedType?: Attachment["type"]) {
    if (!file) return;
    if (file.size > 3_000_000) { setError("Attachments must be smaller than 3 MB."); return; }
    const type = forcedType || (file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : "file");
    const reader = new FileReader();
    reader.onload = () => setAttachment({ type, name: file.name, mimeType: file.type, dataUrl: String(reader.result) });
    reader.readAsDataURL(file); setError("");
  }
  async function toggleRecording() {
    if (recording) { recorder.current?.stop(); setRecording(false); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks.current = [];
      const media = new MediaRecorder(stream); recorder.current = media;
      media.ondataavailable = event => chunks.current.push(event.data);
      media.onstop = () => { const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" }); stream.getTracks().forEach(track => track.stop()); readFile(new File([blob], `voice-${Date.now()}.webm`, { type: blob.type }), "audio"); };
      media.start(); setRecording(true); setError("");
    } catch { setError("Microphone access is required to record a voice message."); }
  }
  function send(event: React.FormEvent) {
    event.preventDefault();
    if (!connected || sending || (!body.trim() && !attachment)) return;
    const messageId = secureUuid();
    const sentBody = body.trim();
    const sentAttachment = attachment;
    setSending(true); setError("");
    merge([{ id: messageId, body: sentBody, name: "You", userId, createdAt: new Date().toISOString(), recipientUserId, replyToId: replyTo?.id, replyBody: replyTo?.body, replyName: replyTo?.name, replyDeletedAt: replyTo?.deletedAt, attachmentType: sentAttachment?.type, attachmentName: sentAttachment?.name, attachmentMimeType: sentAttachment?.mimeType, attachmentDataUrl: sentAttachment?.dataUrl }]);
    const replyToId = replyTo?.id || null;
    setBody(""); setAttachment(null); setReplyTo(null);
    socket.current?.timeout(8000).emit("messages:send", { id: messageId, body: sentBody, attachment: sentAttachment, recipientUserId, replyToId }, (timeout: Error | null, reply: Reply) => {
      setSending(false);
      if (timeout || reply?.error) { setError(reply?.error || "The message is still waiting for confirmation. Check your connection before sending it again."); return; }
      if (reply.message) merge([reply.message]);
    });
  }
  async function deleteMessage(message: Message) {
    if (!window.confirm("Delete this message for everyone in this conversation?")) return;
    setError("");
    try {
      const response = await authFetch(`/api/workspaces/${workspaceSlug}/messages/${message.id}`, { method: "DELETE" });
      const result = await response.json() as { id?: string; deletedAt?: string; error?: string };
      if (!response.ok || !result.deletedAt) { setError(result.error || "Could not delete this message."); return; }
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, body: "", attachmentType: null, attachmentName: null, attachmentDataUrl: null, deletedAt: result.deletedAt } : item));
      socket.current?.timeout(5000).emit("messages:delete", { id: message.id }, () => undefined);
    } catch { setError("Unable to connect to TeamFlow. The message was not deleted."); }
  }
  function chooseConversation(id: string | null) { setRecipientUserId(id); setReplyTo(null); setError(""); }
  return <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-violet-950/20">
    <div className="border-b border-white/10 px-5 py-4"><div className="flex items-center justify-between"><div><div className="flex items-center gap-2"><span className="text-lg text-violet-300">{recipientUserId ? "●" : "#"}</span><h2 className="text-lg font-semibold">{selectedMember?.name || "Team conversation"}</h2></div><p className="mt-1 text-sm text-slate-400">{selectedMember ? "Private conversation · only you two can read this" : "A shared room for everyone in this workspace"}</p></div><span className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs ${connected ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-400/10 text-amber-300"}`}><span className={`h-2 w-2 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />{connected ? "Live" : "Offline"}</span></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1"><ConversationButton active={!recipientUserId} label="Team group" onClick={() => chooseConversation(null)} />{otherMembers.map((member) => <ConversationButton key={member.id} active={recipientUserId === member.id} label={member.name} online={member.availabilityStatus !== "offline"} onClick={() => chooseConversation(member.id)} />)}</div></div>
    <div role="log" aria-label="Workspace messages" aria-live="polite" className="h-[460px] space-y-4 overflow-y-auto bg-slate-950/50 p-5">
      {!visibleMessages.length && <div className="flex h-full items-center justify-center text-center"><div><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-400/10 text-xl text-violet-300">{recipientUserId ? "✦" : "#"}</div><p className="mt-4 font-medium">{recipientUserId ? `Message ${selectedMember?.name}` : "Start your team conversation"}</p><p className="mt-1 text-sm text-slate-500">{recipientUserId ? "This private chat is visible only to both of you." : "Share an update or ask the group a question."}</p></div></div>}
      {visibleMessages.map(message => <MessageBubble key={message.id} message={message} mine={message.userId === userId} onReply={() => setReplyTo(message)} onDelete={() => deleteMessage(message)} />)}<div ref={bottom} />
    </div>
    {error && <p role="alert" className="mx-4 mt-3 rounded-xl bg-amber-400/10 px-4 py-2 text-sm text-amber-200">{error}</p>}
    {!connected && <button type="button" onClick={() => void reconnect()} className="mx-4 mt-2 text-sm text-violet-300 underline">Reconnect</button>}
    <form onSubmit={send} className="border-t border-white/10 bg-slate-900/70 p-4">
      {replyTo && <div className="mb-3 flex items-start justify-between rounded-xl border-l-4 border-violet-400 bg-slate-950/70 px-4 py-3 text-sm"><div className="min-w-0"><p className="font-semibold text-violet-300">Replying to {replyTo.userId === userId ? "yourself" : replyTo.name}</p><p className="mt-1 truncate text-slate-400">{replyTo.deletedAt ? "Deleted message" : replyTo.body || replyTo.attachmentName || "Attachment"}</p></div><button type="button" onClick={() => setReplyTo(null)} aria-label="Cancel reply" className="ml-3 text-xl text-slate-400">×</button></div>}
      {attachment && <div className="mb-3 flex items-center justify-between rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-3 text-sm"><span className="truncate">{attachment.type === "image" ? "🖼️" : attachment.type === "audio" ? "🎙️" : "📎"} {attachment.name}</span><button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment">×</button></div>}
      <div className="flex items-end gap-2"><label title="Attach image or file" className="cursor-pointer rounded-xl border border-white/15 px-3 py-3 hover:bg-white/10">📎<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,audio/*,.pdf,.txt,.doc,.docx,.xls,.xlsx" className="sr-only" onChange={event => { readFile(event.target.files?.[0] || null); event.currentTarget.value = ""; }} /></label><button type="button" onClick={() => void toggleRecording()} title={recording ? "Stop recording" : "Record voice message"} className={`rounded-xl border px-3 py-3 ${recording ? "border-red-400 bg-red-400/20 text-red-200" : "border-white/15 hover:bg-white/10"}`}>{recording ? "■" : "🎙️"}</button><textarea rows={2} maxLength={2000} value={body} onChange={event => setBody(event.target.value)} placeholder={recording ? "Recording voice…" : "Write a message…"} className="min-h-12 flex-1 resize-none rounded-2xl border border-white/15 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-violet-400" /><button disabled={!connected || sending || (!body.trim() && !attachment)} className="min-w-24 rounded-2xl bg-violet-500 px-5 py-3 font-semibold text-white hover:bg-violet-400 disabled:opacity-40">{sending ? "Confirming…" : "Send"}</button></div>
      <p className="mt-2 text-xs text-slate-500">{recipientUserId ? "Private message" : "Shared with the team"} · images, voice and documents up to 3 MB</p>
    </form>
  </section>;
}

function ConversationButton({ active, label, online, onClick }: { active: boolean; label: string; online?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${active ? "border-violet-400/50 bg-violet-500/15 text-white" : "border-white/10 text-slate-400 hover:bg-white/5 hover:text-white"}`}>{online !== undefined && <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400" : "bg-slate-500"}`} />}{label}</button>;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";
}

const MessageBubble = memo(function MessageBubble({ message, mine, onReply, onDelete }: { message: Message; mine: boolean; onReply: () => void; onDelete: () => void }) {
  const date = new Date(message.createdAt);
  return <article style={{ contentVisibility: "auto", containIntrinsicSize: "80px" }} className={`group flex gap-3 ${mine ? "flex-row-reverse" : ""}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-xs font-bold">{initials(message.name)}</div><div className={`max-w-[82%] ${mine ? "text-right" : ""}`}><div className={`mb-1 flex items-center gap-2 text-xs text-slate-500 ${mine ? "justify-end" : ""}`}><strong className="text-slate-300">{mine ? "You" : message.name}</strong><time title={date.toLocaleString()} dateTime={message.createdAt}>{friendlyTime(date)}</time></div><div className={`space-y-2 overflow-hidden rounded-2xl p-2 text-left ${mine ? "rounded-tr-sm bg-violet-500" : "rounded-tl-sm border border-white/10 bg-slate-800"}`}>{message.replyToId && <div className="rounded-lg border-l-4 border-white/50 bg-black/20 px-3 py-2 text-xs"><p className="font-semibold">{message.replyName || "Message"}</p><p className="mt-0.5 truncate opacity-75">{message.replyDeletedAt ? "Deleted message" : message.replyBody || "Attachment"}</p></div>}{message.deletedAt ? <p className="px-2 py-1 text-sm italic text-white/70">This message was deleted</p> : <>{message.body && <p className="whitespace-pre-wrap break-words px-2 py-1 text-sm leading-6">{message.body}</p>}{message.attachmentDataUrl && message.attachmentType === "image" && <img src={message.attachmentDataUrl} alt={message.attachmentName || "Shared image"} loading="lazy" decoding="async" className="max-h-72 rounded-xl object-contain" />}{message.attachmentDataUrl && message.attachmentType === "audio" && <audio controls preload="none" src={message.attachmentDataUrl} className="max-w-full" />}{message.attachmentDataUrl && message.attachmentType === "file" && <a href={message.attachmentDataUrl} download={message.attachmentName || "attachment"} className="flex items-center gap-2 rounded-xl bg-black/20 px-3 py-3 text-sm underline">📄 {message.attachmentName || "Download attachment"}</a>}</>}</div>{!message.deletedAt && <div className={`mt-1 flex gap-3 text-xs text-slate-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${mine ? "justify-end" : ""}`}><button type="button" onClick={onReply} className="hover:text-violet-300">Reply</button>{mine && <button type="button" onClick={onDelete} className="hover:text-rose-300">Delete for everyone</button>}</div>}</div></article>;
});

function friendlyTime(date: Date) {
  const today = new Date(); const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}

function secureUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}
