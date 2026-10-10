"use client";

import { useEffect, useState } from "react";

interface OutreachTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

interface Props {
  entityType: "lead" | "customer";
  entityId: string;
  venture: string;
  recipientEmail: string | null;
  recipientName: string;
  vars: Record<string, string>;
  onClose: () => void;
  onSent?: () => void;
  initialSubject?: string;
  initialBody?: string;
  isDraft?: boolean;
}

function resolvePlaceholders(text: string, vars: Record<string, string>) {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), text);
}

export default function SendMailModal({
  entityType, entityId, venture, recipientEmail, recipientName, vars, onClose, onSent,
  initialSubject = "", initialBody = "", isDraft = false,
}: Props) {
  const [templates, setTemplates] = useState<OutreachTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"queued" | "sent" | null>(null);

  // Resend-Ventures senden direkt; andere landen in Hermes SMTP-Queue
  const RESEND_VENTURES = new Set(["online_first", "itaba"]);
  const isResend = entityType !== "lead" || RESEND_VENTURES.has(venture);

  useEffect(() => {
    fetch(`/api/outreach-templates?venture=${venture}`)
      .then(r => r.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []));
  }, [venture]);

  function applyTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) {
      setSubject(resolvePlaceholders(tpl.subject, vars));
      setBody(resolvePlaceholders(tpl.body, vars));
    }
  }

  async function handleSend() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);

    // Ventures mit verifizierter Resend-Domain: direkt via Resend
    // Alle anderen (blazed_outfitters, brandary, …): Hermes SMTP-Queue
    const RESEND_VENTURES = new Set(["online_first", "itaba"]);
    const useResend = entityType !== "lead" || RESEND_VENTURES.has(venture);

    const endpoint = useResend
      ? (entityType === "lead"
          ? `/api/leads/${entityId}/send-mail`
          : `/api/kunden/${entityId}/send-mail`)
      : `/api/leads/${entityId}/queue-mail`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, is_ai_draft: isDraft, is_ai_draft_send: isDraft }),
    });
    setSending(false);
    if (res.ok) {
      setDone(useResend ? "sent" : "queued");
      onSent?.();
    } else {
      const data = await res.json().catch(() => ({}));
      const msg = data.detail
        ? `${data.error ?? "Fehler"}: ${data.detail}`
        : (data.error ?? "Versand fehlgeschlagen.");
      setError(msg);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", fontSize: "13px", border: "1px solid #D1D5E8", borderRadius: "8px",
    padding: "8px 12px", background: "#FFFFFF", color: "#14193A", outline: "none",
    fontFamily: "var(--font-sans)",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", color: "#6B7280",
    textTransform: "uppercase", marginBottom: "4px", display: "block",
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(20,25,58,0.5)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl"
        style={{ background: "#FFFFFF", boxShadow: "0 20px 56px rgba(27,42,94,0.24)", border: "1px solid #D1D5E8" }}>

        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #EEF0F7" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "20px", color: "#14193A" }}>
            {isDraft ? "E-Mail-Entwurf bearbeiten" : "E-Mail schreiben"}
          </h2>
          <button onClick={onClose} style={{ color: "#6B7280", fontSize: "22px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}>×</button>
        </div>

        {done === "sent" ? (
          <div className="px-6 py-8 text-center space-y-2">
            <div className="text-3xl">✅</div>
            <p className="text-sm font-medium" style={{ color: "#15803D" }}>
              E-Mail gesendet an {recipientEmail}
            </p>
            <button onClick={onClose} className="mt-3 text-sm px-4 py-2 rounded-lg"
              style={{ background: "#1B2A5E", color: "#FFFFFF", border: "none", cursor: "pointer" }}>
              Schließen
            </button>
          </div>
        ) : done === "queued" ? (
          <div className="px-6 py-8 text-center space-y-3">
            <div className="text-3xl">📬</div>
            <p className="text-sm font-medium" style={{ color: "#15803D" }}>
              Mail in Queue gestellt
            </p>
            <p className="text-xs" style={{ color: "#6B7280" }}>
              Hermes versendet sie in wenigen Minuten von <strong>{recipientEmail}</strong>.
              Status: <em>Leads → Mail Queue</em>
            </p>
            <button onClick={onClose} className="mt-2 text-sm px-4 py-2 rounded-lg"
              style={{ background: "#1B2A5E", color: "#FFFFFF", border: "none", cursor: "pointer" }}>
              Schließen
            </button>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {!recipientEmail && (
              <p className="text-sm" style={{ color: "#DC2626" }}>{recipientName} hat keine hinterlegte E-Mail-Adresse.</p>
            )}

            <div>
              <label style={labelStyle}>An</label>
              <p style={{ fontSize: "13px", color: "#14193A" }}>{recipientName} {recipientEmail ? `<${recipientEmail}>` : ""}</p>
            </div>

            {templates.length > 0 && (
              <div>
                <label style={labelStyle}>Vorlage</label>
                <select value={templateId} onChange={e => applyTemplate(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="">— Freie E-Mail —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label style={labelStyle}>Betreff</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} style={inputStyle} />
            </div>

            <div>
              <label style={labelStyle}>Nachricht</label>
              <textarea rows={8} value={body} onChange={e => setBody(e.target.value)}
                style={{ ...inputStyle, resize: "vertical", fontFamily: "var(--font-sans)" }} />
            </div>

            {error && <p className="text-sm" style={{ color: "#DC2626" }}>{error}</p>}

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSend}
                disabled={sending || !recipientEmail || !subject.trim() || !body.trim()}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                style={{ background: "#1B2A5E", color: "#FFFFFF", border: "none", cursor: sending ? "not-allowed" : "pointer", opacity: (sending || !recipientEmail) ? 0.6 : 1 }}>
                {sending
                  ? (isResend ? "Wird gesendet…" : "Wird eingestellt…")
                  : isResend
                    ? (isDraft ? "Entwurf senden" : "Senden")
                    : (isDraft ? "Entwurf in Queue stellen" : "In Queue stellen")}
              </button>
              <button onClick={onClose} type="button"
                className="flex-1 py-2.5 text-sm font-medium rounded-lg"
                style={{ background: "transparent", color: "#14193A", border: "1.5px solid #D1D5E8", cursor: "pointer" }}>
                Abbrechen
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
