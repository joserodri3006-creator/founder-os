"use client";

import { useEffect, useState } from "react";
import { useVenture } from "@/context/VentureContext";
import Link from "next/link";

interface QueueEntry {
  id: string;
  created_at: string;
  venture: string;
  lead_id: string | null;
  from_email: string;
  to_email: string;
  to_name: string | null;
  subject: string;
  body_text: string;
  is_ai_draft: boolean;
  status: "queued" | "sending" | "sent" | "error";
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
}

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  queued:  { bg: "#EEF0F7",              color: "#1B2A5E",  label: "In Queue" },
  sending: { bg: "rgba(200,169,110,.15)", color: "#A07840",  label: "Wird gesendet…" },
  sent:    { bg: "rgba(22,163,74,.1)",    color: "#15803D",  label: "Gesendet" },
  error:   { bg: "rgba(220,38,38,.08)",   color: "#B91C1C",  label: "Fehler" },
};

const FILTER_OPTIONS = [
  { value: "alle",   label: "Alle" },
  { value: "queued", label: "In Queue" },
  { value: "sent",   label: "Gesendet" },
  { value: "error",  label: "Fehler" },
];

export default function MailQueuePage() {
  const { venture } = useVenture();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("alle");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ venture, status: filterStatus, limit: "200" });
    const res = await fetch(`/api/leads/mail-queue?${params}`);
    const data = await res.json();
    setEntries(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture, filterStatus]);

  async function handleRemove(id: string) {
    setRemoving(id);
    await fetch(`/api/leads/mail-queue?id=${id}`, { method: "DELETE" });
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setRemoving(null);
  }

  const counts = entries.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const selectStyle: React.CSSProperties = {
    fontSize: "13px", border: "1px solid #D1D5E8", borderRadius: "8px",
    padding: "7px 12px", background: "#FFFFFF", color: "#14193A",
    outline: "none", fontFamily: "var(--font-sans)",
  };

  return (
    <div className="px-4 py-5 sm:p-8 max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "28px", color: "#14193A", letterSpacing: "-0.02em" }}>
            Mail Queue
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
            Hermes versendet alle 5 Minuten ausstehende Mails via SMTP
          </p>
        </div>
        <button
          onClick={load}
          className="text-sm px-3 py-2 rounded-lg font-medium transition-colors"
          style={{ border: "1px solid #D1D5E8", background: "#FFFFFF", color: "#14193A" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#EEF0F7")}
          onMouseLeave={e => (e.currentTarget.style.background = "#FFFFFF")}
        >
          ↻ Aktualisieren
        </button>
      </div>

      {/* Status-Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {(["queued", "sending", "sent", "error"] as const).map((s) => {
          const st = STATUS_STYLE[s];
          return (
            <div key={s} className="rounded-xl p-4 cursor-pointer"
              style={{ background: st.bg, border: `1px solid ${st.color}20` }}
              onClick={() => setFilterStatus(filterStatus === s ? "alle" : s)}
            >
              <p className="text-2xl font-bold" style={{ color: st.color }}>{counts[s] ?? 0}</p>
              <p className="text-xs font-semibold mt-0.5" style={{ color: st.color }}>{st.label}</p>
            </div>
          );
        })}
      </div>

      {/* Filter */}
      <div className="flex gap-2.5 mb-4 flex-wrap items-center p-3 rounded-xl"
        style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", boxShadow: "0 2px 12px rgba(27,42,94,0.08)" }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={selectStyle}>
          {FILTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <p className="text-xs ml-auto" style={{ color: "#6B7280" }}>{entries.length} Einträge</p>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center gap-2 py-8" style={{ color: "#6B7280" }}>
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }} />
          <span className="text-sm">Laden…</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "#FFFFFF", border: "1px solid #D1D5E8" }}>
          <p className="text-sm" style={{ color: "#6B7280" }}>Keine Einträge</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => {
            const st = STATUS_STYLE[entry.status] ?? STATUS_STYLE.queued;
            const isOpen = expanded === entry.id;
            return (
              <div key={entry.id} className="rounded-xl overflow-hidden"
                style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", boxShadow: "0 1px 4px rgba(27,42,94,0.06)" }}>

                {/* Kompakte Zeile */}
                <div className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpanded(isOpen ? null : entry.id)}
                  style={{ borderBottom: isOpen ? "1px solid #EEF0F7" : "none" }}>

                  {/* Status-Badge */}
                  <span className="text-xs font-semibold rounded-full px-2.5 py-1 shrink-0"
                    style={{ background: st.bg, color: st.color }}>
                    {st.label}
                  </span>

                  {/* An + Betreff */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#14193A" }}>
                      {entry.to_name ? `${entry.to_name} <${entry.to_email}>` : entry.to_email}
                    </p>
                    <p className="text-xs truncate" style={{ color: "#6B7280" }}>{entry.subject}</p>
                  </div>

                  {/* Datum */}
                  <p className="text-xs shrink-0 hidden sm:block" style={{ color: "#9CA3AF" }}>
                    {new Date(entry.sent_at ?? entry.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </p>

                  {/* Toggle */}
                  <span style={{ color: "#9CA3AF", fontSize: "10px" }}>{isOpen ? "▲" : "▼"}</span>
                </div>

                {/* Expandierter Bereich */}
                {isOpen && (
                  <div className="px-4 py-3 space-y-3">

                    {/* Fehler */}
                    {entry.error_message && (
                      <div className="rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(220,38,38,.06)", color: "#B91C1C", border: "1px solid rgba(220,38,38,.15)" }}>
                        ❌ {entry.error_message}
                        {entry.retry_count > 0 && <span className="ml-2" style={{ color: "#6B7280" }}>({entry.retry_count}× versucht)</span>}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: "#6B7280" }}>
                      <div><span className="font-semibold">Von:</span> {entry.from_email}</div>
                      <div><span className="font-semibold">An:</span> {entry.to_email}</div>
                      {entry.lead_id && (
                        <div>
                          <span className="font-semibold">Lead:</span>{" "}
                          <Link href={`/leads/${entry.lead_id}`} style={{ color: "#1B2A5E" }} className="hover:underline">
                            Zum Lead →
                          </Link>
                        </div>
                      )}
                      {entry.is_ai_draft && <div><span className="font-semibold">Typ:</span> KI-Entwurf</div>}
                      <div><span className="font-semibold">Eingestellt:</span> {new Date(entry.created_at).toLocaleString("de-DE")}</div>
                      {entry.sent_at && <div><span className="font-semibold">Gesendet:</span> {new Date(entry.sent_at).toLocaleString("de-DE")}</div>}
                    </div>

                    {/* Mailtext */}
                    <div className="rounded-lg p-3" style={{ background: "#F7F8FC", border: "1px solid #E5E7F0" }}>
                      <p className="text-xs font-semibold mb-1" style={{ color: "#6B7280" }}>NACHRICHT</p>
                      <pre className="text-xs whitespace-pre-wrap break-words" style={{ color: "#374151", fontFamily: "var(--font-sans)" }}>
                        {entry.body_text}
                      </pre>
                    </div>

                    {/* Aktionen */}
                    {entry.status === "queued" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleRemove(entry.id)}
                          disabled={removing === entry.id}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          style={{ background: "rgba(220,38,38,.08)", color: "#B91C1C", border: "none", cursor: removing === entry.id ? "not-allowed" : "pointer" }}
                        >
                          {removing === entry.id ? "Wird entfernt…" : "Aus Queue entfernen"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
