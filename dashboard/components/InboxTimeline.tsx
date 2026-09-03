"use client";

import { useEffect, useState } from "react";

interface InboxMessage {
  id: string;
  account_email: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_preview: string | null;
  body_text: string | null;
  received_at: string;
  match_status: string;
  has_attachments: boolean;
  attachment_names: string[] | null;
}

interface Props {
  entityType: "lead" | "customer" | "supplier";
  entityId: string;
  venture: string;
}

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("de-DE") + " " + d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function InboxTimeline({ entityType, entityId, venture }: Props) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!entityId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/inbox?venture=${venture}&entity_type=${entityType}&entity_id=${entityId}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Inbox konnte nicht geladen werden.");
        setMessages(Array.isArray(data) ? data : []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [entityType, entityId, venture]);

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", borderRadius: "16px", boxShadow: "0 2px 12px rgba(27,42,94,0.08)", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "16px", color: "#14193A", margin: 0 }}>
          E-Mail-Verlauf {messages.length > 0 && <span style={{ fontSize: "13px", color: "#6B7280", fontFamily: "var(--font-sans)" }}>({messages.length})</span>}
        </h3>
      </div>

      {loading ? (
        <p style={{ fontSize: "13px", color: "#6B7280", textAlign: "center", padding: "16px 0", margin: 0 }}>Laden…</p>
      ) : error ? (
        <p style={{ fontSize: "13px", color: "#9CA3AF", textAlign: "center", padding: "12px 0", margin: 0 }}>{error}</p>
      ) : messages.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#6B7280", textAlign: "center", padding: "8px 0", margin: 0 }}>Noch keine eingehenden E-Mails verknüpft</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {messages.map((message) => {
            const open = openId === message.id;
            return (
              <div key={message.id} style={{ background: "#F7F8FC", border: "1px solid #EEF0F7", borderRadius: "10px", padding: "12px 14px" }}>
                <button
                  onClick={() => setOpenId(open ? null : message.id)}
                  style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: 0, cursor: "pointer" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "13px", color: "#14193A", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {message.subject || "(ohne Betreff)"}
                      </p>
                      <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#6B7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Von {message.from_name ? `${message.from_name} <${message.from_email}>` : message.from_email} · an {message.account_email}
                      </p>
                    </div>
                    <span style={{ fontSize: "11px", color: "#9CA3AF", whiteSpace: "nowrap" }}>{fmt(message.received_at)}</span>
                  </div>
                  {message.body_preview && !open && (
                    <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#6B7280", lineHeight: 1.45 }}>
                      {message.body_preview}
                    </p>
                  )}
                </button>
                {open && (
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #E5E7EB" }}>
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
  );
}
