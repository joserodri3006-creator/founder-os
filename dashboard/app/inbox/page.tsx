"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useVenture } from "@/context/VentureContext";
import { VENTURES } from "@/lib/ventures";

type MatchStatus = "alle" | "matched_lead" | "matched_customer" | "matched_supplier" | "unmatched";

interface InboxMessage {
  id: string;
  venture: string;
  account_email: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_preview: string | null;
  body_text: string | null;
  received_at: string;
  match_status: MatchStatus;
  has_attachments: boolean;
  attachment_names: string[] | null;
  entity_type: "lead" | "customer" | "supplier" | null;
  entity_name: string | null;
  entity_company: string | null;
  entity_href: string | null;
}

const FILTERS: { key: MatchStatus; label: string; hint: string; icon: string }[] = [
  { key: "unmatched", label: "Unmatched", hint: "prüfen", icon: "?" },
  { key: "alle", label: "Alle Mails", hint: "gesamt", icon: "✉" },
  { key: "matched_lead", label: "Leads", hint: "zugeordnet", icon: "↗" },
  { key: "matched_customer", label: "Kunden", hint: "Bestand", icon: "✓" },
  { key: "matched_supplier", label: "Lieferanten", hint: "Partner", icon: "□" },
];

const STATUS_LABELS: Record<MatchStatus, string> = {
  alle: "Alle",
  matched_lead: "Lead",
  matched_customer: "Kunde",
  matched_supplier: "Lieferant",
  unmatched: "Unmatched",
};

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  matched_lead: { bg: "#EAF2FF", color: "#1D4ED8", border: "#BBD5FF" },
  matched_customer: { bg: "#EAFBF1", color: "#15803D", border: "#BDEFD0" },
  matched_supplier: { bg: "#FFF7E6", color: "#A16207", border: "#F5D69B" },
  unmatched: { bg: "#FFF1F2", color: "#BE123C", border: "#FFC8D0" },
};

function fmtDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function fmtFull(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" }) +
    " · " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

function initials(message?: InboxMessage | null) {
  const name = message?.from_name || message?.from_email || "?";
  return name.trim().slice(0, 1).toUpperCase();
}

function senderName(message: InboxMessage) {
  return message.from_name || message.from_email.split("@")[0] || "Unbekannt";
}

export default function InboxPage() {
  const { venture, setVenture } = useVenture();
  const [status, setStatus] = useState<MatchStatus>("unmatched");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/inbox?venture=${venture}&limit=200`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Inbox konnte nicht geladen werden.");
        const list = Array.isArray(data) ? data : [];
        setMessages(list);
        setSelectedId((current) => current && list.some((m: InboxMessage) => m.id === current) ? current : (list[0]?.id ?? null));
      })
      .catch((err: Error) => {
        setError(err.message);
        setMessages([]);
        setSelectedId(null);
      })
      .finally(() => setLoading(false));
  }, [venture]);

  const counts = useMemo(() => {
    const base: Record<MatchStatus, number> = { alle: messages.length, unmatched: 0, matched_lead: 0, matched_customer: 0, matched_supplier: 0 };
    messages.forEach((m) => { base[m.match_status] = (base[m.match_status] ?? 0) + 1; });
    return base;
  }, [messages]);

  const filtered = useMemo(() => {
    return status === "alle" ? messages : messages.filter((m) => m.match_status === status);
  }, [messages, status]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
    } else if (!selectedId || !filtered.some((m) => m.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0] ?? null;
  const currentVenture = VENTURES.find((v) => v.id === venture);

  return (
    <div style={{ minHeight: "calc(100vh - 1px)", padding: "22px", background: "linear-gradient(135deg, #F7F8FC 0%, #EEF3FA 100%)" }}>
      <div style={{ maxWidth: "1380px", margin: "0 auto", background: "rgba(255,255,255,0.88)", border: "1px solid rgba(209,213,232,0.9)", borderRadius: "28px", boxShadow: "0 24px 70px rgba(20,25,58,0.12)", overflow: "hidden", backdropFilter: "blur(14px)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "280px minmax(330px, 430px) minmax(0, 1fr)", minHeight: "760px" }}>
          {/* Left navigation / filters */}
          <aside style={{ borderRight: "1px solid #E6E9F3", background: "#FFFFFF", padding: "26px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "14px", background: "linear-gradient(135deg,#1B2A5E,#3A5BA0)", color: "white", display: "grid", placeItems: "center", fontWeight: 800, boxShadow: "0 10px 24px rgba(27,42,94,0.22)" }}>✉</div>
              <div>
                <h1 style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: "24px", fontWeight: 400, color: "#14193A" }}>Inbox</h1>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#8A91A5" }}>Founder OS Mail Hub</p>
              </div>
            </div>

            <label style={smallLabel}>Venture</label>
            <select value={venture} onChange={(e) => setVenture(e.target.value as typeof venture)} style={selectStyle}>
              {VENTURES.filter((v) => ["online_first", "blazed_outfitters", "brandary"].includes(v.id)).map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>

            <div style={{ marginTop: "26px" }}>
              <label style={smallLabel}>Status</label>
              <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
                {FILTERS.map((filter) => {
                  const active = status === filter.key;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => setStatus(filter.key)}
                      style={{
                        display: "flex", alignItems: "center", gap: "11px", width: "100%", border: active ? "1px solid #1697F6" : "1px solid transparent",
                        background: active ? "linear-gradient(135deg,#1697F6,#087DE8)" : "transparent", color: active ? "white" : "#14193A",
                        borderRadius: "14px", padding: "11px 12px", cursor: "pointer", textAlign: "left", boxShadow: active ? "0 12px 26px rgba(22,151,246,0.26)" : "none",
                      }}
                    >
                      <span style={{ width: "28px", height: "28px", borderRadius: "10px", background: active ? "rgba(255,255,255,0.18)" : "#F0F3FA", display: "grid", placeItems: "center", fontSize: "13px", fontWeight: 700 }}>{filter.icon}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "14px", fontWeight: 700 }}>{filter.label}</span>
                        <span style={{ display: "block", fontSize: "11px", opacity: active ? 0.75 : 0.55 }}>{filter.hint}</span>
                      </span>
                      <span style={{ minWidth: "30px", height: "30px", borderRadius: "999px", background: active ? "white" : "#F0F3FA", color: active ? "#087DE8" : "#9CA3AF", display: "grid", placeItems: "center", fontSize: "12px", fontWeight: 800 }}>{counts[filter.key]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: "28px", padding: "16px", borderRadius: "18px", background: "#F7F8FC", border: "1px solid #E6E9F3" }}>
              <p style={{ margin: 0, color: "#14193A", fontSize: "13px", fontWeight: 700 }}>{currentVenture?.label ?? venture}</p>
              <p style={{ margin: "5px 0 0", color: "#8A91A5", fontSize: "12px", lineHeight: 1.45 }}>{messages.length} Mails im aktuellen Venture. Fokus: Unmatched prüfen und bei Bedarf als Lead/Kontakt nachziehen.</p>
            </div>
          </aside>

          {/* Middle message list */}
          <section style={{ borderRight: "1px solid #E6E9F3", background: "#FBFCFF", display: "flex", flexDirection: "column", minWidth: 0 }}>
            <div style={{ padding: "26px 22px 18px", borderBottom: "1px solid #E6E9F3", background: "rgba(255,255,255,0.82)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div>
                  <p style={{ margin: 0, fontSize: "18px", color: "#14193A", fontWeight: 800 }}>{STATUS_LABELS[status]}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#8A91A5" }}>{filtered.length} Nachrichten</p>
                </div>
                <div style={{ width: "38px", height: "38px", borderRadius: "13px", background: "#F0F3FA", color: "#8A91A5", display: "grid", placeItems: "center", fontSize: "18px" }}>⌕</div>
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1 }}>
              {loading ? (
                <EmptyState text="Laden…" />
              ) : error ? (
                <EmptyState text={error} />
              ) : filtered.length === 0 ? (
                <EmptyState text="Keine E-Mails für diesen Filter." />
              ) : (
                filtered.map((message) => (
                  <MessageListItem
                    key={message.id}
                    message={message}
                    active={selected?.id === message.id}
                    onClick={() => setSelectedId(message.id)}
                  />
                ))
              )}
            </div>
          </section>

          {/* Right detail / conversation */}
          <main style={{ background: "#F2F5FB", minWidth: 0, display: "flex", flexDirection: "column" }}>
            {selected ? <MessageDetail message={selected} /> : <EmptyDetail />}
          </main>
        </div>
      </div>
    </div>
  );
}

function MessageListItem({ message, active, onClick }: { message: InboxMessage; active: boolean; onClick: () => void }) {
  const colors = STATUS_STYLES[message.match_status] ?? STATUS_STYLES.unmatched;
  return (
    <button onClick={onClick} style={{ width: "100%", border: "none", borderBottom: "1px solid #E9ECF5", borderLeft: active ? "4px solid #1697F6" : "4px solid transparent", background: active ? "#FFFFFF" : "transparent", padding: "18px 20px 18px 18px", textAlign: "left", cursor: "pointer", boxShadow: active ? "0 10px 28px rgba(20,25,58,0.07)" : "none" }}>
      <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
        <Avatar message={message} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
            <p style={{ margin: 0, fontSize: "14px", color: "#14193A", fontWeight: active ? 800 : 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{senderName(message)}</p>
            <span style={{ color: "#A3A9B8", fontSize: "11px", whiteSpace: "nowrap" }}>{fmtDate(message.received_at)}</span>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: "14px", color: "#14193A", fontWeight: 700, lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{message.subject || "(ohne Betreff)"}</p>
          <p style={{ margin: "7px 0 0", fontSize: "12px", color: "#8A91A5", lineHeight: 1.45, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{message.body_preview || message.from_email}</p>
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "999px", background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>{STATUS_LABELS[message.match_status]}</span>
            <span style={{ fontSize: "10px", color: "#9CA3AF", padding: "3px 7px", borderRadius: "999px", background: "#F3F5FA" }}>{message.account_email}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageDetail({ message }: { message: InboxMessage }) {
  const colors = STATUS_STYLES[message.match_status] ?? STATUS_STYLES.unmatched;
  return (
    <>
      <header style={{ height: "86px", background: "rgba(255,255,255,0.82)", borderBottom: "1px solid #E6E9F3", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
          <Avatar message={message} size={46} />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: "16px", color: "#14193A", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{senderName(message)}</p>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#8A91A5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{message.from_email}</p>
          </div>
        </div>
        <span style={{ fontSize: "11px", fontWeight: 800, padding: "6px 10px", borderRadius: "999px", background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>{STATUS_LABELS[message.match_status]}</span>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: "38px 38px 28px" }}>
        <div style={{ display: "flex", gap: "14px", alignItems: "flex-end", marginBottom: "30px" }}>
          <Avatar message={message} size={38} />
          <div style={{ maxWidth: "78%", background: "#E1E6EF", color: "#14193A", borderRadius: "24px 24px 24px 6px", padding: "22px 26px", boxShadow: "0 12px 32px rgba(20,25,58,0.06)" }}>
            <p style={{ margin: 0, fontSize: "22px", lineHeight: 1.35, fontWeight: 700 }}>{message.subject || "(ohne Betreff)"}</p>
            <p style={{ margin: "14px 0 0", fontSize: "13px", color: "#6B7280" }}>{fmtFull(message.received_at)} · an {message.account_email}</p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "30px" }}>
          <div style={{ maxWidth: "82%", background: "linear-gradient(135deg,#1697F6,#087DE8)", color: "#FFFFFF", borderRadius: "24px 24px 6px 24px", padding: "22px 26px", boxShadow: "0 18px 36px rgba(8,125,232,0.22)" }}>
            <p style={{ margin: 0, fontSize: "13px", opacity: 0.72, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>Founder OS Zuordnung</p>
            {message.entity_href && message.entity_name ? (
              <p style={{ margin: "8px 0 0", fontSize: "19px", lineHeight: 1.4 }}>
                Diese E-Mail ist mit <Link href={message.entity_href} style={{ color: "#FFFFFF", fontWeight: 800, textDecoration: "underline" }}>{message.entity_name}</Link>{message.entity_company ? ` · ${message.entity_company}` : ""} verknüpft.
              </p>
            ) : (
              <p style={{ margin: "8px 0 0", fontSize: "19px", lineHeight: 1.4 }}>Noch kein Lead, Kunde oder Lieferant gefunden. Bitte prüfen, ob daraus ein Kontakt entstehen soll.</p>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
          <Avatar message={message} size={38} />
          <article style={{ maxWidth: "86%", background: "#FFFFFF", color: "#273049", borderRadius: "24px 24px 24px 6px", padding: "24px 28px", boxShadow: "0 14px 34px rgba(20,25,58,0.08)", border: "1px solid #E6E9F3" }}>
            {message.has_attachments && (
              <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#A16207", fontWeight: 700 }}>Anhang: {(message.attachment_names ?? []).join(", ") || "vorhanden"}</p>
            )}
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.7, color: "#374151" }}>{message.body_text || message.body_preview || "Kein Textinhalt erkannt."}</pre>
          </article>
        </div>
      </div>

      <footer style={{ padding: "18px 28px 24px", background: "#F2F5FB" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E1E5F0", borderRadius: "16px", padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 10px 28px rgba(20,25,58,0.08)" }}>
          <span style={{ flex: 1, color: "#A3A9B8", fontSize: "13px" }}>Antworten/Lead-Anlage ist bewusst noch nicht direkt aus der Inbox aktiv.</span>
          <button disabled style={{ border: "none", background: "#1697F6", color: "#FFFFFF", borderRadius: "12px", padding: "9px 16px", fontSize: "13px", fontWeight: 800, opacity: 0.55 }}>Später</button>
        </div>
      </footer>
    </>
  );
}

function Avatar({ message, size }: { message: InboxMessage; size: number }) {
  const palette = message.match_status === "unmatched" ? ["#F43F5E", "#FDBA74"] : ["#1697F6", "#7DD3FC"];
  return (
    <div style={{ width: size, height: size, borderRadius: "999px", background: `linear-gradient(135deg,${palette[0]},${palette[1]})`, color: "#FFFFFF", display: "grid", placeItems: "center", fontWeight: 900, fontSize: Math.max(12, size * 0.38), flex: "0 0 auto", boxShadow: "0 8px 18px rgba(20,25,58,0.16)" }}>
      {initials(message)}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ margin: 0, padding: "34px 20px", textAlign: "center", color: "#8A91A5", fontSize: "13px" }}>{text}</p>;
}

function EmptyDetail() {
  return (
    <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#8A91A5", textAlign: "center", padding: "40px" }}>
      <div>
        <div style={{ width: "66px", height: "66px", borderRadius: "22px", background: "#FFFFFF", display: "grid", placeItems: "center", margin: "0 auto 14px", boxShadow: "0 12px 28px rgba(20,25,58,0.08)", fontSize: "24px" }}>✉</div>
        <p style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#14193A" }}>Keine Nachricht ausgewählt</p>
        <p style={{ margin: "4px 0 0", fontSize: "12px" }}>Wähle links eine E-Mail aus.</p>
      </div>
    </div>
  );
}

const smallLabel: React.CSSProperties = {
  display: "block",
  marginBottom: "8px",
  fontSize: "10px",
  color: "#8A91A5",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  border: "1px solid #DDE2EF",
  borderRadius: "13px",
  fontSize: "13px",
  color: "#14193A",
  background: "#F9FAFD",
  outline: "none",
};
