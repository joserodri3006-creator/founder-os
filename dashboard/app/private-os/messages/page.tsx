"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";

type Provider = "instagram" | "whatsapp" | "all";

type Thread = {
  id: string;
  provider: "instagram" | "whatsapp";
  display_name: string;
  username: string | null;
  title: string | null;
  last_message_at: string | null;
  last_message_text: string | null;
  unread_count: number;
  is_group: boolean;
  is_tracked: boolean;
};

type Message = {
  id: string;
  provider: "instagram" | "whatsapp";
  direction: "inbound" | "outbound";
  sender_name: string | null;
  body_text: string | null;
  media: unknown[] | null;
  received_at: string;
  remote_deleted_at: string | null;
};

type WhatsAppStatus = {
  configured: boolean;
  bridge_status: "stopped" | "queued" | "running" | "not_migrated" | string;
  queued_or_running?: number;
  latest_run?: {
    id: string;
    action: string;
    status: string;
    params: Record<string, unknown>;
    result: Record<string, unknown>;
    error: string | null;
    queued_at: string;
    started_at: string | null;
    finished_at: string | null;
  } | null;
  read_receipts?: boolean;
  note?: string;
};

function fmt(ts: string | null) {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} · ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
}

function providerLabel(provider: string) {
  if (provider === "instagram") return "Instagram";
  if (provider === "whatsapp") return "WhatsApp";
  return "Alle";
}

