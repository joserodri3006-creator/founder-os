"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useVenture } from "@/context/VentureContext";

const SOURCES = ["website", "linkedin", "empfehlung", "kaltakquise", "ki_suche", "csv_import"] as const;
const VENTURES = ["online_first", "blazed_outfitters", "droplane", "brandary"] as const;

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const empty = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  company_name: "",
  website: "",
  city: "",
  industry: "",
  source: "website" as typeof SOURCES[number],
  venture: "online_first" as typeof VENTURES[number],
  automation_enabled: true,
  notes: "",
};

export default function NewLeadModal({ onClose, onCreated }: Props) {
  const { venture: activeVenture } = useVenture();
  const [form, setForm] = useState({ ...empty, venture: activeVenture as typeof VENTURES[number] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<string | null>(null);

  function set(field: string, value: string | boolean) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
    setDuplicate(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError("Vorname, Nachname und E-Mail sind Pflicht.");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/lead-intake`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            email: form.email.trim(),
            phone: form.phone.trim() || undefined,
            company_name: form.company_name.trim() || undefined,
            website: form.website.trim() || undefined,
            city: form.city.trim() || undefined,
            industry: form.industry.trim() || undefined,
            source: form.source,
            venture: form.venture,
            automation_enabled: form.automation_enabled,
            notes: form.notes.trim() || undefined,
          }),
        }
      );

      const data = await res.json();

      if (data?.duplicate) {
        setDuplicate(`Duplikat gespeichert — Lead mit dieser E-Mail war bereits vorhanden und wurde als Duplikat markiert.`);
        onCreated();
        onClose();
        return;
      }

      if (!res.ok) {
        setError(data?.error ?? "Fehler beim Speichern. Bitte erneut versuchen.");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Neuer Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Pflichtfelder */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname *" value={form.first_name} onChange={(v) => set("first_name", v)} />
            <Field label="Nachname *" value={form.last_name} onChange={(v) => set("last_name", v)} />
          </div>
          <Field label="E-Mail *" type="email" value={form.email} onChange={(v) => set("email", v)} />

          {/* Optionale Felder */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefon" value={form.phone} onChange={(v) => set("phone", v)} />
            <Field label="Firma" value={form.company_name} onChange={(v) => set("company_name", v)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Website" value={form.website} onChange={(v) => set("website", v)} />
            <Field label="Stadt" value={form.city} onChange={(v) => set("city", v)} />
          </div>
          <Field label="Branche" value={form.industry} onChange={(v) => set("industry", v)} />

          {/* Dropdowns */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Quelle</label>
              <select
                value={form.source}
                onChange={(e) => set("source", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2"
              >
                {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Venture</label>
              <select
                value={form.venture}
                onChange={(e) => set("venture", e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2"
              >
                {VENTURES.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          {/* Automation Toggle */}
          <div className="flex items-center justify-between py-1">
            <span className="text-sm text-gray-700">KI-Automation aktiviert</span>
            <button
              type="button"
              onClick={() => set("automation_enabled", !form.automation_enabled)}
              className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${
                form.automation_enabled ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span className={`inline-block h-4 w-4 mt-0.5 rounded-full bg-white shadow transition-transform ${
                form.automation_enabled ? "translate-x-4" : "translate-x-0.5"
              }`} />
            </button>
          </div>

          {/* Notizen */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notizen</label>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {duplicate && <p className="text-sm text-orange-500">{duplicate}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Speichern…" : "Lead speichern"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50"
            >
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
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </div>
  );
}
