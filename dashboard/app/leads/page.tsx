"use client";

import { useEffect, useState } from "react";
import { Lead, LeadStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";
import NewLeadModal from "@/components/NewLeadModal";
import CsvImportModal from "@/components/CsvImportModal";
import EditLeadModal from "@/components/EditLeadModal";
import CopyLeadModal from "@/components/CopyLeadModal";
import GoogleLeadSearchModal from "@/components/GoogleLeadSearchModal";

const ALL_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];

type Modal =
  | { type: "edit"; id: string }
  | { type: "copy"; id: string; name: string; venture: string }
  | { type: "delete"; id: string; name: string }
  | null;

const STATUS_DOT: Record<string, string> = {
  neu: '#3A5BA0',
  kontaktiert: '#C8A96E',
  qualifiziert: '#1B2A5E',
  angebot: '#7C3AED',
  gewonnen: '#16A34A',
  verloren: '#DC2626',
  follow_up: '#EA580C',
};

const STATUS_BG: Record<string, string> = {
  neu: '#EEF0F7',
  kontaktiert: 'rgba(200,169,110,0.12)',
  qualifiziert: '#EEF0F7',
  angebot: 'rgba(124,58,237,0.08)',
  gewonnen: 'rgba(22,163,74,0.1)',
  verloren: 'rgba(220,38,38,0.08)',
  follow_up: 'rgba(234,88,12,0.1)',
};

const STATUS_TEXT: Record<string, string> = {
  neu: '#1B2A5E',
  kontaktiert: '#A07840',
  qualifiziert: '#14193A',
  angebot: '#5B21B6',
  gewonnen: '#15803D',
  verloren: '#B91C1C',
  follow_up: '#C2410C',
};

