"use client";

import { useEffect, useState } from "react";

interface Brand {
  id: string;
  venture: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
}

const VENTURE_IDS = ["online_first", "blazed_outfitters", "brandary", "droplane", "worknest"];
const VENTURE_LABELS: Record<string, string> = {
  online_first: "Online First",
  blazed_outfitters: "Blazed Outfitters",
  brandary: "Brandary",
  droplane: "Droplane",
  worknest: "Worknest",
};

const EMPTY_FORM = { name: "", slug: "", logo_url: "" };

export default function MarkenPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [newForm, setNewForm] = useState<Record<string, typeof EMPTY_FORM>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; slug: string; logo_url: string }>({ name: "", slug: "", logo_url: "" });
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    const data = await fetch("/api/produkt-marken").then(r => r.json());
    setBrands(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function addBrand(venture: string) {
    const form = newForm[venture];
    if (!form?.name?.trim()) return;
    setSaving(`add-${venture}`);
    await fetch("/api/produkt-marken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venture,
        name: form.name.trim(),
        slug: form.slug.trim() || null,
        logo_url: form.logo_url.trim() || null,
      }),
    });
    setNewForm(prev => ({ ...prev, [venture]: { ...EMPTY_FORM } }));
    await load();
    setSaving(null);
  }

  async function updateBrand(id: string) {
    if (!editForm.name.trim()) return;
    setSaving(id);
    await fetch(`/api/produkt-marken/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editForm.name.trim(),
        slug: editForm.slug.trim() || null,
        logo_url: editForm.logo_url.trim() || null,
      }),
    });
    setEditId(null);
    await load();
    setSaving(null);
  }

  async function deleteBrand(id: string, name: string) {
    if (!confirm(`Marke "${name}" wirklich löschen?`)) return;
    await fetch(`/api/produkt-marken/${id}`, { method: "DELETE" });
    setBrands(prev => prev.filter(b => b.id !== id));
  }

  function startEdit(brand: Brand) {
    setEditId(brand.id);
    setEditForm({ name: brand.name, slug: brand.slug ?? "", logo_url: brand.logo_url ?? "" });
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Marken</h1>
        <p className="text-sm text-gray-500 mt-1">Produktmarken pro Venture verwalten.</p>
      </div>

      {VENTURE_IDS.map(venture => {
        const ventureBrands = brands.filter(b => b.venture === venture);
        const form = newForm[venture] ?? { ...EMPTY_FORM };

        return (
          <section key={venture}>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">{VENTURE_LABELS[venture]}</h2>
            <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100">

              {/* Bestehende Marken */}
              {ventureBrands.length === 0 && editId === null && (
                <div className="px-5 py-4 text-sm text-gray-400">Noch keine Marken</div>
              )}

              {ventureBrands.map(brand => (
                <div key={brand.id} className="px-5 py-3">
                  {editId === brand.id ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Name</label>
                          <input type="text" value={editForm.name}
                            onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                            autoFocus
                            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Slug</label>
                          <input type="text" value={editForm.slug}
                            onChange={e => setEditForm(p => ({ ...p, slug: e.target.value }))}
                            placeholder="z.B. blazed-outfitters"
                            className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Logo-URL</label>
                        <input type="url" value={editForm.logo_url}
                          onChange={e => setEditForm(p => ({ ...p, logo_url: e.target.value }))}
                          placeholder="https://..."
                          className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => updateBrand(brand.id)} disabled={saving === brand.id}
                          className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                          {saving === brand.id ? "..." : "Speichern"}
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700">
                          Abbrechen
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {brand.logo_url ? (
                          <img src={brand.logo_url} alt={brand.name}
                            className="w-8 h-8 rounded object-contain bg-gray-50 border border-gray-100" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold">
                            {brand.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-gray-800">{brand.name}</p>
                          {brand.slug && <p className="text-xs text-gray-400">{brand.slug}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => startEdit(brand)}
                          className="text-xs text-gray-400 hover:text-gray-600">
                          Bearbeiten
                        </button>
                        <button onClick={() => deleteBrand(brand.id, brand.name)}
                          className="text-xs text-red-400 hover:text-red-600">
                          Löschen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Neue Marke */}
              <div className="px-5 py-4 bg-gray-50 space-y-3">
                <p className="text-xs text-gray-400 font-medium">Neue Marke</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Name</label>
                    <input type="text" value={form.name}
                      onChange={e => setNewForm(prev => ({ ...prev, [venture]: { ...form, name: e.target.value } }))}
                      placeholder="Markenname"
                      onKeyDown={e => e.key === "Enter" && addBrand(venture)}
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Slug</label>
                    <input type="text" value={form.slug}
                      onChange={e => setNewForm(prev => ({ ...prev, [venture]: { ...form, slug: e.target.value } }))}
                      placeholder="marken-slug"
                      className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Logo-URL (optional)</label>
                  <input type="url" value={form.logo_url}
                    onChange={e => setNewForm(prev => ({ ...prev, [venture]: { ...form, logo_url: e.target.value } }))}
                    placeholder="https://..."
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
                </div>
                <button onClick={() => addBrand(venture)}
                  disabled={!form.name.trim() || saving === `add-${venture}`}
                  className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 transition-colors">
                  {saving === `add-${venture}` ? "..." : "+ Marke hinzufügen"}
                </button>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
