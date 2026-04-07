"use client";

import { useEffect, useState } from "react";

interface ProductType {
  id: string;
  venture: string;
  name: string;
  has_variants: boolean;
  has_inventory: boolean;
  has_weight: boolean;
  sort_order: number;
}

const VENTURE_IDS = ["online_first", "blazed_outfitters", "brandary", "droplane", "worknest"];
const VENTURE_LABELS: Record<string, string> = {
  online_first: "Online First",
  blazed_outfitters: "Blazed Outfitters",
  brandary: "Brandary",
  droplane: "Droplane",
  worknest: "Worknest",
};

const EMPTY_TYPE = { name: "", has_variants: false, has_inventory: false, has_weight: false };

export default function ProduktTypenPage() {
  const [types, setTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [newType, setNewType] = useState<Record<string, typeof EMPTY_TYPE>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const data = await fetch("/api/produkt-typen").then(r => r.json());
    setTypes(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addType(venture: string) {
    const form = newType[venture];
    if (!form?.name?.trim()) return;
    setSaving(`add-${venture}`);
    await fetch("/api/produkt-typen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, venture }),
    });
    setNewType(prev => ({ ...prev, [venture]: { ...EMPTY_TYPE } }));
    await load();
    setSaving(null);
  }

  async function updateType(id: string, patch: Partial<ProductType>) {
    setSaving(id);
    await fetch(`/api/produkt-typen/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    setTypes(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
    setSaving(null);
  }

  async function deleteType(id: string) {
    if (!confirm("Produkttyp löschen?")) return;
    await fetch(`/api/produkt-typen/${id}`, { method: "DELETE" });
    setTypes(prev => prev.filter(t => t.id !== id));
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Produkttypen</h1>
        <p className="text-sm text-gray-500 mt-1">Konfiguriere Typen pro Venture — mit Varianten, Lager und Gewicht.</p>
      </div>

      {VENTURE_IDS.map(venture => {
        const ventureTypes = types.filter(t => t.venture === venture);
        const form = newType[venture] ?? { ...EMPTY_TYPE };
        return (
          <section key={venture}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{VENTURE_LABELS[venture]}</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">
              {ventureTypes.map(t => (
                <div key={t.id} className="px-5 py-3 flex items-center gap-4">
                  <input
                    type="text"
                    value={t.name}
                    onChange={e => updateType(t.id, { name: e.target.value })}
                    className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={t.has_variants}
                      onChange={e => updateType(t.id, { has_variants: e.target.checked })}
                      className="rounded" />
                    Varianten
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={t.has_inventory}
                      onChange={e => updateType(t.id, { has_inventory: e.target.checked })}
                      className="rounded" />
                    Lager
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input type="checkbox" checked={t.has_weight}
                      onChange={e => updateType(t.id, { has_weight: e.target.checked })}
                      className="rounded" />
                    Gewicht
                  </label>
                  <button onClick={() => deleteType(t.id)}
                    className="text-xs text-red-400 hover:text-red-600 shrink-0">
                    Löschen
                  </button>
                </div>
              ))}

              {/* Neuer Typ */}
              <div className="px-5 py-3 flex items-center gap-4 bg-gray-50">
                <input
                  type="text"
                  placeholder="Neuer Typ..."
                  value={form.name}
                  onChange={e => setNewType(prev => ({ ...prev, [venture]: { ...form, name: e.target.value } }))}
                  className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                  onKeyDown={e => e.key === "Enter" && addType(venture)}
                />
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.has_variants}
                    onChange={e => setNewType(prev => ({ ...prev, [venture]: { ...form, has_variants: e.target.checked } }))}
                    className="rounded" />
                  Varianten
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.has_inventory}
                    onChange={e => setNewType(prev => ({ ...prev, [venture]: { ...form, has_inventory: e.target.checked } }))}
                    className="rounded" />
                  Lager
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={form.has_weight}
                    onChange={e => setNewType(prev => ({ ...prev, [venture]: { ...form, has_weight: e.target.checked } }))}
                    className="rounded" />
                  Gewicht
                </label>
                <button
                  onClick={() => addType(venture)}
                  disabled={!form.name.trim() || saving === `add-${venture}`}
                  className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 shrink-0"
                >
                  {saving === `add-${venture}` ? "..." : "+ Hinzufügen"}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
