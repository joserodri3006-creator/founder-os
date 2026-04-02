"use client";

import { useEffect, useState } from "react";
import { Lead, LeadStatus, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";
import NewLeadModal from "@/components/NewLeadModal";
import CsvImportModal from "@/components/CsvImportModal";
import EditLeadModal from "@/components/EditLeadModal";
import CopyLeadModal from "@/components/CopyLeadModal";

const ALL_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];

type Modal =
  | { type: "edit"; id: string }
  | { type: "copy"; id: string; name: string; venture: string }
  | { type: "delete"; id: string; name: string }
  | null;

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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Lead Pipeline</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 mr-2">{leads.length} Leads</span>
          <button onClick={() => setShowCsvImport(true)}
            className="text-sm px-3 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 transition-colors">
            CSV Import
          </button>
          <button onClick={() => setShowNewLead(true)}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            + Neuer Lead
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as LeadStatus | "alle")}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
          <option value="alle">Alle Status</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
          <option value="alle">Alle Quellen</option>
          {["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={() => setShowArchived((v) => !v)}
          className={`text-sm px-3 py-1.5 border rounded-md transition-colors ${showArchived ? "border-gray-400 bg-gray-100 text-gray-700" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
          {showArchived ? "← Aktive" : "Archiv"}
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Laden...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Unternehmen</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Branche</th>
                <th className="px-4 py-3 text-left font-medium">Quelle</th>
                <th className="px-4 py-3 text-left font-medium">Draft</th>
                <th className="px-4 py-3 text-left font-medium">Erstellt</th>
                <th className="px-4 py-3 text-left font-medium">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:text-blue-600 hover:underline">
                        {lead.first_name} {lead.last_name}
                      </Link>
                      {(lead as any).is_duplicate && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-600 font-medium shrink-0">
                          Duplikat
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">{lead.email}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{lead.company_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <select value={lead.status} disabled={updatingId === lead.id}
                      onChange={(e) => updateStatus(lead.id, e.target.value as LeadStatus)}
                      className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[lead.status]}`}>
                      {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{lead.industry ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{lead.source}</td>
                  <td className="px-4 py-3">
                    {lead.ai_draft_approved === true && <span className="text-xs text-green-600 font-medium">Freigegeben</span>}
                    {lead.ai_draft_approved === false && <span className="text-xs text-orange-500 font-medium">Offen</span>}
                    {lead.ai_draft_approved === null && <span className="text-xs text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{new Date(lead.created_at).toLocaleDateString("de-DE")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModal({ type: "edit", id: lead.id })}
                        className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Bearbeiten"
                      >
                        Bearbeiten
                      </button>
                      <button
                        onClick={() => setModal({ type: "copy", id: lead.id, name: `${lead.first_name} ${lead.last_name}`, venture: lead.venture ?? "online_first" })}
                        className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                        title="Kopieren"
                      >
                        Kopieren
                      </button>
                      {!lead.archived_at && (
                        <button
                          onClick={() => handleArchive(lead.id)}
                          className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="Archivieren"
                        >
                          Archiv
                        </button>
                      )}
                      <button
                        onClick={() => setModal({ type: "delete", id: lead.id, name: `${lead.first_name} ${lead.last_name}` })}
                        className="text-xs px-2 py-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Löschen"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-gray-400">Keine Leads gefunden</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNewLead && (
        <NewLeadModal onClose={() => setShowNewLead(false)} onCreated={() => { setShowNewLead(false); setTimeout(load, 500); }} />
      )}
      {showCsvImport && (
        <CsvImportModal onClose={() => setShowCsvImport(false)} onImported={() => setTimeout(load, 500)} />
      )}
      {modal?.type === "edit" && (
        <EditLeadModal leadId={modal.id} onClose={() => setModal(null)} onSaved={() => { setModal(null); setTimeout(load, 300); }} />
      )}
      {modal?.type === "copy" && (
        <CopyLeadModal leadId={modal.id} leadName={modal.name} currentVenture={modal.venture}
          onClose={() => setModal(null)} onCopied={() => setTimeout(load, 300)} />
      )}
      {modal?.type === "delete" && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Lead löschen</h2>
            <p className="text-sm text-gray-600">
              <span className="font-medium">{modal.name}</span> wird unwiderruflich gelöscht.
            </p>
            <div className="flex gap-3">
              <button onClick={() => handleDelete(modal.id)}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 transition-colors">
                Löschen
              </button>
              <button onClick={() => setModal(null)}
                className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