export default function LeadsPage() {
  const { venture } = useVenture();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | "alle">("alle");
  const [filterSource, setFilterSource] = useState<string>("alle");
  const [showArchived, setShowArchived] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showGoogleSearch, setShowGoogleSearch] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  async function load() {
    const params = new URLSearchParams();
    if (filterStatus !== "alle") params.set("status", filterStatus);
    if (filterSource !== "alle") params.set("source", filterSource);
    if (showArchived) params.set("archived", "true");
    params.set("venture", venture);
    const res = await fetch(`/api/leads?${params}`);
    const data = await res.json();
    setLeads(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterStatus, filterSource, showArchived, venture]);

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

  const selectStyle: React.CSSProperties = {
    fontSize: '13px',
    border: '1px solid #D1D5E8',
    borderRadius: '8px',
    padding: '7px 12px',
    background: '#FFFFFF',
    color: '#14193A',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  };

  return (
    <div className="px-4 py-5 sm:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 300,
              fontSize: '28px',
              color: '#14193A',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Lead Pipeline
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{leads.length} Leads</p>
        </div>
        <div className="flex items-center gap-2.5">
          {venture === "online_first" && (
            <button
              onClick={() => setShowGoogleSearch(true)}
              className="text-sm px-4 py-2 rounded-lg transition-colors font-medium"
              style={{
                border: '1.5px solid #D1D5E8',
                background: '#FFFFFF',
                color: '#14193A',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#EEF0F7')}
              onMouseLeave={e => (e.currentTarget.style.background = '#FFFFFF')}
            >
              Google Leads suchen
            </button>
          )}
          <button
            onClick={() => setShowCsvImport(true)}
            className="text-sm px-4 py-2 rounded-lg transition-colors font-medium"
            style={{
              border: '1.5px solid #D1D5E8',
              background: 'transparent',
              color: '#14193A',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#EEF0F7')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            CSV Import
          </button>
          <button
            onClick={() => setShowNewLead(true)}
            className="text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{
              background: '#1B2A5E',
              color: '#FFFFFF',
              border: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#243672')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1B2A5E')}
          >
            + Neuer Lead
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="flex gap-2.5 mb-5 flex-wrap items-center p-3 rounded-xl"
        style={{
          background: '#FFFFFF',
          border: '1px solid #D1D5E8',
          boxShadow: '0 2px 12px rgba(27,42,94,0.08)',
        }}
      >
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as LeadStatus | "alle")}
          style={selectStyle}
        >
          <option value="alle">Alle Status</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          style={selectStyle}
        >
          <option value="alle">Alle Quellen</option>
          {["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="text-sm px-3 py-1.5 rounded-lg transition-colors font-medium"
          style={{
            border: showArchived ? '1.5px solid #1B2A5E' : '1px solid #D1D5E8',
            background: showArchived ? '#EEF0F7' : 'transparent',
            color: showArchived ? '#1B2A5E' : '#6B7280',
          }}
        >
          {showArchived ? "← Aktive" : "Archiv"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8" style={{ color: '#6B7280' }}>
          <div
            className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: '#D1D5E8', borderTopColor: '#1B2A5E' }}
          />
          <span className="text-sm">Laden...</span>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1px solid #D1D5E8',
            boxShadow: '0 2px 12px rgba(27,42,94,0.08)',
          }}
        >
          <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #EEF0F7', background: '#F7F8FC' }}>
                {["Name", "Unternehmen", "Status", "Branche", "Quelle", "Draft", "Erstellt", "Aktionen"].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-semibold uppercase"
                    style={{ fontSize: '11px', letterSpacing: '0.07em', color: '#6B7280' }}
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
                  style={{ borderBottom: '1px solid #F7F8FC' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F8FC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/leads/${lead.id}`}
                        className="font-medium transition-colors"
                        style={{ color: '#14193A', fontSize: '14px' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1B2A5E'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#14193A'}
                      >
                        {lead.first_name} {lead.last_name}
                      </Link>
                      {(lead as any).is_duplicate && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-semibold shrink-0"
                          style={{ background: 'rgba(234,88,12,0.1)', color: '#C2410C' }}
                        >
                          Duplikat
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{lead.email}</div>
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: '#6B7280' }}>{lead.company_name ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    <select
                      value={lead.status}
                      disabled={updatingId === lead.id}
                      onChange={(e) => updateStatus(lead.id, e.target.value as LeadStatus)}
                      className="text-xs font-semibold rounded-full cursor-pointer"
                      style={{
                        background: STATUS_BG[lead.status] ?? '#F3F4F6',
                        color: STATUS_TEXT[lead.status] ?? '#374151',
                        border: 'none',
                        padding: '4px 10px',
                        fontFamily: 'var(--font-sans)',
                        outline: 'none',
                      }}
                    >
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: '#6B7280' }}>{lead.industry ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm capitalize" style={{ color: '#6B7280' }}>{lead.source}</td>
                  <td className="px-4 py-3.5">
                    {lead.ai_draft_approved === true && (
                      <span className="text-xs font-semibold" style={{ color: '#16A34A' }}>Freigegeben</span>
                    )}
                    {lead.ai_draft_approved === false && (
                      <span className="text-xs font-semibold" style={{ color: '#C8A96E' }}>Offen</span>
                    )}
                    {lead.ai_draft_approved === null && (
                      <span className="text-xs" style={{ color: '#D1D5E8' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: '#6B7280' }}>
                    {new Date(lead.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <ActionBtn onClick={() => setModal({ type: "edit", id: lead.id })}>
                        Bearbeiten
                      </ActionBtn>
                      <ActionBtn onClick={() => setModal({ type: "copy", id: lead.id, name: `${lead.first_name} ${lead.last_name}`, venture: lead.venture ?? "online_first" })}>
                        Kopieren
                      </ActionBtn>
                      {!lead.archived_at && (
                        <ActionBtn onClick={() => handleArchive(lead.id)}>
                          Archiv
                        </ActionBtn>
                      )}
                      <ActionBtn
                        onClick={() => setModal({ type: "delete", id: lead.id, name: `${lead.first_name} ${lead.last_name}` })}
                        danger
                      >
                        Löschen
                      </ActionBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                    Keine Leads gefunden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

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
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(20,25,58,0.5)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-sm p-6 space-y-4 rounded-2xl"
            style={{
              background: '#FFFFFF',
              boxShadow: '0 20px 56px rgba(27,42,94,0.24)',
              border: '1px solid #D1D5E8',
            }}
          >
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontWeight: 400,
                fontSize: '20px',
                color: '#14193A',
              }}
            >
              Lead löschen
            </h2>
            <p className="text-sm" style={{ color: '#6B7280' }}>
              <span className="font-semibold" style={{ color: '#14193A' }}>{modal.name}</span> wird unwiderruflich gelöscht.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => handleDelete(modal.id)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors"
                style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#B91C1C')}
                onMouseLeave={e => (e.currentTarget.style.background = '#DC2626')}
              >
                Löschen
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors"
                style={{
                  background: 'transparent',
                  color: '#14193A',
                  border: '1.5px solid #D1D5E8',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#EEF0F7')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, children, danger }: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded-md transition-colors font-medium"
      style={{
        color: danger ? '#B91C1C' : '#6B7280',
        background: 'transparent',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = danger ? 'rgba(220,38,38,0.08)' : '#EEF0F7';
        (e.currentTarget as HTMLElement).style.color = danger ? '#B91C1C' : '#14193A';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
        (e.currentTarget as HTMLElement).style.color = danger ? '#B91C1C' : '#6B7280';
      }}
    >
      {children}
    </button>
  );
}
