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
const STATUS_LABELS: Record<MatchStatus, string> = { alle: "Alle", matched_lead: "Lead", matched_customer: "Kunde", matched_supplier: "Lieferant", unmatched: "Unmatched" };

const FILTERS: { key: MatchStatus; label: string }[] = [
  { key: "unmatched", label: "Unmatched" },
  { key: "alle", label: "Alle" },
  { key: "matched_lead", label: "Leads" },
  { key: "matched_customer", label: "Kunden" },
  { key: "matched_supplier", label: "Lieferanten" },
];

const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  matched_lead: { bg: "#EEF0F7", color: "#1B2A5E", border: "#D1D5E8" },
  matched_customer: { bg: "rgba(22,163,74,0.10)", color: "#15803D", border: "rgba(22,163,74,0.18)" },
  matched_supplier: { bg: "rgba(200,169,110,0.14)", color: "#A07840", border: "rgba(200,169,110,0.26)" },
  unmatched: { bg: "#FEF2F2", color: "#B91C1C", border: "#FECACA" },
};

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

function fmtDate(ts: string) {
  return new Date(ts).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function fmtFull(ts: string) {
  const d = new Date(ts);
  return `${d.toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })} · ${d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
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
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const PAGE_SIZE = 200;

  async function loadInbox(offset = 0, append = false) {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError(null);
    const params = new URLSearchParams({ venture, limit: String(PAGE_SIZE), offset: String(offset) });
    if (folder !== "alle") params.set("folder", folder);
    const res = await fetch(`/api/inbox?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Inbox konnte nicht geladen werden.");
    const list = Array.isArray(data) ? data : [];
    setHasMore(list.length === PAGE_SIZE);
    setMessages((currentMessages) => {
      const next = append ? [...currentMessages, ...list.filter((m: InboxMessage) => !currentMessages.some((existing) => existing.id === m.id))] : list;
      setSelectedId((current) => current && next.some((m: InboxMessage) => m.id === current) ? current : (next[0]?.id ?? null));
      return next;
    });
    if (append) setLoadingMore(false);
  }

  async function loadMore() {
    if (loadingMore || loading || !hasMore) return;
    await loadInbox(messages.length, true).finally(() => setLoadingMore(false));
  }

  useEffect(() => {
    loadInbox()
      .catch((err: Error) => { setError(err.message); setMessages([]); setSelectedId(null); })
      .finally(() => setLoading(false));

    Promise.all([
      fetch(`/api/leads?venture=${venture}`).then((res) => res.ok ? res.json() : []),
      fetch(`/api/kunden?venture=${venture}`).then((res) => res.ok ? res.json() : []),
      fetch(`/api/lieferanten?venture=${venture}`).then((res) => res.ok ? res.json() : []),
    ]).then(([leads, customers, suppliers]) => {
      setEntityCandidates([
        ...(Array.isArray(leads) ? leads.map((row) => mapPersonCandidate("lead", row)) : []),
        ...(Array.isArray(customers) ? customers.map((row) => mapPersonCandidate("customer", row)) : []),
        ...(Array.isArray(suppliers) ? suppliers.map(mapSupplierCandidate) : []),
      ]);
    }).catch(() => setEntityCandidates([]));
  }, [venture, folder]);

  const counts = useMemo(() => {
    const base: Record<MatchStatus, number> = { alle: messages.length, unmatched: 0, matched_lead: 0, matched_customer: 0, matched_supplier: 0 };
    messages.forEach((m) => { base[m.match_status] = (base[m.match_status] ?? 0) + 1; });
    return base;
  }, [messages]);

  const filtered = useMemo(() => status === "alle" ? messages : messages.filter((m) => m.match_status === status), [messages, status]);

  useEffect(() => {
    if (!filtered.length) setSelectedId(null);
    else if (!selectedId || !filtered.some((m) => m.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0] ?? null;
  const currentVenture = VENTURES.find((v) => v.id === venture);

  async function runInboxAction(messageId: string, payload: Record<string, unknown>, method: "PATCH" | "POST" = "PATCH") {
    const source = messages.find((message) => message.id === messageId);
    const sameSenderCount = source ? messages.filter((message) => message.venture === source.venture && message.from_email.toLowerCase() === source.from_email.toLowerCase()).length : 0;
    const isMailboxAction = typeof payload.action === "string" && String(payload.action).startsWith("mail_");
    if (!isMailboxAction && source && sameSenderCount > 1 && !payload.apply_to_sender) {
      const applyAll = window.confirm(`Es gibt ${sameSenderCount} Mails von ${source.from_email} in diesem Venture. Soll diese Aktion für alle diese Mails gelten?`);
      payload = { ...payload, apply_to_sender: applyAll };
    }
    setActionLoading(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/inbox/${messageId}`, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Aktion fehlgeschlagen");
      await loadInbox(0, false);
      setActionMessage(data.queued
        ? (payload.action === "mail_update_draft" ? "Entwurf gespeichert und zur Mailbox-Synchronisierung vorgemerkt." : "Mail-Aktion freigegeben und in die lokale Ausführung gelegt.")
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
    <div className="px-4 py-5 sm:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "28px", color: "#14193A", letterSpacing: "-0.02em", lineHeight: 1.2 }}>Inbox</h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{currentVenture?.label ?? venture} · {filtered.length} Nachrichten</p>
        </div>
        <select value={venture} onChange={(e) => setVenture(e.target.value as typeof venture)} style={selectStyle}>
          {VENTURES.filter((v) => ["online_first", "blazed_outfitters", "brandary"].includes(v.id)).map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>

      <div className="flex gap-2.5 mb-5 items-center flex-wrap p-3 rounded-xl" style={filterBarStyle}>
        {(["INBOX", "sent", "drafts", "alle"] as FolderFilter[]).map((f) => (
          <button key={f} onClick={() => { setFolder(f); if (f !== "INBOX") setStatus("alle"); }} style={{ ...pillButton, ...(folder === f ? pillActive : {}) }}>{FOLDER_LABELS[f]}</button>
        ))}
        <span style={{ width: 1, height: 26, background: "#D1D5E8", margin: "0 2px" }} />
        {FILTERS.map((filter) => (
          <button key={filter.key} onClick={() => setStatus(filter.key)} style={{ ...pillButton, ...(status === filter.key ? pillActive : {}) }}>
            {filter.label} <span style={{ opacity: 0.7 }}>({counts[filter.key]})</span>
          </button>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", boxShadow: "0 2px 12px rgba(27,42,94,0.08)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "360px minmax(0, 1fr)", height: "calc(100vh - 210px)", minHeight: "560px" }}>
          <section onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 160) void loadMore();
          }} style={{ borderRight: "1px solid #D1D5E8", background: "#FFFFFF", minWidth: 0, minHeight: 0, overflowY: "auto" }}>
            {loading ? <EmptyState text="Laden…" /> : error ? <EmptyState text={error} /> : filtered.length === 0 ? <EmptyState text="Keine E-Mails für diesen Filter." /> : filtered.map((message) => (
              <MessageListItem key={message.id} message={message} active={selected?.id === message.id} onClick={() => setSelectedId(message.id)} />
            ))}
            {loadingMore && <EmptyState text="Weitere Mails laden…" />}
            {!loading && hasMore && !loadingMore && <button onClick={() => void loadMore()} style={{ ...ghostButton, width: "calc(100% - 24px)", margin: "12px" }}>Weitere Mails laden</button>}
          </section>

          <main style={{ minWidth: 0, minHeight: 0, background: "#F7F8FC", overflowY: "auto" }}>
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
    <button onClick={onClick} style={{ width: "100%", border: "none", borderBottom: "1px solid #EEF0F7", borderLeft: active ? "3px solid #1B2A5E" : "3px solid transparent", background: active ? "#F7F8FC" : "#FFFFFF", padding: "12px 14px", textAlign: "left", cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#14193A", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{senderName(message)}</p>
          <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#14193A", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{message.subject || "(ohne Betreff)"}</p>
          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#6B7280", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{message.body_preview || message.from_email}</p>
        </div>
        <span style={{ color: "#6B7280", fontSize: "11px", whiteSpace: "nowrap" }}>{fmtDate(message.received_at)}</span>
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center", marginTop: "8px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "999px", background: colors.bg, color: colors.color, border: `1px solid ${colors.border}` }}>{STATUS_LABELS[message.match_status]}</span>
        <span style={smallBadge}>{message.folder === "INBOX" ? "Eingang" : FOLDER_LABELS[message.folder as FolderFilter] ?? message.folder}</span>
        <span style={smallBadge}>{message.account_email}</span>
      </div>
    </button>
  );
}

function MessageDetail({ message, candidates, actionLoading, actionMessage, onAction }: { message: InboxMessage; candidates: EntityCandidate[]; actionLoading: boolean; actionMessage: string | null; onAction: (messageId: string, payload: Record<string, unknown>, method?: "PATCH" | "POST") => void }) {
  const [entityKey, setEntityKey] = useState("");
  const [entitySearch, setEntitySearch] = useState("");
  const [createType, setCreateType] = useState<EntityType>("lead");
  const [companyName, setCompanyName] = useState("");
  const [editingDraft, setEditingDraft] = useState(false);
  const [draftSubject, setDraftSubject] = useState(message.subject || "");
  const [draftBody, setDraftBody] = useState(message.body_text || "");

  useEffect(() => {
    setEntityKey(""); setEntitySearch(""); setCreateType("lead"); setCompanyName(""); setEditingDraft(false);
    setDraftSubject(message.subject || ""); setDraftBody(message.body_text || "");
  }, [message.id, message.subject, message.body_text]);

  const selectedCandidate = candidates.find((candidate) => `${candidate.type}:${candidate.id}` === entityKey);
  const filteredCandidates = useMemo(() => {
    const term = entitySearch.trim().toLowerCase();
    const list = term ? candidates.filter((candidate) => candidateLabel(candidate).toLowerCase().includes(term)) : candidates;
    const limited = list.slice(0, 50);
    if (selectedCandidate && !limited.some((candidate) => candidate.id === selectedCandidate.id && candidate.type === selectedCandidate.type)) return [selectedCandidate, ...limited];
    return limited;
  }, [candidates, entitySearch, selectedCandidate]);

  const colors = STATUS_STYLES[message.match_status] ?? STATUS_STYLES.unmatched;
  const isDraft = message.folder === "drafts";
  const linkedLabel = message.entity_href && message.entity_name
    ? `${message.entity_name}${message.entity_company ? ` · ${message.entity_company}` : ""}`
    : null;

  return (
    <div style={{ padding: "12px 14px 16px", display: "grid", gap: "10px" }}>
      <section style={detailCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "16px", fontWeight: 700, color: "#14193A", lineHeight: 1.3 }}>{message.subject || "(ohne Betreff)"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6B7280" }}>
              {senderName(message)} · {message.from_email} · {fmtFull(message.received_at)} · {message.account_email}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: linkedLabel ? "#3A5BA0" : "#6B7280", fontWeight: linkedLabel ? 700 : 500 }}>
              {linkedLabel && message.entity_href ? <Link href={message.entity_href} style={{ color: "#3A5BA0", textDecoration: "none" }}>Verknüpft: {linkedLabel}</Link> : "Noch nicht verknüpft"}
            </p>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 9px", borderRadius: "999px", background: colors.bg, color: colors.color, border: `1px solid ${colors.border}`, whiteSpace: "nowrap" }}>{STATUS_LABELS[message.match_status]}</span>
        </div>
      </section>

      <section style={detailCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", marginBottom: "10px" }}>
          <p style={sectionTitle}>Aktionen</p>
          {actionMessage && <span style={{ color: actionMessage.includes("fehl") || actionMessage.includes("nicht") ? "#B91C1C" : "#15803D", fontSize: "12px", fontWeight: 700 }}>{actionMessage}</span>}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,0.7fr) minmax(220px,1.2fr) auto auto", gap: "8px", marginBottom: "8px" }}>
          <input value={entitySearch} onChange={(e) => setEntitySearch(e.target.value)} placeholder="Kontakt suchen…" style={inputStyle} />
          <select value={entityKey} onChange={(e) => setEntityKey(e.target.value)} style={inputStyle}>
            <option value="">Lead / Kunde / Partner wählen…</option>
            {filteredCandidates.map((candidate) => <option key={`${candidate.type}:${candidate.id}`} value={`${candidate.type}:${candidate.id}`}>{candidateLabel(candidate)}</option>)}
          </select>
          <button disabled={!selectedCandidate || actionLoading} onClick={() => selectedCandidate && onAction(message.id, { action: "link", entity_type: selectedCandidate.type, entity_id: selectedCandidate.id })} style={primaryButton}>Verknüpfen</button>
          <button disabled={actionLoading} onClick={() => onAction(message.id, { action: "ignore" })} style={ghostButton}>Ignorieren</button>
        </div>

        {message.match_status === "unmatched" && (
          <div style={{ display: "grid", gridTemplateColumns: "140px minmax(180px, 1fr) auto", gap: "8px", marginBottom: "8px" }}>
            <select value={createType} onChange={(e) => setCreateType(e.target.value as EntityType)} style={inputStyle}>
              <option value="lead">Als Lead</option><option value="customer">Als Kunde</option><option value="supplier">Als Partner</option>
            </select>
            <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Firma / Partnername optional" style={inputStyle} />
            <button disabled={actionLoading} onClick={() => onAction(message.id, { action: "create", entity_type: createType, company_name: companyName }, "POST")} style={primaryButton}>Anlegen + verknüpfen</button>
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {message.folder === "INBOX" && <button disabled={actionLoading} onClick={() => window.confirm("Diese Mail wirklich im Postfach archivieren?") && onAction(message.id, { action: "mail_archive" })} style={ghostButton}>Archivieren</button>}
          {isDraft && <button disabled={actionLoading} onClick={() => setEditingDraft((v) => !v)} style={ghostButton}>{editingDraft ? "Bearbeiten schließen" : "Entwurf bearbeiten"}</button>}
          {isDraft && <button disabled={actionLoading} onClick={() => window.confirm("Diesen Entwurf wirklich senden?") && onAction(message.id, { action: "mail_send" })} style={primaryButton}>Senden</button>}
          <button disabled={actionLoading} onClick={() => window.confirm("Diese Mail wirklich im Postfach löschen? Das ist nicht nur Ausblenden.") && onAction(message.id, { action: "mail_delete" })} style={dangerButton}>Löschen</button>
        </div>
      </section>

      {editingDraft && (
        <section style={detailCard}>
          <p style={sectionTitle}>Entwurf bearbeiten</p>
          <input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} placeholder="Betreff" style={{ ...inputStyle, width: "100%", marginTop: "8px" }} />
          <textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} rows={12} style={{ ...inputStyle, width: "100%", marginTop: "8px", resize: "vertical", lineHeight: 1.55 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px" }}>
            <button onClick={() => { setDraftSubject(message.subject || ""); setDraftBody(message.body_text || ""); }} style={ghostButton}>Zurücksetzen</button>
            <button disabled={actionLoading} onClick={() => onAction(message.id, { action: "mail_update_draft", subject: draftSubject, body_text: draftBody })} style={primaryButton}>Entwurf speichern</button>
          </div>
        </section>
      )}

      <section style={detailCard}>
        {message.has_attachments && <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#A07840", fontWeight: 700 }}>Anhang: {(message.attachment_names ?? []).join(", ") || "vorhanden"}</p>}
        <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontFamily: "var(--font-sans)", fontSize: "14px", lineHeight: 1.65, color: "#374151" }}>{message.body_text || message.body_preview || "Kein Textinhalt erkannt."}</pre>
      </section>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ margin: 0, padding: "34px 20px", textAlign: "center", color: "#6B7280", fontSize: "13px" }}>{text}</p>;
}

function EmptyDetail() {
  return <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#6B7280", textAlign: "center", padding: "40px" }}>Wähle links eine E-Mail aus.</div>;
}

const filterBarStyle: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #D1D5E8", boxShadow: "0 2px 12px rgba(27,42,94,0.08)" };
const selectStyle: React.CSSProperties = { fontSize: "13px", border: "1px solid #D1D5E8", borderRadius: "8px", padding: "7px 12px", background: "#FFFFFF", color: "#14193A", outline: "none", fontFamily: "var(--font-sans)" };
const inputStyle: React.CSSProperties = { ...selectStyle, minWidth: 0 };
const pillButton: React.CSSProperties = { border: "1px solid #D1D5E8", background: "transparent", color: "#6B7280", borderRadius: "8px", padding: "7px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer" };
const pillActive: React.CSSProperties = { background: "#EEF0F7", color: "#1B2A5E", borderColor: "#1B2A5E" };
const smallBadge: React.CSSProperties = { fontSize: "10px", color: "#6B7280", padding: "2px 7px", borderRadius: "999px", background: "#F7F8FC", border: "1px solid #EEF0F7" };
const detailCard: React.CSSProperties = { background: "#FFFFFF", border: "1px solid #D1D5E8", borderRadius: "16px", boxShadow: "0 2px 12px rgba(27,42,94,0.08)", padding: "16px" };
const sectionTitle: React.CSSProperties = { margin: 0, fontSize: "12px", color: "#6B7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" };
const primaryButton: React.CSSProperties = { border: "none", background: "#1B2A5E", color: "#FFFFFF", borderRadius: "8px", padding: "8px 13px", fontSize: "12px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" };
const ghostButton: React.CSSProperties = { ...primaryButton, background: "#FFFFFF", color: "#14193A", border: "1px solid #D1D5E8" };
const dangerButton: React.CSSProperties = { ...primaryButton, background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" };
