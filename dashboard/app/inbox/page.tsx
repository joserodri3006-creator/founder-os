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

const STATUS_LABELS: Record<MatchStatus, string> = {
  alle: "Alle",
  matched_lead: "Lead",
  matched_customer: "Kunde",
  matched_supplier: "Lieferant",
  unmatched: "Unmatched",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  matched_lead: { bg: "#DBEAFE", color: "#1D4ED8" },
  matched_customer: { bg: "#DCFCE7", color: "#15803D" },
  matched_supplier: { bg: "#FEF3C7", color: "#A16207" },
  unmatched: { bg: "#FEE2E2", color: "#B91C1C" },
};

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function InboxPage() {
  const { venture, setVenture } = useVenture();
  const [status, setStatus] = useState<MatchStatus>("unmatched");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams({ venture, limit: "150" });
    if (status !== "alle") params.set("match_status", status);
    return params.toString();
  }, [venture, status]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/inbox?${query}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Inbox konnte nicht geladen werden.");
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch((err: Error) => {
        setError(err.message);
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="px-4 py-5 sm:p-8 max-w-6xl mx-auto">
      <div style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "32px", color: "#14193A", letterSpacing: "-0.02em", margin: 0 }}>
            Inbox
          </h1>
          <p style={{ color: "#6B7280", fontSize: "14px", marginTop: "4px" }}>
            Eingehende Venture-Mails, verknüpft mit Leads, Kunden und Lieferanten.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" }}>
        <select value={venture} onChange={(e) => setVenture(e.target.value as typeof venture)} style={selectStyle}>
          {VENTURES.filter((v) => ["online_first", "blazed_outfitters", "brandary"].includes(v.id)).map((v) => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as MatchStatus)} style={selectStyle}>
          {(Object.keys(STATUS_LABELS) as MatchStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      <div style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", borderRadius: "16px", boxShadow: "0 2px 12px rgba(27,42,94,0.08)", overflow: "hidden" }}>
        {loading ? (
          <p style={emptyStyle}>Laden…</p>
        ) : error ? (
          <p style={emptyStyle}>{error}</p>
        ) : messages.length === 0 ? (
          <p style={emptyStyle}>Keine E-Mails für diesen Filter.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {messages.map((message) => {
              const colors = STATUS_COLORS[message.match_status] ?? { bg: "#F3F4F6", color: "#4B5563" };
              const open = openId === message.id;
              return (
                <div key={message.id} style={{ padding: "16px 18px" }}>
                  <button onClick={() => setOpenId(open ? null : message.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "14px", alignItems: "flex-start" }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 9px", borderRadius: "999px", background: colors.bg, color: colors.color }}>
                            {STATUS_LABELS[message.match_status] ?? message.match_status}
                          </span>
                          {message.entity_href && message.entity_name && (
                            <Link href={message.entity_href} onClick={(e) => e.stopPropagation()} style={{ fontSize: "12px", color: "#3A5BA0", textDecoration: "none", fontWeight: 600 }}>
                              {message.entity_name}{message.entity_company ? ` · ${message.entity_company}` : ""}
                            </Link>
                          )}
                        </div>
                        <p style={{ margin: "8px 0 0", fontSize: "14px", color: "#14193A", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {message.subject || "(ohne Betreff)"}
                        </p>
                        <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          Von {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email} · an {message.account_email}
                        </p>
                        {message.body_preview && !open && <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.45 }}>{message.body_preview}</p>}
                      </div>
                      <span style={{ fontSize: "11px", color: "#9CA3AF", whiteSpace: "nowrap" }}>{fmt(message.received_at)}</span>
                    </div>
                  </button>
                  {open && (
                    <div style={{ marginTop: "12px", padding: "12px", background: "#F7F8FC", border: "1px solid #EEF0F7", borderRadius: "10px" }}>
                      {message.has_attachments && (
                        <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#A16207" }}>
                          Anhang: {(message.attachment_names ?? []).join(", ") || "vorhanden"}
                        </p>
                      )}
                      <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "var(--font-sans)", fontSize: "12px", lineHeight: 1.55, color: "#374151" }}>
                        {message.body_text || message.body_preview || "Kein Textinhalt erkannt."}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid #D1D5E8",
  borderRadius: "8px",
  fontSize: "13px",
  color: "#14193A",
  background: "#FFFFFF",
};

const emptyStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#6B7280",
  textAlign: "center",
  padding: "32px 16px",
  margin: 0,
};
