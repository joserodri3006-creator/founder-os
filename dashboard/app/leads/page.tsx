"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CONTACT_CHANNEL_LABELS,
  Lead,
  LeadStatus,
  NEXT_ACTION_LABELS,
  REVIEW_STATUS_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from "@/lib/types";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";
import NewLeadModal from "@/components/NewLeadModal";
import CsvImportModal from "@/components/CsvImportModal";
import EditLeadModal from "@/components/EditLeadModal";
import CopyLeadModal from "@/components/CopyLeadModal";
import GoogleLeadSearchModal from "@/components/GoogleLeadSearchModal";
import SwipeView from "@/components/SwipeView";

// ─── Typen ────────────────────────────────────────────────────────────────────

const ALL_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];

type Modal =
  | { type: "edit"; id: string }
  | { type: "copy"; id: string; name: string; venture: string }
  | { type: "delete"; id: string; name: string }
  | null;

type ViewMode = "tabelle" | "pipeline" | "swipe";
type SortKey = "name" | "company" | "status" | "source" | "created_at" | "follow_up_date" | "last_contacted_at" | "industry";
type SortDir = "asc" | "desc";

// ─── Konstanten ───────────────────────────────────────────────────────────────

const STATUS_BG: Record<string, string> = {
  neu: "#EEF0F7",
  in_bearbeitung: "rgba(200,169,110,0.12)",
  kontaktiert: "rgba(200,169,110,0.18)",
  follow_up: "rgba(234,88,12,0.1)",
  nachgefasst: "rgba(234,88,12,0.08)",
  erstgespraech: "rgba(99,102,241,0.1)",
  qualifiziert: "#EEF0F7",
  sales_gespraech: "rgba(6,182,212,0.1)",
  angebot_gesendet: "rgba(236,72,153,0.08)",
  gewonnen: "rgba(22,163,74,0.1)",
  verloren: "rgba(220,38,38,0.08)",
  nachfassen_zukunft: "#F3F4F6",
};

const STATUS_TEXT: Record<string, string> = {
  neu: "#1B2A5E",
  in_bearbeitung: "#A07840",
  kontaktiert: "#A07840",
  follow_up: "#C2410C",
  nachgefasst: "#C2410C",
  erstgespraech: "#4F46E5",
  qualifiziert: "#14193A",
  sales_gespraech: "#0E7490",
  angebot_gesendet: "#BE185D",
  gewonnen: "#15803D",
  verloren: "#B91C1C",
  nachfassen_zukunft: "#6B7280",
};

// Pipeline-Spalten-Definition: Key + Label + Farbe der Spaltenüberschrift
const PIPELINE_COLS: { key: LeadStatus; label: string; accent: string; headerBg: string }[] = [
  { key: "neu",               label: "Neu",               accent: "#3A5BA0", headerBg: "#EEF0F7" },
  { key: "in_bearbeitung",    label: "In Bearbeitung",    accent: "#C8A96E", headerBg: "rgba(200,169,110,0.12)" },
  { key: "kontaktiert",       label: "Kontaktiert",       accent: "#C8A96E", headerBg: "rgba(200,169,110,0.18)" },
  { key: "follow_up",         label: "Follow-up",         accent: "#EA580C", headerBg: "rgba(234,88,12,0.1)" },
  { key: "nachgefasst",       label: "Nachgefasst",       accent: "#EA580C", headerBg: "rgba(234,88,12,0.08)" },
  { key: "erstgespraech",     label: "Erstgespräch",      accent: "#4F46E5", headerBg: "rgba(99,102,241,0.1)" },
  { key: "qualifiziert",      label: "Qualifiziert",      accent: "#1B2A5E", headerBg: "#EEF0F7" },
  { key: "sales_gespraech",   label: "Sales-Gespräch",    accent: "#0E7490", headerBg: "rgba(6,182,212,0.1)" },
  { key: "angebot_gesendet",  label: "Angebot gesendet",  accent: "#BE185D", headerBg: "rgba(236,72,153,0.08)" },
  { key: "gewonnen",          label: "Gewonnen",          accent: "#16A34A", headerBg: "rgba(22,163,74,0.1)" },
  { key: "verloren",          label: "Verloren",          accent: "#DC2626", headerBg: "rgba(220,38,38,0.08)" },
  { key: "nachfassen_zukunft",label: "Nachfassen (Zukunft)", accent: "#6B7280", headerBg: "#F3F4F6" },
];

const selectStyle: React.CSSProperties = {
  fontSize: "13px",
  border: "1px solid #D1D5E8",
  borderRadius: "8px",
  padding: "7px 12px",
  background: "#FFFFFF",
  color: "#14193A",
  outline: "none",
  fontFamily: "var(--font-sans)",
};

// ─── Hilfs-Hooks / -Funktionen ────────────────────────────────────────────────

