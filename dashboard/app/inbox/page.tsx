"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useVenture } from "@/context/VentureContext";
import { VENTURES } from "@/lib/ventures";

type MatchStatus = "alle" | "matched_lead" | "matched_customer" | "matched_supplier" | "unmatched";
type EntityType = "lead" | "customer" | "supplier";
type FolderFilter = "alle" | "INBOX" | "sent" | "drafts";

interface InboxMessage {
  id: string;
  venture: string;
  account_email: string;
  folder: string;
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

interface EntityCandidate {
  id: string;
  type: EntityType;
  label: string;
  email: string | null;
}

const ENTITY_LABELS: Record<EntityType, string> = { lead: "Lead", customer: "Kunde", supplier: "Partner" };
const FOLDER_LABELS: Record<FolderFilter, string> = { alle: "Alle", INBOX: "Eingang", sent: "Gesendet", drafts: "Entwürfe" };

function candidateLabel(candidate: EntityCandidate) {
  return `${ENTITY_LABELS[candidate.type]} · ${candidate.label}${candidate.email ? ` · ${candidate.email}` : ""}`;
}

function mapPersonCandidate(type: "lead" | "customer", row: { id: string; first_name?: string | null; last_name?: string | null; company_name?: string | null; email?: string | null }): EntityCandidate {
  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  return { id: row.id, type, label: [name || row.company_name || "Ohne Name", row.company_name && name ? row.company_name : null].filter(Boolean).join(" · "), email: row.email ?? null };
}

function mapSupplierCandidate(row: { id: string; name?: string | null; contact_name?: string | null; email?: string | null }): EntityCandidate {
  return { id: row.id, type: "supplier", label: [row.name || "Partner", row.contact_name].filter(Boolean).join(" · "), email: row.email ?? null };
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
  const [folder, setFolder] = useState<FolderFilter>("INBOX");
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [entityCandidates, setEntityCandidates] = useState<EntityCandidate[]>([]);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadInbox = async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ venture, limit: "200" });
    if (folder !== "alle") params.set("folder", folder);
    const res = await fetch(`/api/inbox?${params.toString()}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Inbox konnte nicht geladen werden.");
    const list = Array.isArray(data) ? data : [];
    setMessages(list);
    setSelectedId((current) => current && list.some((m: InboxMessage) => m.id === current) ? current : (list[0]?.id ?? null));
  };

  useEffect(() => {
    loadInbox()
      .catch((err: Error) => {
        setError(err.message);
        setMessages([]);
        setSelectedId(null);
      })
      .finally(() => setLoading(false));

    Promise.all([
      fetch(`/api/leads?venture=${venture}`).then((res) => res.ok ? res.json() : []),
      fetch(`/api/kunden?venture=${venture}`).then((res) => res.ok ? res.json() : []),
      fetch(`/api/lieferanten?venture=${venture}`).then((res) => res.ok ? res.json() : []),
    ])
      .then(([leads, customers, suppliers]) => {
        setEntityCandidates([
          ...(Array.isArray(leads) ? leads.map((row) => mapPersonCandidate("lead", row)) : []),
          ...(Array.isArray(customers) ? customers.map((row) => mapPersonCandidate("customer", row)) : []),
          ...(Array.isArray(suppliers) ? suppliers.map(mapSupplierCandidate) : []),
        ]);
      })
      .catch(() => setEntityCandidates([]));
  }, [venture, folder]);

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

  async function runInboxAction(messageId: string, payload: Record<string, unknown>, method: "PATCH" | "POST" = "PATCH") {
    const source = messages.find((message) => message.id === messageId);
    const sameSenderCount = source ? messages.filter((message) => message.venture === source.venture && message.from_email.toLowerCase() === source.from_email.toLowerCase()).length : 0;
    if (source && sameSenderCount > 1 && !payload.apply_to_sender) {
      const applyAll = window.confirm(`Es gibt ${sameSenderCount} Mails von ${source.from_email} in diesem Venture. Soll diese Aktion für alle diese Mails gelten?`);
      payload = { ...payload, apply_to_sender: applyAll };
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/inbox/${messageId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen");
      await loadInbox();
      setActionMessage(data.queued
        ? "Mail-Aktion freigegeben und in die lokale Ausführung gelegt."
        : data.duplicate
          ? `Bestehender Datensatz gefunden und ${data.affected ?? 1} Mail(s) verknüpft.`
          : `Aktion gespeichert (${data.affected ?? 1} Mail(s)).`);
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Aktion fehlgeschlagen");
    } finally {
      setActionLoading(false);
      setLoading(false);
    }
  }

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


            <div style={{ marginTop: "22px" }}>
              <label style={smallLabel}>Ordner</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                {(["INBOX", "sent", "drafts", "alle"] as FolderFilter[]).map((f) => (
                  <button key={f} onClick={() => { setFolder(f); if (f !== "INBOX") setStatus("alle"); }} style={{ ...folderButton, ...(folder === f ? folderButtonActive : {}) }}>
                    {FOLDER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

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
            {selected ? <MessageDetail message={selected} candidates={entityCandidates} actionLoading={actionLoading} actionMessage={actionMessage} onAction={runInboxAction} /> : <EmptyDetail />}
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
            <span style={{ fontSize: "10px", color: "#9CA3AF", padding: "3px 7px", borderRadius: "999px", background: "#F3F5FA" }}>{message.folder === "INBOX" ? "Eingang" : FOLDER_LABELS[message.folder as FolderFilter] ?? message.folder}</span>
            <span style={{ fontSize: "10px", color: "#9CA3AF", padding: "3px 7px", borderRadius: "999px", background: "#F3F5FA" }}>{message.account_email}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

function MessageDetail({ message, candidates, actionLoading, actionMessage, onAction }: { message: InboxMessage; candidates: EntityCandidate[]; actionLoading: boolean; actionMessage: string | null; onAction: (messageId: string, payload: Record<string, unknown>, method?: "PATCH" | "POST") => void }) {
  const [entityKey, setEntityKey] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [createType, setCreateType] = useState<EntityType>("lead");
  const [companyName, setCompanyName] = useState("");
  useEffect(() => { setEntityKey(""); setEntitySearch(""); setCreateType("lead"); setCompanyName(""); }, [message.id]);
  const selectedCandidate = candidates.find((candidate) => `${candidate.type}:${candidate.id}` === entityKey);
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

      <ActionPanel
        message={message}
        candidates={candidates}
        selectedCandidate={selectedCandidate}
        entityKey={entityKey}
        setEntityKey={setEntityKey}
        entitySearch={entitySearch}
        setEntitySearch={setEntitySearch}
        createType={createType}
        setCreateType={setCreateType}
        companyName={companyName}
        setCompanyName={setCompanyName}
        actionLoading={actionLoading}
        actionMessage={actionMessage}
        onAction={onAction}
      />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 38px 28px" }}>
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


    </>
  );
}

function ActionPanel({ message, candidates, selectedCandidate, entityKey, setEntityKey, entitySearch, setEntitySearch, createType, setCreateType, companyName, setCompanyName, actionLoading, actionMessage, onAction }: {
  message: InboxMessage;
  candidates: EntityCandidate[];
  selectedCandidate?: EntityCandidate;
  entityKey: string;
  setEntityKey: (value: string) => void;
  entitySearch: string;
  setEntitySearch: (value: string) => void;
  createType: EntityType;
  setCreateType: (value: EntityType) => void;
  companyName: string;
  setCompanyName: (value: string) => void;
  actionLoading: boolean;
  actionMessage: string | null;
  onAction: (messageId: string, payload: Record<string, unknown>, method?: "PATCH" | "POST") => void;
}) {
  const filteredCandidates = useMemo(() => {
    const term = entitySearch.trim().toLowerCase();
    const list = term
      ? candidates.filter((candidate) => candidateLabel(candidate).toLowerCase().includes(term))
      : candidates;
    const limited = list.slice(0, 50);
    if (selectedCandidate && !limited.some((candidate) => candidate.id === selectedCandidate.id && candidate.type === selectedCandidate.type)) {
      return [selectedCandidate, ...limited];
    }
    return limited;
  }, [candidates, entitySearch, selectedCandidate]);

  return (
    <section style={{ padding: "16px 28px", background: "rgba(255,255,255,0.9)", borderBottom: "1px solid #E6E9F3", display: "grid", gap: "10px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 0.85fr) minmax(220px, 1.15fr) 140px 112px", gap: "10px" }}>
        <input
          value={entitySearch}
          onChange={(e) => setEntitySearch(e.target.value)}
          placeholder="Kontakt suchen…"
          style={compactInput}
        />
        <select value={entityKey} onChange={(e) => setEntityKey(e.target.value)} style={compactInput}>
          <option value="">Mit Lead / Kunde / Partner verknüpfen…</option>
          {filteredCandidates.map((candidate) => <option key={`${candidate.type}:${candidate.id}`} value={`${candidate.type}:${candidate.id}`}>{candidateLabel(candidate)}</option>)}
        </select>
        <button
          disabled={!selectedCandidate || actionLoading}
          onClick={() => selectedCandidate && onAction(message.id, { action: "link", entity_type: selectedCandidate.type, entity_id: selectedCandidate.id })}
          style={secondaryButton}
        >
          Verknüpfen
        </button>
        <button disabled={actionLoading} onClick={() => onAction(message.id, { action: "ignore" })} style={ghostButton}>Ignorieren</button>
      </div>
      <p style={{ margin: "-2px 0 0", color: "#8A91A5", fontSize: "11px" }}>
        {entitySearch.trim() ? `${filteredCandidates.length} Treffer angezeigt` : `${Math.min(candidates.length, 50)} von ${candidates.length} Kontakten angezeigt`}
      </p>
      {message.match_status === "unmatched" && (
        <div style={{ display: "grid", gridTemplateColumns: "160px minmax(160px, 1fr) 180px", gap: "10px" }}>
          <select value={createType} onChange={(e) => setCreateType(e.target.value as EntityType)} style={compactInput}>
            <option value="lead">Als Lead</option>
            <option value="customer">Als Kunde</option>
            <option value="supplier">Als Partner</option>
          </select>
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Firma / Partnername optional" style={compactInput} />
          <button disabled={actionLoading} onClick={() => onAction(message.id, { action: "create", entity_type: createType, company_name: companyName }, "POST")} style={primaryButton}>Anlegen + verknüpfen</button>
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", paddingTop: "2px" }}>
        {message.folder === "INBOX" && (
          <button
            disabled={actionLoading}
            onClick={() => window.confirm("Diese Mail wirklich im Postfach archivieren?") && onAction(message.id, { action: "mail_archive" })}
            style={secondaryButton}
          >
            Archivieren
          </button>
        )}
        {message.folder === "drafts" && (
          <button
            disabled={actionLoading}
            onClick={() => window.confirm("Diesen Entwurf wirklich senden?") && onAction(message.id, { action: "mail_send" })}
            style={primaryButton}
          >
            Senden
          </button>
        )}
        <button
          disabled={actionLoading}
          onClick={() => window.confirm("Diese Mail wirklich im Postfach löschen? Das ist nicht nur Ausblenden.") && onAction(message.id, { action: "mail_delete" })}
          style={dangerButton}
        >
          Löschen
        </button>
      </div>
      {actionMessage && <p style={{ margin: 0, color: actionMessage.includes("fehl") || actionMessage.includes("nicht") ? "#BE123C" : "#15803D", fontSize: "12px", fontWeight: 700 }}>{actionMessage}</p>}
    </section>
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

const folderButton: React.CSSProperties = {
  border: "1px solid #DDE2EF",
  background: "#F9FAFD",
  color: "#6B7280",
  borderRadius: "11px",
  padding: "8px 9px",
  fontSize: "11px",
  fontWeight: 800,
  cursor: "pointer",
};

const folderButtonActive: React.CSSProperties = {
  background: "#14193A",
  color: "#FFFFFF",
  borderColor: "#14193A",
};

const compactInput: React.CSSProperties = {
  width: "100%",
  padding: "10px 11px",
  border: "1px solid #DDE2EF",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#14193A",
  background: "#F9FAFD",
  outline: "none",
};

const primaryButton: React.CSSProperties = {
  border: "none",
  background: "linear-gradient(135deg,#1697F6,#087DE8)",
  color: "#FFFFFF",
  borderRadius: "12px",
  padding: "10px 14px",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  ...primaryButton,
  background: "#14193A",
};

const ghostButton: React.CSSProperties = {
  ...primaryButton,
  background: "#FFFFFF",
  color: "#8A91A5",
  border: "1px solid #DDE2EF",
};

const dangerButton: React.CSSProperties = {
  ...primaryButton,
  background: "#FFF1F2",
  color: "#BE123C",
  border: "1px solid #FFC8D0",
};