export default function PrivateMessagesPage() {
  const { user, loading: authLoading } = useAuth();
  const [provider, setProvider] = useState<Provider>("instagram");
  const [trackedOnly, setTrackedOnly] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [waBusy, setWaBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadThreads() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ provider, tracked_only: String(trackedOnly) });
      const res = await fetch(`/api/private-os/messages?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Private-OS-Inbox konnte nicht geladen werden.");
      const list = Array.isArray(data) ? data : [];
      setThreads(list);
      setSelectedId((current) => current && list.some((t: Thread) => t.id === current) ? current : (list[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Private-OS-Inbox konnte nicht geladen werden.");
      setThreads([]);
      setSelectedId(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(threadId: string) {
    setThreadLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/private-os/messages/${threadId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Thread konnte nicht geladen werden.");
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thread konnte nicht geladen werden.");
      setMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }

  async function loadWhatsAppStatus() {
    try {
      const res = await fetch("/api/private-os/whatsapp/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "WhatsApp-Status konnte nicht geladen werden.");
      setWaStatus(data);
    } catch (err) {
      setWaStatus({ configured: false, bridge_status: "error", note: err instanceof Error ? err.message : "WhatsApp-Status nicht verfügbar" });
    }
  }

  async function queueWhatsAppRun(mode: "sync" | "history_sync") {
    setWaBusy(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/private-os/whatsapp/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "history_sync"
          ? { mode, history_days: 2, duration_seconds: 90 }
          : { mode, duration_seconds: 45 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "WhatsApp-Sync konnte nicht gestartet werden.");
      setStatus(mode === "history_sync" ? "Experimenteller WhatsApp-History-Sync wurde eingereiht." : "WhatsApp-Abruf wurde eingereiht.");
      await loadWhatsAppStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "WhatsApp-Sync konnte nicht gestartet werden.");
    } finally {
      setWaBusy(false);
    }
  }

  async function queueWhatsAppStop() {
    setWaBusy(true);
    setStatus(null);
    setError(null);
    try {
      const res = await fetch("/api/private-os/whatsapp/stop", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "WhatsApp-Bridge konnte nicht gestoppt werden.");
      setStatus("Bridge-Stopp wurde eingereiht.");
      await loadWhatsAppStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "WhatsApp-Bridge konnte nicht gestoppt werden.");
    } finally {
      setWaBusy(false);
    }
  }

  useEffect(() => { if (!authLoading && user?.role === "founder") void loadThreads(); }, [provider, trackedOnly, authLoading, user?.role]);
  useEffect(() => { if (!authLoading && user?.role === "founder") void loadWhatsAppStatus(); }, [authLoading, user?.role]);
  useEffect(() => { if (selectedId && user?.role === "founder") void loadMessages(selectedId); else setMessages([]); }, [selectedId, user?.role]);

  const selected = useMemo(() => threads.find((t) => t.id === selectedId) ?? null, [threads, selectedId]);

  if (authLoading) return <Empty text="Berechtigung wird geprüft…" />;
  if (user?.role !== "founder") {
    return (
      <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto">
        <div className="rounded-2xl p-6" style={{ background: "#FFFFFF", border: "1px solid #D1D5E8" }}>
          <p className="uppercase tracking-[0.18em] text-xs font-semibold" style={{ color: "#A07840" }}>Private OS</p>
          <h1 className="mt-2" style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 28, color: "#14193A" }}>Nur für den Founder</h1>
          <p className="text-sm mt-2" style={{ color: "#6B7280" }}>Private Nachrichten und Antwortaktionen sind ausschließlich für den Founder sichtbar.</p>
        </div>
      </div>
    );
  }

  async function queueReply() {
    if (!selected || !replyText.trim()) return;
    setStatus(null);
    const res = await fetch(`/api/private-os/messages/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reply", body_text: replyText }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error ?? "Antwort konnte nicht vorgemerkt werden.");
      return;
    }
    setReplyText("");
    setStatus("Antwort wurde als freizugebende Aktion in die Warteschlange gelegt.");
  }

  async function queueDelete(messageId: string, remote: boolean) {
    if (!selected) return;
    const label = remote ? "wirklich beim Anbieter löschen" : "lokal ausblenden";
    if (!window.confirm(`Diese Nachricht ${label}?`)) return;
    const res = await fetch(`/api/private-os/messages/${selected.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: remote ? "delete_remote" : "delete_local", message_id: messageId }),
    });
    const data = await res.json();
    setStatus(res.ok ? "Löschaktion wurde in die Warteschlange gelegt." : (data.error ?? "Löschaktion fehlgeschlagen."));
  }

  return (
    <div className="px-4 py-5 sm:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <p className="uppercase tracking-[0.18em] text-xs font-semibold" style={{ color: "#A07840" }}>Private OS</p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: 30, color: "#14193A", letterSpacing: "-0.03em" }}>Nachrichten-Inbox</h1>
          <p className="text-sm mt-1" style={{ color: "#6B7280" }}>Instagram-first Thread-Ansicht für gespeicherte Kontakte. Antworten und Löschungen werden nur als Aktionen vorgemerkt.</p>
        </div>
        <button onClick={() => void loadThreads()} style={ghostButton}>Aktualisieren</button>
      </div>

      <div className="rounded-2xl p-4 mb-5" style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", boxShadow: "0 2px 12px rgba(27,42,94,0.06)" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="uppercase tracking-[0.18em] text-[11px] font-semibold" style={{ color: "#25D366" }}>WhatsApp On-Demand</p>
            <h2 className="mt-1 text-lg font-semibold" style={{ color: "#14193A" }}>Bridge nur zeitweise aktivieren</h2>
            <p className="text-sm mt-1 max-w-3xl" style={{ color: "#6B7280" }}>
              Status: <strong>{waStatus?.bridge_status ?? "lädt…"}</strong> · Read Receipts bleiben aus. Der Button legt einen lokalen Worker-Run an; danach wird die Bridge wieder gestoppt.
            </p>
            {waStatus?.latest_run && (
              <p className="text-xs mt-2" style={{ color: "#6B7280" }}>
                Letzter Run: {waStatus.latest_run.action} · {waStatus.latest_run.status} · {fmt(waStatus.latest_run.finished_at ?? waStatus.latest_run.started_at ?? waStatus.latest_run.queued_at)}
                {typeof waStatus.latest_run.result?.stored === "number" ? ` · ${waStatus.latest_run.result.stored} gespeichert` : ""}
                {waStatus.latest_run.error ? ` · Fehler: ${waStatus.latest_run.error}` : ""}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-wrap justify-end">
            <button disabled={waBusy} onClick={() => void loadWhatsAppStatus()} style={ghostButton}>Status prüfen</button>
            <button disabled={waBusy} onClick={() => void queueWhatsAppRun("sync")} style={primaryButton}>Jetzt WhatsApp abrufen</button>
            <button disabled={waBusy} onClick={() => void queueWhatsAppRun("history_sync")} style={ghostButton}>letzte 2 Tage versuchen</button>
            <button disabled={waBusy} onClick={() => void queueWhatsAppStop()} style={ghostButton}>Bridge stoppen</button>
          </div>
        </div>
      </div>

      <div className="flex gap-2.5 mb-5 items-center flex-wrap p-3 rounded-xl" style={{ background: "#FFFFFF", border: "1px solid #D1D5E8" }}>
        {(["instagram", "whatsapp", "all"] as Provider[]).map((p) => (
          <button key={p} onClick={() => setProvider(p)} style={{ ...pillButton, ...(provider === p ? pillActive : {}) }}>{providerLabel(p)}</button>
        ))}
        <label className="text-sm flex items-center gap-2 ml-2" style={{ color: "#4B5563" }}>
          <input type="checkbox" checked={trackedOnly} onChange={(e) => setTrackedOnly(e.target.checked)} />
          nur freigegebene Kontakte
        </label>
      </div>

      {status && <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(200,169,110,0.12)", border: "1px solid rgba(200,169,110,0.28)", color: "#7A5A25" }}>{status}</div>}
      {error && <div className="mb-4 rounded-xl px-4 py-3 text-sm" style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C" }}>{error}</div>}

      <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", boxShadow: "0 2px 12px rgba(27,42,94,0.08)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "340px minmax(0, 1fr)", height: "calc(100vh - 235px)", minHeight: 560 }}>
          <section style={{ borderRight: "1px solid #D1D5E8", overflowY: "auto" }}>
            {loading ? <Empty text="Laden…" /> : threads.length === 0 ? <Empty text="Noch keine gespeicherten Threads." /> : threads.map((thread) => (
              <button key={thread.id} onClick={() => setSelectedId(thread.id)} className="w-full text-left p-4 transition-colors" style={{ borderBottom: "1px solid #EEF0F7", background: selectedId === thread.id ? "#F7F8FC" : "#FFFFFF" }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="font-semibold truncate" style={{ color: "#14193A" }}>{thread.display_name}</div>
                  <span className="text-[11px] uppercase" style={{ color: "#A07840" }}>{providerLabel(thread.provider)}</span>
                </div>
                <div className="text-xs mt-1" style={{ color: "#6B7280" }}>{thread.username ? `@${thread.username}` : fmt(thread.last_message_at)}</div>
                <p className="text-sm mt-2 line-clamp-2" style={{ color: "#4B5563" }}>{thread.last_message_text || "Keine Vorschau"}</p>
              </button>
            ))}
          </section>

          <section className="flex flex-col min-h-0">
            {!selected ? <Empty text="Thread auswählen" /> : (
              <>
                <div className="px-5 py-4" style={{ borderBottom: "1px solid #D1D5E8" }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold" style={{ color: "#14193A" }}>{selected.display_name}</h2>
                      <p className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{providerLabel(selected.provider)} · {selected.is_group ? "Gruppe" : "Direktnachricht"}</p>
                    </div>
                    <span className="text-xs rounded-full px-2.5 py-1" style={{ background: selected.is_tracked ? "rgba(22,163,74,0.10)" : "#F3F4F6", color: selected.is_tracked ? "#15803D" : "#6B7280" }}>{selected.is_tracked ? "freigegeben" : "nicht freigegeben"}</span>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-5" style={{ background: "#FAFBFE" }}>
                  {threadLoading ? <Empty text="Thread lädt…" /> : messages.length === 0 ? <Empty text="Noch keine gespeicherten Nachrichten in diesem Thread." /> : messages.map((message) => (
                    <div key={message.id} className="mb-4 flex" style={{ justifyContent: message.direction === "outbound" ? "flex-end" : "flex-start" }}>
                      <div style={{ maxWidth: "72%" }}>
                        <div className="rounded-2xl px-4 py-3" style={{ background: message.direction === "outbound" ? "#14193A" : "#FFFFFF", color: message.direction === "outbound" ? "#FFFFFF" : "#14193A", border: message.direction === "outbound" ? "none" : "1px solid #E5E7EB" }}>
                          <p className="text-sm whitespace-pre-wrap">{message.remote_deleted_at ? "[remote gelöscht]" : (message.body_text || "[Medium]")}</p>
                        </div>
                        <div className="flex gap-2 mt-1 text-[11px]" style={{ color: "#9CA3AF" }}>
                          <span>{fmt(message.received_at)}</span>
                          <button onClick={() => void queueDelete(message.id, false)} style={linkButton}>lokal ausblenden</button>
                          <button onClick={() => void queueDelete(message.id, true)} style={linkButton}>remote löschen</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4" style={{ borderTop: "1px solid #D1D5E8", background: "#FFFFFF" }}>
                  <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`${providerLabel(selected.provider)}-Antwort schreiben…`} rows={3} className="w-full rounded-xl p-3 text-sm outline-none" style={{ border: "1px solid #D1D5E8", resize: "none" }} />
                  <div className="flex justify-end mt-2">
                    <button disabled={!replyText.trim()} onClick={() => void queueReply()} style={{ ...primaryButton, opacity: replyText.trim() ? 1 : 0.45 }}>Antwort vormerken</button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="h-full flex items-center justify-center text-sm" style={{ color: "#9CA3AF" }}>{text}</div>;
}

const pillButton = { padding: "8px 13px", borderRadius: "999px", border: "1px solid #D1D5E8", background: "#FFFFFF", color: "#4B5563", fontSize: 13, cursor: "pointer" };
const pillActive = { background: "#14193A", color: "#FFFFFF", borderColor: "#14193A" };
const ghostButton = { padding: "9px 13px", borderRadius: 10, border: "1px solid #D1D5E8", background: "#FFFFFF", color: "#14193A", fontSize: 13, cursor: "pointer" };
const primaryButton = { padding: "10px 14px", borderRadius: 10, border: "none", background: "#14193A", color: "#FFFFFF", fontSize: 13, fontWeight: 600, cursor: "pointer" };
const linkButton = { background: "transparent", border: "none", color: "#6B7280", cursor: "pointer", padding: 0, fontSize: 11 };
