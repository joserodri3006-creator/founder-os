"use client";

import { useEffect, useState, useCallback } from "react";
import { useVenture } from "@/context/VentureContext";

interface TaxRate {
  id?: string;
  country: string;
  rate: number;
  label: string;
  priority: number;
}

interface TaxClass {
  id: string;
  name: string;
  slug: string;
  description?: string;
  venture: string;
  is_default: boolean;
  created_at: string;
  rates: TaxRate[];
}

const COUNTRY_LABELS: Record<string, string> = {
  DE: "Deutschland (DE)",
  AT: "Österreich (AT)",
  CH: "Schweiz (CH)",
  EU: "EU (alle Länder)",
};

// ── New Class Modal ──────────────────────────────────────────────────────────
interface NewClassModalProps {
  venture: string;
  onClose: () => void;
  onSaved: () => void;
}
function NewClassModal({ venture, onClose, onSaved }: NewClassModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rate, setRate] = useState("19");
  const [country, setCountry] = useState("DE");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    await fetch("/api/steuerklassen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        slug,
        description: description.trim() || null,
        venture,
        is_default: false,
        rates: [{ country, rate: parseFloat(rate) / 100, label: `${rate}% MwSt.`, priority: 1 }],
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h2 className="text-base font-semibold text-[#14193A]">Neue Steuerklasse</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="z.B. Reduzierter Satz"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Beschreibung</label>
            <input
              type="text" value={description} onChange={e => setDescription(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40 focus:border-[#C8A96E]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Steuersatz (%)</label>
              <input
                type="number" step="0.01" min="0" max="100" value={rate}
                onChange={e => setRate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#C8A96E]/40"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Land</label>
              <select
                value={country} onChange={e => setCountry(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none"
              >
                {Object.entries(COUNTRY_LABELS).map(([code, label]) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 text-sm border border-gray-200 rounded-lg py-2 text-gray-600 hover:bg-gray-50">
            Abbrechen
          </button>
          <button onClick={save} disabled={!name.trim() || saving}
            className="flex-1 text-sm bg-[#1B2A5E] text-white rounded-lg py-2 hover:bg-[#14193A] disabled:opacity-40 font-medium">
            {saving ? "Speichern…" : "Anlegen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tax Class Card ───────────────────────────────────────────────────────────
interface TaxClassCardProps {
  tc: TaxClass;
  onSetDefault: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onUpdate: (id: string, fields: Partial<TaxClass>) => void;
}
function TaxClassCard({ tc, onSetDefault, onDelete, onUpdate }: TaxClassCardProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(tc.name);
  const [editDesc, setEditDesc] = useState(tc.description ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch(`/api/steuerklassen/${tc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
    });
    setSaving(false);
    setEditing(false);
    onUpdate(tc.id, { name: editName, description: editDesc });
  }

  const primaryRate = tc.rates?.[0];
  const ratePercent = primaryRate ? (Number(primaryRate.rate) * 100).toFixed(0) : "—";

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${tc.is_default ? "border-[#C8A96E]" : "border-gray-200"}`}>
      {/* Header */}
      <div className={`px-5 py-3 flex items-center justify-between ${tc.is_default ? "bg-[#C8A96E]/10" : "bg-gray-50"}`}>
        <div className="flex items-center gap-2">
          {editing ? (
            <input
              autoFocus type="text" value={editName} onChange={e => setEditName(e.target.value)}
              className="text-sm font-semibold text-[#14193A] border border-gray-300 rounded px-2 py-0.5 focus:outline-none"
            />
          ) : (
            <h3 className="text-sm font-semibold text-[#14193A]">{tc.name}</h3>
          )}
          {tc.is_default && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#C8A96E] text-white font-bold uppercase tracking-wide">
              Standard
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!tc.is_default && (
            <button onClick={() => onSetDefault(tc.id)}
              className="text-xs text-gray-400 hover:text-[#1B2A5E] px-2 py-1 rounded hover:bg-gray-100">
              Als Standard
            </button>
          )}
          {editing ? (
            <>
              <button onClick={save} disabled={saving}
                className="text-xs text-[#1B2A5E] hover:underline px-2 py-1">
                {saving ? "…" : "Speichern"}
              </button>
              <button onClick={() => { setEditing(false); setEditName(tc.name); setEditDesc(tc.description ?? ""); }}
                className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">
                Abbrechen
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)}
                className="text-xs text-gray-400 hover:text-[#1B2A5E] px-2 py-1 rounded hover:bg-gray-100">
                Bearbeiten
              </button>
              <button onClick={() => onDelete(tc.id, tc.name)}
                className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50">
                Löschen
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        {editing ? (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Beschreibung</label>
            <input type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none" />
          </div>
        ) : tc.description ? (
          <p className="text-sm text-gray-500">{tc.description}</p>
        ) : null}

        {/* Rates table */}
        {tc.rates && tc.rates.length > 0 ? (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Steuersätze</p>
            <div className="space-y-1.5">
              {tc.rates.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{r.country}</span>
                    <span className="text-gray-600">{r.label || `${(Number(r.rate) * 100).toFixed(0)}% MwSt.`}</span>
                  </div>
                  <span className={`text-sm font-bold ${Number(r.rate) === 0 ? "text-gray-400" : "text-[#14193A]"}`}>
                    {(Number(r.rate) * 100).toFixed(Number(r.rate) % 0.01 !== 0 ? 2 : 0)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">Keine Steuersätze definiert</p>
        )}

        {/* Slug */}
        <p className="text-[11px] text-gray-300 font-mono">slug: {tc.slug}</p>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function SteuernPage() {
  const { venture } = useVenture();
  const [taxClasses, setTaxClasses] = useState<TaxClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetch(`/api/steuerklassen?venture=${venture}`).then(r => r.json());
    setTaxClasses(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [venture]);

  useEffect(() => { load(); }, [load]);

  async function setDefault(id: string) {
    // Unset all defaults first, then set new default
    await Promise.all(
      taxClasses.map(tc =>
        fetch(`/api/steuerklassen/${tc.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_default: tc.id === id }),
        })
      )
    );
    await load();
  }

  async function deleteClass(id: string, name: string) {
    if (!confirm(`"${name}" wirklich löschen?`)) return;
    const res = await fetch(`/api/steuerklassen/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error ?? "Fehler beim Löschen");
    }
    await load();
  }

  function updateLocal(id: string, fields: Partial<TaxClass>) {
    setTaxClasses(prev => prev.map(tc => tc.id === id ? { ...tc, ...fields } : tc));
  }

  return (
    <>
      {showNew && (
        <NewClassModal
          venture={venture}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }}
        />
      )}

      <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#14193A]">Steuer-Konfiguration</h1>
            <p className="text-sm text-gray-500 mt-1">
              Steuerklassen und -sätze für Produkte · {venture.replace(/_/g, " ")}
            </p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="shrink-0 text-sm px-4 py-2 bg-[#1B2A5E] text-white rounded-lg hover:bg-[#14193A] font-medium"
          >
            + Neue Klasse
          </button>
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 mb-5 text-xs text-blue-700">
          <p className="font-semibold mb-1">Wie funktionieren Steuerklassen?</p>
          <ul className="list-disc list-inside space-y-0.5 text-blue-600">
            <li>Jedes Produkt kann eine Steuerklasse zugewiesen bekommen</li>
            <li>Die <strong>Standard</strong>-Klasse wird automatisch neuen Produkten zugewiesen</li>
            <li>Deutsche MwSt-Sätze: Normal 19%, Ermäßigt 7%, Steuerfrei 0%</li>
          </ul>
        </div>

        {/* Tax classes */}
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Laden…</div>
        ) : taxClasses.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-3">🧾</div>
            <p className="text-sm text-gray-500">Noch keine Steuerklassen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {taxClasses.map(tc => (
              <TaxClassCard
                key={tc.id}
                tc={tc}
                onSetDefault={setDefault}
                onDelete={deleteClass}
                onUpdate={updateLocal}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
