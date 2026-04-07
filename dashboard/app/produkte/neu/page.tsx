"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

interface ProductType {
  id: string;
  name: string;
  has_variants: boolean;
  has_inventory: boolean;
  has_weight: boolean;
}

interface Brand { id: string; name: string; }
interface Category { id: string; name: string; parent_id: string | null; }

export default function NeuesProduktPage() {
  const router = useRouter();
  const { venture } = useVenture();
  const [types, setTypes] = useState<ProductType[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    sku: "",
    short_description: "",
    description: "",
    price: "",
    compare_at_price: "",
    cost_price: "",
    status: "draft",
    is_featured: false,
    track_inventory: false,
    weight: "",
    product_type_id: "",
    brand_id: "",
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/produkt-typen?venture=${venture}`).then(r => r.json()),
      fetch(`/api/produkt-marken?venture=${venture}`).then(r => r.json()),
      fetch(`/api/produkt-kategorien?venture=${venture}`).then(r => r.json()),
    ]).then(([t, b, c]) => {
      setTypes(Array.isArray(t) ? t : []);
      setBrands(Array.isArray(b) ? b : []);
      setCategories(Array.isArray(c) ? c : []);
    });
  }, [venture]);

  const selectedType = types.find(t => t.id === form.product_type_id);

  function upd(patch: Partial<typeof form>) {
    setForm(prev => ({ ...prev, ...patch }));
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) setTags(prev => [...prev, tagInput.trim()]);
      setTagInput("");
    }
  }

  async function save(status: "draft" | "active") {
    if (!form.name.trim()) { setError("Name ist erforderlich"); return; }
    setSaving(true);
    setError(null);

    // Upsert tags first
    const tagIds: string[] = [];
    for (const name of tags) {
      const res = await fetch("/api/produkt-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venture, name }),
      });
      const t = await res.json();
      if (t.id) tagIds.push(t.id);
    }

    const payload = {
      venture,
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      short_description: form.short_description.trim() || null,
      description: form.description.trim() || null,
      price: form.price ? parseFloat(form.price) : null,
      compare_at_price: form.compare_at_price ? parseFloat(form.compare_at_price) : null,
      cost_price: form.cost_price ? parseFloat(form.cost_price) : null,
      status,
      is_featured: form.is_featured,
      track_inventory: form.track_inventory,
      weight: form.weight ? parseFloat(form.weight) : null,
      product_type_id: form.product_type_id || null,
      brand_id: form.brand_id || null,
      category_ids: selectedCategories,
      tag_ids: tagIds,
    };

    const res = await fetch("/api/produkte", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setSaving(false); return; }
    router.push(`/produkte/${data.id}`);
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/produkte" className="text-sm text-gray-400 hover:text-gray-600">← Produkte</Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm text-gray-700 font-medium">Neues Produkt</span>
      </div>

      <div className="space-y-5">
        {/* Basis */}
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Produktinfo</p>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Name *</label>
            <input type="text" value={form.name} onChange={e => upd({ name: e.target.value })}
              autoFocus placeholder="Produktname"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Produkttyp</label>
              <select value={form.product_type_id} onChange={e => upd({ product_type_id: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none">
                <option value="">— kein Typ —</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Marke</label>
              <select value={form.brand_id} onChange={e => upd({ brand_id: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none">
                <option value="">— keine Marke —</option>
                {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Kurzbeschreibung</label>
            <input type="text" value={form.short_description} onChange={e => upd({ short_description: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Beschreibung</label>
            <textarea rows={4} value={form.description} onChange={e => upd({ description: e.target.value })}
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">SKU</label>
            <input type="text" value={form.sku} onChange={e => upd({ sku: e.target.value })}
              placeholder="z.B. BOF-001"
              className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
        </div>

        {/* Preise */}
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preise</p>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Verkaufspreis (€)</label>
              <input type="number" step="0.01" min="0" value={form.price} onChange={e => upd({ price: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vergleichspreis (€)</label>
              <input type="number" step="0.01" min="0" value={form.compare_at_price} onChange={e => upd({ compare_at_price: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Einkaufspreis (€)</label>
              <input type="number" step="0.01" min="0" value={form.cost_price} onChange={e => upd({ cost_price: e.target.value })}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Lager + Gewicht */}
        {(selectedType?.has_inventory || selectedType?.has_weight || !form.product_type_id) && (
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lager & Versand</p>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.track_inventory}
                  onChange={e => upd({ track_inventory: e.target.checked })}
                  className="rounded" />
                Lagerbestand verfolgen
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.is_featured}
                  onChange={e => upd({ is_featured: e.target.checked })}
                  className="rounded" />
                Featured Produkt
              </label>
            </div>
            {selectedType?.has_weight && (
              <div className="w-40">
                <label className="text-xs text-gray-500 block mb-1">Gewicht (kg)</label>
                <input type="number" step="0.001" min="0" value={form.weight} onChange={e => upd({ weight: e.target.value })}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            )}
          </div>
        )}

        {/* Kategorien */}
        {categories.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Kategorien</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <button key={c.id}
                  onClick={() => setSelectedCategories(prev =>
                    prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                  )}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    selectedCategories.includes(c.id)
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Stichwörter</p>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map(tag => (
              <span key={tag} className="flex items-center gap-1 text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-700">
                {tag}
                <button onClick={() => setTags(prev => prev.filter(t => t !== tag))}
                  className="text-gray-400 hover:text-gray-600 ml-0.5">×</button>
              </span>
            ))}
          </div>
          <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={addTag} placeholder="Tag eingeben + Enter"
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-64" />
        </div>

        {/* Fehler + Actions */}
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center gap-3 pb-4">
          <button onClick={() => save("active")} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? "Speichern..." : "Veröffentlichen"}
          </button>
          <button onClick={() => save("draft")} disabled={saving}
            className="px-5 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition-colors">
            Als Entwurf speichern
          </button>
          <Link href="/produkte" className="text-sm text-gray-400 hover:text-gray-600 ml-2">Abbrechen</Link>
        </div>
      </div>
    </div>
  );
}
