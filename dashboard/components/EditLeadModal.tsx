"use client";

import { useState, useEffect } from "react";
import { Lead, LeadStatus, STATUS_LABELS } from "@/lib/types";

const SOURCES = ["website", "linkedin", "empfehlung", "kaltakquise", "ki_suche", "csv_import"] as const;
const ALL_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];

interface Props {
  leadId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditLeadModal({ leadId, onClose, onSaved }: Props) {
  const [lead, setLead] = useState<Partial<Lead> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/leads/${leadId}`)
      .then((r) => r.json())
      .then((data) => { setLead(data); setLoading(false); });
  }, [leadId]);

  function set(field: string, value: string | boolean) {
    setLead((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    setSaving(true);
    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: lead.first_name,
        last_name: lead.last_name,
        email: lead.email,
        phone: lead.phone || null,
        company_name: lead.company_name || null,
        website: lead.website || null,
        city: lead.city || null,
        industry: lead.industry || null,
        contact_reason: lead.contact_reason || null,
        notes: lead.notes || null,
        source: lead.source,
        status: lead.status,
        automation_enabled: lead.automation_enabled,
        follow_up_date: lead.follow_up_date || null,
      }),
    });
    setSaving(false);
    if (res.ok) { onSaved(); onClose(); }
    else setError("Fehler beim Speichern.");
  }

  if (loading) return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 text-sm text-gray-400">Laden...</div>
    </div>
  );

  if (!lead) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Lead bearbeiten</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname *" value={lead.first_name ?? ""} onChange={(v) => set("first_name", v)} />
            <Field label="Nachname *" value={lead.last_name ?? ""} onChange={(v) => set("last_name", v)} />
          </div>
          <Field label="E-Mail *" type="email" value={lead.email ?? ""} onChange={(v) => set("email", v)} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon" value={lead.phone ?? ""} onChange={(v) => set("phone", v)} />
            <Field label="Firma" value={lead.company_name ?? ""} onChange={(v) => set("company_name", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Website" value={lead.website ?? ""} onChange={(v) => set("website", v)} />
            <Field label="Stadt" value={lead.city ?? ""} onChange={(v) => set("city", v)} />
          </div>
          <Field label="Branche" value={lead.industry ?? ""} onChange={(v) => set("industry", v)} />
          <Field label="Kontaktgrund" value={lead.contact_reason ?? ""} onChange={(v) => set("contact_reason", v)} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Status</label>
              <select value={lead.status ?? "neu"} onChange={(e) => set("status", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2">
                {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Quelle</label>
              <select value={lead.source ?? "website"} onChange={(e) => set("source", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2">
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <Field label="Follow-up Datum" type="date" value={lead.follow_up_date ?? ""} onChange={(v) => set("follow_up_date", v)} />

          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700">KI-Automation aktiviert</span>
            <button type="button" onClick={() => set("automation_enabled", !lead.automation_enabled)}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${lead.automation_enabled ? "bg-blue-600" : "bg-gray-200"}`}>
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${lead.automation_enabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notizen</label>
            <textarea value={lead.notes ?? ""} onChange={(e) => set("notes", e.target.value)}
              rows={3} className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={saving}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Speichern…" : "Speichern"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50">
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-1 block">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
    </div>
  );
}