function sortLeads(leads: Lead[], key: SortKey, dir: SortDir): Lead[] {
  return [...leads].sort((a, b) => {
    let av: string = "";
    let bv: string = "";
    if (key === "name")                { av = `${a.first_name} ${a.last_name}`; bv = `${b.first_name} ${b.last_name}`; }
    else if (key === "company")        { av = a.company_name ?? ""; bv = b.company_name ?? ""; }
    else if (key === "status")         { av = a.status; bv = b.status; }
    else if (key === "source")         { av = a.source; bv = b.source; }
    else if (key === "industry")       { av = a.industry ?? ""; bv = b.industry ?? ""; }
    else if (key === "created_at")     { av = a.created_at; bv = b.created_at; }
    else if (key === "follow_up_date") { av = a.follow_up_date ?? ""; bv = b.follow_up_date ?? ""; }
    else if (key === "last_contacted_at") { av = a.last_contacted_at ?? ""; bv = b.last_contacted_at ?? ""; }
    const cmp = av.localeCompare(bv, "de");
    return dir === "asc" ? cmp : -cmp;
  });
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { venture } = useVenture();

  const [leads, setLeads]                   = useState<Lead[]>([]);
  const [loading, setLoading]               = useState(true);
  const [filterStatus, setFilterStatus]     = useState<LeadStatus | "alle">("alle");
  const [filterSource, setFilterSource]     = useState<string>("alle");
  const [filterIndustry, setFilterIndustry] = useState<string>("alle");
  const [filterLastContacted, setFilterLastContacted] = useState<string>("alle");
  const [showArchived, setShowArchived]     = useState(false);
  const [search, setSearch]                 = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [updatingId, setUpdatingId]         = useState<string | null>(null);
  const [showNewLead, setShowNewLead]       = useState(false);
  const [showCsvImport, setShowCsvImport]   = useState(false);
  const [showGoogleSearch, setShowGoogleSearch] = useState(false);
  const [modal, setModal]                   = useState<Modal>(null);

  // Ansicht & Sortierung
  const [viewMode, setViewMode]             = useState<ViewMode>("tabelle");
  const [sortKey, setSortKey]               = useState<SortKey>("created_at");
  const [sortDir, setSortDir]               = useState<SortDir>("desc");

  // ── Laden ──────────────────────────────────────────────────────────────────
  async function load() {
    const params = new URLSearchParams();
    if (filterStatus !== "alle") params.set("status", filterStatus);
    if (filterSource !== "alle") params.set("source", filterSource);
    if (filterIndustry !== "alle") params.set("industry", filterIndustry);
    if (filterLastContacted !== "alle") params.set("last_contacted", filterLastContacted);
    if (showArchived) params.set("archived", "true");
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    params.set("venture", venture);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { load(); }, [filterStatus, filterSource, filterIndustry, filterLastContacted, showArchived, debouncedSearch, venture]);

  // ── Status-Update ──────────────────────────────────────────────────────────
  async function updateStatus(id: string, status: LeadStatus) {
    setUpdatingId(id);
    await fetch("/api/leads", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    setUpdatingId(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
    setModal(null);
  }

  async function handleArchive(id: string) {
    await fetch(`/api/leads/${id}/archive`, { method: "POST" });
    setLeads((prev) => prev.filter((l) => l.id !== id));
  }

  // ── Sortier-Handler ────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ── Berechnete Listen ──────────────────────────────────────────────────────
  const displayLeads = useMemo(() => {
    const sorted = sortLeads(leads, sortKey, sortDir);
    // Verloren immer ans Ende, unabhängig vom aktiven Sort
    return [
      ...sorted.filter((l) => l.status !== "verloren"),
      ...sorted.filter((l) => l.status === "verloren"),
    ];
  }, [leads, sortKey, sortDir]);

  const pipelineByStatus = useMemo<Record<LeadStatus, Lead[]>>(() => {
    const map = {} as Record<LeadStatus, Lead[]>;
    ALL_STATUSES.forEach((s) => { map[s] = []; });
    leads.forEach((l) => { map[l.status]?.push(l); });
    return map;
  }, [leads]);

  // Branchenliste dynamisch aus geladenen Leads
  const industryOptions = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => { if (l.industry) set.add(l.industry); });
    return Array.from(set).sort();
  }, [leads]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-5 sm:p-8 max-w-7xl mx-auto">

      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-7">
        <div className="flex items-center gap-2.5">
          <div>
            <h1 style={{ fontFamily: "var(--font-serif)", fontWeight: 300, fontSize: "28px", color: "#14193A", letterSpacing: "-0.02em", lineHeight: 1.2 }}>
              Lead Pipeline
            </h1>
            <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{leads.length} Leads</p>
          </div>
          <PipelineInfoTooltip />
        </div>
        <div className="flex items-center gap-2.5 flex-wrap justify-end">

          {/* View Toggle */}
          <div
            className="flex rounded-lg overflow-hidden"
            style={{ border: "1px solid #D1D5E8", background: "#F7F8FC" }}
          >
            {(["tabelle", "pipeline", "swipe"] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="text-sm px-3 py-2 font-medium transition-colors"
                style={{
                  background: viewMode === v ? "#1B2A5E" : "transparent",
                  color: viewMode === v ? "#FFFFFF" : "#6B7280",
                  border: "none",
                }}
              >
                {v === "tabelle" ? "☰ Tabelle" : v === "pipeline" ? "⊞ Pipeline" : "🔥 Swipe"}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowGoogleSearch(true)}
            className="text-sm px-4 py-2 rounded-lg transition-colors font-medium"
            style={{ border: "1.5px solid #D1D5E8", background: "#FFFFFF", color: "#14193A" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#EEF0F7")}
            onMouseLeave={e => (e.currentTarget.style.background = "#FFFFFF")}
          >
            Google Leads suchen
          </button>
          <button
            onClick={() => setShowCsvImport(true)}
            className="text-sm px-4 py-2 rounded-lg transition-colors font-medium"
            style={{ border: "1.5px solid #D1D5E8", background: "transparent", color: "#14193A" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#EEF0F7")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            CSV Import
          </button>
          <button
            onClick={() => setShowNewLead(true)}
            className="text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{ background: "#1B2A5E", color: "#FFFFFF", border: "none" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#243672")}
            onMouseLeave={e => (e.currentTarget.style.background = "#1B2A5E")}
          >
            + Neuer Lead
          </button>
        </div>
      </div>

      {/* ── Filter Bar ──────────────────────────────────────────────────────── */}
      <div
        className="flex gap-2.5 mb-5 flex-wrap items-center p-3 rounded-xl"
        style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", boxShadow: "0 2px 12px rgba(27,42,94,0.08)" }}
      >
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche — Name, Firma, E-Mail, Telefon, Ort, Notizen…"
          style={{ ...selectStyle, flex: "1 1 260px", minWidth: "220px" }}
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as LeadStatus | "alle")} style={selectStyle}>
          <option value="alle">Alle Status</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={selectStyle}>
          <option value="alle">Alle Quellen</option>
          {["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)} style={selectStyle}>
          <option value="alle">Alle Branchen</option>
          {industryOptions.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterLastContacted} onChange={(e) => setFilterLastContacted(e.target.value)} style={selectStyle}>
          <option value="alle">Kontaktiert: alle</option>
          <option value="never">Nie kontaktiert</option>
          <option value="7d">Letzte 7 Tage</option>
          <option value="30d">Letzte 30 Tage</option>
          <option value="older_30d">Älter als 30 Tage</option>
        </select>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="text-sm px-3 py-1.5 rounded-lg transition-colors font-medium"
          style={{
            border: showArchived ? "1.5px solid #1B2A5E" : "1px solid #D1D5E8",
            background: showArchived ? "#EEF0F7" : "transparent",
            color: showArchived ? "#1B2A5E" : "#6B7280",
          }}
        >
          {showArchived ? "← Aktive" : "Archiv"}
        </button>
      </div>

      {/* ── Laden ───────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center gap-2 py-8" style={{ color: "#6B7280" }}>
          <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }} />
          <span className="text-sm">Laden...</span>
        </div>
      ) : viewMode === "tabelle" ? (
        <TabelleView
          leads={displayLeads}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
          updatingId={updatingId}
          onUpdateStatus={updateStatus}
          onEdit={(id) => setModal({ type: "edit", id })}
          onCopy={(l) => setModal({ type: "copy", id: l.id, name: `${l.first_name} ${l.last_name}`, venture: l.venture ?? "online_first" })}
          onArchive={handleArchive}
          onDelete={(l) => setModal({ type: "delete", id: l.id, name: `${l.first_name} ${l.last_name}` })}
        />
      ) : viewMode === "pipeline" ? (
        <PipelineView
          byStatus={pipelineByStatus}
          updatingId={updatingId}
          onUpdateStatus={updateStatus}
          onEdit={(id) => setModal({ type: "edit", id })}
          onDelete={(l) => setModal({ type: "delete", id: l.id, name: `${l.first_name} ${l.last_name}` })}
        />
      ) : (
        <SwipeView
          leads={displayLeads}
          onUpdateStatus={updateStatus}
          onArchive={handleArchive}
        />
      )}

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      {showNewLead && (
        <NewLeadModal onClose={() => setShowNewLead(false)} onCreated={() => { setShowNewLead(false); setTimeout(load, 500); }} />
      )}
      {showCsvImport && (
        <CsvImportModal onClose={() => setShowCsvImport(false)} onImported={() => setTimeout(load, 500)} />
      )}
      {showGoogleSearch && (
        <GoogleLeadSearchModal onClose={() => setShowGoogleSearch(false)} onImported={() => setTimeout(load, 500)} />
      )}
      {modal?.type === "edit" && (
        <EditLeadModal leadId={modal.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); setTimeout(load, 300); }} />
      )}
      {modal?.type === "copy" && (
        <CopyLeadModal leadId={modal.id} leadName={modal.name} currentVenture={modal.venture}
          onClose={() => setModal(null)} onCopied={() => setTimeout(load, 300)} />
      )}
      {modal?.type === "delete" && (
        <DeleteConfirm name={modal.name} onConfirm={() => handleDelete(modal.id)} onCancel={() => setModal(null)} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Komponente: Tabellen-Ansicht
// ═══════════════════════════════════════════════════════════════════════════════

const SORT_COLS: { key: SortKey; label: string }[] = [
  { key: "name",               label: "Name" },
  { key: "company",            label: "Unternehmen" },
  { key: "status",             label: "Status" },
  { key: "industry",           label: "Branche" },
  { key: "source",             label: "Quelle" },
  { key: "last_contacted_at",  label: "Zuletzt kontaktiert" },
  { key: "follow_up_date",     label: "Follow-up" },
  { key: "created_at",         label: "Erstellt" },
];

// Nicht-sortierbare Spalten
const EXTRA_COLS = ["Review", "Nächste Aktion", "Draft", "Aktionen"];

function SortTh({
  col, sortKey, sortDir, onSort,
}: {
  col: { key: SortKey; label: string };
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === col.key;
  return (
    <th
      className="px-4 py-3 text-left font-semibold uppercase cursor-pointer select-none"
      style={{ fontSize: "11px", letterSpacing: "0.07em", color: active ? "#1B2A5E" : "#6B7280" }}
      onClick={() => onSort(col.key)}
    >
      <span className="flex items-center gap-1">
        {col.label}
        <span style={{ opacity: active ? 1 : 0.3, fontSize: "10px" }}>
          {active ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </span>
    </th>
  );
}

function TabelleView({
  leads, sortKey, sortDir, onSort, updatingId,
  onUpdateStatus, onEdit, onCopy, onArchive, onDelete,
}: {
  leads: Lead[];
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  updatingId: string | null;
  onUpdateStatus: (id: string, s: LeadStatus) => void;
  onEdit: (id: string) => void;
  onCopy: (l: Lead) => void;
  onArchive: (id: string) => void;
  onDelete: (l: Lead) => void;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", boxShadow: "0 2px 12px rgba(27,42,94,0.08)" }}>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: "960px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #EEF0F7", background: "#F7F8FC" }}>
              {SORT_COLS.map((col) => (
                <SortTh key={col.key} col={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              ))}
              {EXTRA_COLS.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left font-semibold uppercase"
                  style={{ fontSize: "11px", letterSpacing: "0.07em", color: "#6B7280" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                style={{
                  borderBottom: "1px solid #F7F8FC",
                  opacity: lead.status === "verloren" ? 0.55 : 1,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#F7F8FC"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                {/* Name */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium transition-colors"
                      style={{ color: "#14193A", fontSize: "14px" }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#1B2A5E"}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#14193A"}
                    >
                      {lead.first_name} {lead.last_name}
                    </Link>
                    {(lead as any).is_duplicate && (
                      <span className="text-xs px-1.5 py-0.5 rounded font-semibold shrink-0" style={{ background: "rgba(234,88,12,0.1)", color: "#C2410C" }}>
                        Duplikat
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: "#6B7280" }}>{lead.email}</div>
                </td>

                {/* Unternehmen */}
                <td className="px-4 py-3.5 text-sm" style={{ color: "#6B7280" }}>{lead.company_name ?? "—"}</td>

                {/* Status */}
                <td className="px-4 py-3.5">
                  <select
                    value={lead.status}
                    disabled={updatingId === lead.id}
                    onChange={(e) => onUpdateStatus(lead.id, e.target.value as LeadStatus)}
                    className="text-xs font-semibold rounded-full cursor-pointer"
                    style={{
                      background: STATUS_BG[lead.status] ?? "#F3F4F6",
                      color: STATUS_TEXT[lead.status] ?? "#374151",
                      border: "none",
                      padding: "4px 10px",
                      fontFamily: "var(--font-sans)",
                      outline: "none",
                    }}
                  >
                    {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </td>

                {/* Quelle */}
                <td className="px-4 py-3.5 text-sm capitalize" style={{ color: "#6B7280" }}>{lead.source}</td>

                {/* Branche */}
                <td className="px-4 py-3.5 text-xs" style={{ color: "#6B7280" }}>{lead.industry ?? "—"}</td>

                {/* Zuletzt kontaktiert */}
                <td className="px-4 py-3.5 text-xs" style={{ color: "#6B7280" }}>
                  {lead.last_contacted_at
                    ? new Date(lead.last_contacted_at).toLocaleDateString("de-DE")
                    : <span style={{ color: "#D1D5E8" }}>—</span>}
                </td>

                {/* Follow-up */}
                <td className="px-4 py-3.5 text-xs" style={{ color: "#6B7280" }}>
                  {lead.follow_up_date
                    ? new Date(lead.follow_up_date).toLocaleDateString("de-DE")
                    : "—"}
                </td>

                {/* Erstellt */}
                <td className="px-4 py-3.5 text-xs" style={{ color: "#6B7280" }}>
                  {new Date(lead.created_at).toLocaleDateString("de-DE")}
                </td>

                {/* Review */}
                <td className="px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <span
                      className="w-fit rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        background: lead.review_status === "ready_for_outreach" ? "rgba(22,163,74,0.1)" : lead.review_status === "blocked" ? "rgba(220,38,38,0.08)" : "#EEF0F7",
                        color: lead.review_status === "ready_for_outreach" ? "#15803D" : lead.review_status === "blocked" ? "#B91C1C" : "#1B2A5E",
                      }}
                    >
                      {REVIEW_STATUS_LABELS[lead.review_status ?? "unreviewed"]}
                    </span>
                    <span className="text-xs" style={{ color: "#6B7280" }}>
                      {CONTACT_CHANNEL_LABELS[lead.contact_channel ?? "unchecked"]}
                    </span>
                  </div>
                </td>

                {/* Nächste Aktion */}
                <td className="px-4 py-3.5 text-sm" style={{ color: "#6B7280" }}>
                  {NEXT_ACTION_LABELS[lead.next_action ?? "website_pruefen"]}
                </td>

                {/* Draft */}
                <td className="px-4 py-3.5">
                  {lead.ai_draft_approved === true  && <span className="text-xs font-semibold" style={{ color: "#16A34A" }}>Freigegeben</span>}
                  {lead.ai_draft_approved === false && <span className="text-xs font-semibold" style={{ color: "#C8A96E" }}>Offen</span>}
                  {lead.ai_draft_approved === null  && <span className="text-xs" style={{ color: "#D1D5E8" }}>—</span>}
                </td>

                {/* Aktionen */}
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1">
                    <ActionBtn onClick={() => onEdit(lead.id)}>Bearbeiten</ActionBtn>
                    <ActionBtn onClick={() => onCopy(lead)}>Kopieren</ActionBtn>
                    {!lead.archived_at && <ActionBtn onClick={() => onArchive(lead.id)}>Archiv</ActionBtn>}
                    <ActionBtn onClick={() => onDelete(lead)} danger>Löschen</ActionBtn>
                  </div>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-sm" style={{ color: "#6B7280" }}>
                  Keine Leads gefunden
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Komponente: Pipeline-Ansicht (Kanban) — mit Drag & Drop via @dnd-kit
// ═══════════════════════════════════════════════════════════════════════════════

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";

function PipelineView({
  byStatus, updatingId, onUpdateStatus, onEdit, onDelete,
}: {
  byStatus: Record<LeadStatus, Lead[]>;
  updatingId: string | null;
  onUpdateStatus: (id: string, s: LeadStatus) => void;
  onEdit: (id: string) => void;
  onDelete: (l: Lead) => void;
}) {
  const [activeLead, setActiveLead] = useState<Lead | null>(null);

  // Alle Leads flach für den Overlay-Lookup
  const allLeads = useMemo(
    () => Object.values(byStatus).flat(),
    [byStatus]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  function handleDragStart({ active }: DragStartEvent) {
    const lead = allLeads.find((l) => l.id === active.id);
    setActiveLead(lead ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveLead(null);
    if (!over || active.id === over.id) return;
    const targetStatus = over.id as LeadStatus;
    const lead = allLeads.find((l) => l.id === active.id);
    if (!lead || lead.status === targetStatus) return;
    onUpdateStatus(String(active.id), targetStatus);
  }

  // Nur Spalten anzeigen, die Leads haben — leere als Drop-Targets aber trotzdem
  const visibleCols = PIPELINE_COLS.filter((col) => (byStatus[col.key]?.length ?? 0) > 0);

  if (visibleCols.length === 0) {
    return (
      <div className="py-16 text-center text-sm" style={{ color: "#6B7280" }}>
        Keine Leads vorhanden
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-3" style={{ minWidth: `${visibleCols.length * 260}px` }}>
          {visibleCols.map((col) => (
            <DroppableColumn
              key={col.key}
              col={col}
              leads={byStatus[col.key] ?? []}
              activeId={activeLead?.id ?? null}
              updatingId={updatingId}
              onUpdateStatus={onUpdateStatus}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </div>

      {/* Overlay: schwebende Karte während des Drags */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "ease" }}>
        {activeLead ? (
          <div
            className="rounded-xl p-3"
            style={{
              background: "#FFFFFF",
              border: "1px solid #1B2A5E",
              boxShadow: "0 12px 32px rgba(27,42,94,0.22)",
              width: "240px",
              opacity: 0.97,
              cursor: "grabbing",
            }}
          >
            <p className="text-sm font-semibold truncate" style={{ color: "#14193A" }}>
              {activeLead.first_name} {activeLead.last_name}
            </p>
            {activeLead.company_name && (
              <p className="text-xs truncate mt-0.5" style={{ color: "#6B7280" }}>
                {activeLead.company_name}
              </p>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Droppable Spalte ──────────────────────────────────────────────────────────

function DroppableColumn({
  col, leads, activeId, updatingId, onUpdateStatus, onEdit, onDelete,
}: {
  col: typeof PIPELINE_COLS[number];
  leads: Lead[];
  activeId: string | null;
  updatingId: string | null;
  onUpdateStatus: (id: string, s: LeadStatus) => void;
  onEdit: (id: string) => void;
  onDelete: (l: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.key });

  return (
    <div className="flex-shrink-0" style={{ width: "248px" }}>
      {/* Spaltenheader */}
      <div
        className="flex items-center justify-between px-3 py-2.5 rounded-t-xl"
        style={{ background: col.headerBg, borderBottom: `2px solid ${col.accent}20` }}
      >
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: col.accent }}>
          {col.label}
        </span>
        <span
          className="text-xs font-semibold rounded-full px-2 py-0.5"
          style={{ background: `${col.accent}20`, color: col.accent }}
        >
          {leads.length}
        </span>
      </div>

      {/* Karten-Container — ist das Drop-Target */}
      <div
        ref={setNodeRef}
        className="flex flex-col gap-2 p-2 rounded-b-xl"
        style={{
          background: isOver ? `${col.accent}08` : "#F7F8FC",
          border: `1px solid ${isOver ? col.accent : "#D1D5E8"}`,
          borderTop: "none",
          minHeight: "80px",
          maxHeight: "calc(100vh - 280px)",
          overflowY: "auto",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        {leads.map((lead) => (
          <DraggableCard
            key={lead.id}
            lead={lead}
            accent={col.accent}
            isDragging={activeId === lead.id}
            updatingId={updatingId}
            onUpdateStatus={onUpdateStatus}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
        {/* Leerer Bereich als visueller Drop-Hinweis */}
        {isOver && leads.length === 0 && (
          <div
            className="rounded-lg text-center py-4 text-xs"
            style={{ border: `2px dashed ${col.accent}`, color: col.accent }}
          >
            Hier ablegen
          </div>
        )}
      </div>
    </div>
  );
}

// ── Draggable Karte ───────────────────────────────────────────────────────────

function DraggableCard({
  lead, accent, isDragging, updatingId, onUpdateStatus, onEdit, onDelete,
}: {
  lead: Lead;
  accent: string;
  isDragging: boolean;
  updatingId: string | null;
  onUpdateStatus: (id: string, s: LeadStatus) => void;
  onEdit: (id: string) => void;
  onDelete: (l: Lead) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: lead.id });
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      ref={setNodeRef}
      style={{
        // Während des Drags: Platzhalter bleibt, wird aber transparent
        opacity: isDragging ? 0.3 : lead.status === "verloren" ? 0.6 : 1,
        transition: "opacity 0.15s",
      }}
    >
      <div
        className="rounded-xl p-3"
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7F0",
          boxShadow: "0 1px 4px rgba(27,42,94,0.06)",
        }}
      >
        {/* Drag-Handle + Name-Zeile */}
        <div className="flex items-start gap-1.5">
          {/* Drag-Handle — nur dieser Bereich löst den Drag aus */}
          <div
            {...listeners}
            {...attributes}
            className="shrink-0 mt-0.5 cursor-grab active:cursor-grabbing rounded"
            style={{ color: "#C4C8D8", padding: "2px 1px", touchAction: "none" }}
            title="Ziehen um Status zu ändern"
          >
            ⠿
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <Link
                  href={`/leads/${lead.id}`}
                  className="text-sm font-semibold block truncate transition-colors"
                  style={{ color: "#14193A" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#1B2A5E"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#14193A"}
                  // Link-Klick soll nicht den Drag stören
                  onClick={e => e.stopPropagation()}
                >
                  {lead.first_name} {lead.last_name}
                </Link>
                {lead.company_name && (
                  <span className="text-xs truncate block" style={{ color: "#6B7280" }}>{lead.company_name}</span>
                )}
              </div>
              <button
                onClick={() => setExpanded((v) => !v)}
                className="shrink-0 text-xs rounded-md px-1.5 py-0.5"
                style={{ color: "#9CA3AF", background: "transparent", border: "none" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#EEF0F7")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {expanded ? "▲" : "▼"}
              </button>
            </div>
          </div>
        </div>

        {/* Status-Dropdown */}
        <div className="mt-2 pl-4">
          <select
            value={lead.status}
            disabled={updatingId === lead.id}
            onChange={(e) => onUpdateStatus(lead.id, e.target.value as LeadStatus)}
            className="text-xs font-semibold rounded-full cursor-pointer w-full"
            style={{
              background: STATUS_BG[lead.status] ?? "#F3F4F6",
              color: STATUS_TEXT[lead.status] ?? "#374151",
              border: "none",
              padding: "3px 8px",
              fontFamily: "var(--font-sans)",
              outline: "none",
            }}
          >
            {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </div>

        {/* Expanded */}
        {expanded && (
          <div className="mt-2.5 pt-2.5 pl-4 space-y-1.5" style={{ borderTop: "1px solid #F0F1F8" }}>
            {lead.email && <div className="text-xs truncate" style={{ color: "#6B7280" }}>✉ {lead.email}</div>}
            {lead.city && <div className="text-xs" style={{ color: "#6B7280" }}>📍 {lead.city}</div>}
            {lead.follow_up_date && (
              <div className="text-xs" style={{ color: "#EA580C" }}>
                📅 {new Date(lead.follow_up_date).toLocaleDateString("de-DE")}
              </div>
            )}
            {lead.ai_draft_approved === false && <div className="text-xs font-semibold" style={{ color: "#C8A96E" }}>Draft offen</div>}
            {lead.ai_draft_approved === true  && <div className="text-xs font-semibold" style={{ color: "#16A34A" }}>Draft freigegeben</div>}
            <div className="flex gap-1 pt-1">
              <ActionBtn onClick={() => onEdit(lead.id)}>Bearbeiten</ActionBtn>
              <ActionBtn onClick={() => onDelete(lead)} danger>Löschen</ActionBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Sub-Komponenten
// ═══════════════════════════════════════════════════════════════════════════════

function ActionBtn({ onClick, children, danger }: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded-md transition-colors font-medium"
      style={{ color: danger ? "#B91C1C" : "#6B7280", background: "transparent" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = danger ? "rgba(220,38,38,0.08)" : "#EEF0F7";
        (e.currentTarget as HTMLElement).style.color = danger ? "#B91C1C" : "#14193A";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = danger ? "#B91C1C" : "#6B7280";
      }}
    >
      {children}
    </button>
  );
}

function DeleteConfirm({ name, onConfirm, onCancel }: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50 p-4"
      style={{ background: "rgba(20,25,58,0.5)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-sm p-6 space-y-4 rounded-2xl"
        style={{ background: "#FFFFFF", boxShadow: "0 20px 56px rgba(27,42,94,0.24)", border: "1px solid #D1D5E8" }}
      >
        <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "20px", color: "#14193A" }}>
          Lead löschen
        </h2>
        <p className="text-sm" style={{ color: "#6B7280" }}>
          <span className="font-semibold" style={{ color: "#14193A" }}>{name}</span> wird unwiderruflich gelöscht.
        </p>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors"
            style={{ background: "#DC2626", color: "#FFFFFF", border: "none" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#B91C1C")}
            onMouseLeave={e => (e.currentTarget.style.background = "#DC2626")}
          >
            Löschen
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors"
            style={{ background: "transparent", color: "#14193A", border: "1.5px solid #D1D5E8" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#EEF0F7")}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Pipeline-Prozess-Tooltip — Dokumentation Lead → Kunde
// ═══════════════════════════════════════════════════════════════════════════════

const PIPELINE_STEPS: {
  status: string;
  label: string;
  dot: string;
  aktion: string;
  automatisch?: boolean;
  hinweis?: string;
}[] = [
  {
    status: "neu",
    label: "Neu",
    dot: "#3A5BA0",
    aktion: "Lead eingegangen (manuell, CSV, KI-Suche oder Website). Review-Status setzen, Kontaktweg prüfen.",
  },
  {
    status: "in_bearbeitung",
    label: "In Bearbeitung",
    dot: "#C8A96E",
    aktion: "KI-Entwurf wurde erstellt. Mail noch nicht gesendet — Entwurf prüfen und freigeben.",
    hinweis: "Blazed-Outreach-Leads landen oft hier, da der B2B-Agent Drafts vorformuliert.",
  },
  {
    status: "kontaktiert",
    label: "Kontaktiert",
    dot: "#C8A96E",
    aktion: "Erstkontakt wurde gesendet (Mail via Hermes/Resend). Automatisch gesetzt nach Mailversand.",
    automatisch: true,
  },
  {
    status: "follow_up",
    label: "Follow-up",
    dot: "#EA580C",
    aktion: "Keine Antwort nach 5 Tagen — Follow-up-Mail gesendet. Follow-up-Datum wird automatisch auf +5 Tage gesetzt.",
    automatisch: true,
  },
  {
    status: "nachgefasst",
    label: "Nachgefasst",
    dot: "#EA580C",
    aktion: "Zweite Nachfass-Mail versendet. Letzter aktiver Kontaktversuch vor Entscheidung.",
    automatisch: true,
  },
  {
    status: "erstgespraech",
    label: "Erstgespräch",
    dot: "#4F46E5",
    aktion: "Lead hat geantwortet — erstes Gespräch vereinbart oder geführt. Manuell setzen.",
  },
  {
    status: "qualifiziert",
    label: "Qualifiziert",
    dot: "#1B2A5E",
    aktion: "Bedarf und Fit bestätigt. Lead ist bereit für konkretes Angebot.",
  },
  {
    status: "sales_gespraech",
    label: "Sales-Gespräch",
    dot: "#0E7490",
    aktion: "Detailliertes Verkaufsgespräch geführt. Konditionen besprochen.",
  },
  {
    status: "angebot_gesendet",
    label: "Angebot gesendet",
    dot: "#BE185D",
    aktion: "Konkretes Angebot/Preisliste an Lead gesendet. Auf Entscheidung warten.",
  },
  {
    status: "gewonnen",
    label: "Gewonnen ✓",
    dot: "#16A34A",
    aktion: "Lead hat zugesagt. Manuell als Kunden in der Kundenverwaltung anlegen (CRM → Kunden → Neu).",
    hinweis: "Kein automatischer Kunden-Transfer — Kundendatensatz muss manuell angelegt werden.",
  },
  {
    status: "nachfassen_zukunft",
    label: "Nachfassen (Zukunft)",
    dot: "#9CA3AF",
    aktion: "Lead ist aktuell nicht interessiert, aber offen für später. Parkplatz-Status — Follow-up-Datum setzen.",
  },
  {
    status: "verloren",
    label: "Verloren",
    dot: "#DC2626",
    aktion: "Lead hat abgesagt oder reagiert dauerhaft nicht. In Tabelle ans Ende verschoben.",
  },
];

function PipelineInfoTooltip() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center justify-center rounded-full transition-colors shrink-0"
        style={{
          width: "22px", height: "22px",
          background: "#EEF0F7",
          border: "1px solid #D1D5E8",
          color: "#6B7280",
          fontSize: "12px",
          fontWeight: 700,
          lineHeight: 1,
          cursor: "pointer",
          marginTop: "4px",
        }}
        onMouseEnter={e => { (e.currentTarget.style.background = "#1B2A5E"); (e.currentTarget.style.color = "#fff"); }}
        onMouseLeave={e => { (e.currentTarget.style.background = "#EEF0F7"); (e.currentTarget.style.color = "#6B7280"); }}
        title="Pipeline-Prozess anzeigen"
      >
        ?
      </button>

      {open && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(20,25,58,0.55)", backdropFilter: "blur(4px)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl"
            style={{ background: "#FFFFFF", boxShadow: "0 24px 64px rgba(27,42,94,0.28)", border: "1px solid #D1D5E8" }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: "1px solid #EEF0F7" }}>
              <div>
                <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "20px", color: "#14193A" }}>
                  Lead → Kunde: Prozess & Statusübergänge
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "#9CA3AF" }}>
                  Alle Statuswechsel · automatische Aktionen · manuelle Schritte
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{ color: "#9CA3AF", fontSize: "22px", lineHeight: 1, background: "none", border: "none", cursor: "pointer" }}
              >×</button>
            </div>

            {/* Legende */}
            <div className="px-6 pt-4 pb-2 flex gap-4 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
                <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(22,163,74,.12)", color: "#15803D" }}>Auto</span>
                Automatisch nach Mailversand
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "#6B7280" }}>
                <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "#EEF0F7", color: "#1B2A5E" }}>Manuell</span>
                Per Dropdown oder Swipe setzen
              </span>
            </div>

            {/* Schritte */}
            <div className="px-6 pb-6 pt-2">
              <div className="relative">
                {/* Verbindungslinie */}
                <div
                  className="absolute left-[9px] top-4 bottom-4"
                  style={{ width: "2px", background: "linear-gradient(to bottom, #EEF0F7, #D1D5E8)" }}
                />

                <div className="space-y-0">
                  {PIPELINE_STEPS.map((step, i) => (
                    <div key={step.status} className="flex gap-4 relative">
                      {/* Dot */}
                      <div className="shrink-0 pt-3.5 z-10">
                        <div
                          className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                          style={{ background: "#FFFFFF", borderColor: step.dot }}
                        >
                          <div className="w-2 h-2 rounded-full" style={{ background: step.dot }} />
                        </div>
                      </div>

                      {/* Inhalt */}
                      <div className="flex-1 py-3" style={{ borderBottom: i < PIPELINE_STEPS.length - 1 ? "1px solid #F7F8FC" : "none" }}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold" style={{ color: "#14193A" }}>{step.label}</span>
                          {step.automatisch && (
                            <span className="rounded px-2 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(22,163,74,.12)", color: "#15803D" }}>
                              Auto
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: "#6B7280" }}>{step.aktion}</p>
                        {step.hinweis && (
                          <p className="text-xs mt-1 italic" style={{ color: "#C8A96E" }}>ℹ {step.hinweis}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mail-Versand-Erklärung */}
              <div
                className="mt-5 rounded-xl p-4 text-xs space-y-1.5"
                style={{ background: "#F7F8FC", border: "1px solid #E5E7F0" }}
              >
                <p className="font-semibold" style={{ color: "#14193A" }}>📬 Automatische Status-Übergänge nach Mailversand</p>
                <div className="space-y-1" style={{ color: "#6B7280" }}>
                  <p>neu / in_bearbeitung → <strong style={{ color: "#14193A" }}>kontaktiert</strong></p>
                  <p>kontaktiert → <strong style={{ color: "#14193A" }}>follow_up</strong> (Follow-up-Datum: +5 Tage)</p>
                  <p>follow_up → <strong style={{ color: "#14193A" }}>nachgefasst</strong></p>
                  <p className="pt-1" style={{ color: "#9CA3AF" }}>
                    Gilt für Blazed (Hermes SMTP-Queue) und Online First/Itaba (Resend direkt).
                    follow_up und nachgefasst können nicht manuell per Dropdown gesetzt werden — nur via Mailversand.
                  </p>
                </div>
              </div>

              {/* Gewonnen-Hinweis */}
              <div
                className="mt-3 rounded-xl p-4 text-xs"
                style={{ background: "rgba(22,163,74,.06)", border: "1px solid rgba(22,163,74,.2)" }}
              >
                <p className="font-semibold mb-1" style={{ color: "#15803D" }}>✓ Lead gewonnen → Kunden anlegen</p>
                <p style={{ color: "#374151" }}>
                  Status auf <strong>Gewonnen</strong> setzen, dann manuell unter{" "}
                  <strong>CRM → Kunden → Neuer Kunde</strong> anlegen.
                  Der Lead-Datensatz bleibt erhalten (Aktivitäten, Mails, Notizen).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
