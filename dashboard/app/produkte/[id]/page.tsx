"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { getVenture } from "@/lib/ventures";
import AttachmentsPanel from "@/components/AttachmentsPanel";
import NotesField from "@/components/NotesField";

interface ProductImage { url: string; storage_path: string; alt: string; sort_order: number; }
interface VariantOption { id?: string; name: string; values: string[]; sort_order: number; }
interface Variant {
  id?: string;
  sku: string;
  price: string | number | null;
  compare_at_price: string | number | null;
  stock_quantity: number;
  option_values: Record<string, string>;
  is_active: boolean;
}
interface InventoryMovement {
  id: string;
  type: string;
  quantity: number;
  stock_before: number;
  stock_after: number;
  reference_type: string | null;
  note: string | null;
  created_at: string;
  variant: { option_values: Record<string, string>; sku: string | null } | null;
}

const STATUS_LABELS: Record<string, string> = { draft: "Entwurf", active: "Aktiv", archived: "Archiviert" };
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  archived: "bg-red-100 text-red-600",
};
const MOVEMENT_COLORS: Record<string, string> = {
  in: "text-green-600", out: "text-red-500", adjustment: "text-blue-600", return: "text-orange-500",
};

export default function ProduktDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // Edit states
  const [editName, setEditName] = useState("");
  const [editStatus, setEditStatus] = useState("draft");
  const [editPrice, setEditPrice] = useState("");
  const [editComparePrice, setEditComparePrice] = useState("");
  const [editCostPrice, setEditCostPrice] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editShortDesc, setEditShortDesc] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editFeatured, setEditFeatured] = useState(false);
  const [editTrackInventory, setEditTrackInventory] = useState(false);

  // Variants
  const [variantOptions, setVariantOptions] = useState<VariantOption[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantsDirty, setVariantsDirty] = useState(false);

  // Tags
  const [tagInput, setTagInput] = useState("");
  const [selectedTags, setSelectedTags] = useState<{ id: string; name: string }[]>([]);

  // Inventory
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [showAddMovement, setShowAddMovement] = useState(false);
  const [movForm, setMovForm] = useState({ type: "in", quantity: "", variant_id: "", note: "" });

  // Image upload
  const [uploading, setUploading] = useState(false);

  async function load() {
    const [p, m] = await Promise.all([
      fetch(`/api/produkte/${id}`).then(r => r.json()),
      fetch(`/api/produkte/${id}/lager`).then(r => r.json()),
    ]);
    setProduct(p);
    setEditName(p.name ?? "");
    setEditStatus(p.status ?? "draft");
    setEditPrice(p.price != null ? String(p.price) : "");
    setEditComparePrice(p.compare_at_price != null ? String(p.compare_at_price) : "");
    setEditCostPrice(p.cost_price != null ? String(p.cost_price) : "");
    setEditDescription(p.description ?? "");
    setEditShortDesc(p.short_description ?? "");
    setEditSku(p.sku ?? "");
    setEditWeight(p.weight != null ? String(p.weight) : "");
    setEditFeatured(p.is_featured ?? false);
    setEditTrackInventory(p.track_inventory ?? false);
    setVariantOptions(p.variant_options ?? []);
    setVariants((p.variants ?? []).map((v: any) => ({
      ...v, price: v.price != null ? String(v.price) : "",
      compare_at_price: v.compare_at_price != null ? String(v.compare_at_price) : "",
    })));
    setSelectedTags(p.tags ?? []);
    setMovements(Array.isArray(m) ? m : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

  async function patch(fields: Record<string, unknown>, key = "general") {
    setSaving(key);
    await fetch(`/api/produkte/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    });
    await load();
    setSaving(null);
  }

  async function saveVariants() {
    setSaving("variants");
    await fetch(`/api/produkte/${id}/varianten`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        variant_options: variantOptions,
        variants: variants.map(v => ({
          ...v,
          price: v.price !== "" ? parseFloat(String(v.price)) : null,
          compare_at_price: v.compare_at_price !== "" ? parseFloat(String(v.compare_at_price)) : null,
        })),
      }),
    });
    setVariantsDirty(false);
    await load();
    setSaving(null);
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/produkte/${id}/bilder`, { method: "POST", body: fd });
    await load();
    setUploading(false);
  }

  async function deleteImage(storage_path: string) {
    if (!confirm("Bild löschen?")) return;
    await fetch(`/api/produkte/${id}/bilder`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storage_path }),
    });
    await load();
  }

  async function addMovement() {
    if (!movForm.quantity) return;
    setSaving("movement");
    await fetch(`/api/produkte/${id}/lager`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: movForm.type,
        quantity: parseInt(movForm.quantity),
        variant_id: movForm.variant_id || null,
        note: movForm.note || null,
        reference_type: "manual",
      }),
    });
    setMovForm({ type: "in", quantity: "", variant_id: "", note: "" });
    setShowAddMovement(false);
    await load();
    setSaving(null);
  }

  function addVariantOption() {
    setVariantOptions(prev => [...prev, { name: "", values: [], sort_order: prev.length }]);
    setVariantsDirty(true);
  }

  function generateVariants() {
    if (!variantOptions.length) return;
    const combos: Record<string, string>[] = [{}];
    for (const opt of variantOptions) {
      const newCombos: Record<string, string>[] = [];
      for (const combo of combos) {
        for (const val of opt.values) {
          newCombos.push({ ...combo, [opt.name]: val });
        }
      }
      if (newCombos.length) combos.splice(0, combos.length, ...newCombos);
    }
    const filtered = combos.filter(c => Object.keys(c).length > 0);
    setVariants(filtered.map((ov, i) => ({
      sku: "",
      price: editPrice,
      compare_at_price: "",
      stock_quantity: 0,
      option_values: ov,
      is_active: true,
    })));
    setVariantsDirty(true);
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Laden...</div>;
  if (!product) return <div className="p-8 text-sm text-red-500">Produkt nicht gefunden.</div>;

  const meta = getVenture(product.venture);
  const hasInventory = product.product_type?.has_inventory;
  const hasVariants = product.product_type?.has_variants;
  const hasWeight = product.product_type?.has_weight;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/produkte" className="text-sm text-gray-400 hover:text-gray-600">← Produkte</Link>
        <span className="text-gray-200">/</span>
        <span className="text-sm text-gray-700 font-medium">{product.name}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Linke Spalte */}
        <div className="lg:col-span-2 space-y-5">

          {/* Basis-Infos */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Produktinfo</p>
              {meta && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>{meta.label}</span>}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Name</label>
              <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">SKU</label>
                <input type="text" value={editSku} onChange={e => setEditSku(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              {hasWeight && (
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Gewicht (kg)</label>
                  <input type="number" step="0.001" value={editWeight} onChange={e => setEditWeight(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Kurzbeschreibung</label>
              <input type="text" value={editShortDesc} onChange={e => setEditShortDesc(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Beschreibung</label>
              <textarea rows={4} value={editDescription} onChange={e => setEditDescription(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => patch({
                name: editName, sku: editSku || null,
                short_description: editShortDesc || null, description: editDescription || null,
                weight: editWeight ? parseFloat(editWeight) : null,
                is_featured: editFeatured, track_inventory: editTrackInventory,
              })} disabled={saving === "general"}
                className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving === "general" ? "..." : "Speichern"}
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={editFeatured} onChange={e => setEditFeatured(e.target.checked)} className="rounded" />
                Featured
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={editTrackInventory} onChange={e => setEditTrackInventory(e.target.checked)} className="rounded" />
                Lager verfolgen
              </label>
            </div>
          </div>

          {/* Preise */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Preise</p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Verkaufspreis (€)", val: editPrice, set: setEditPrice },
                { label: "Vergleichspreis (€)", val: editComparePrice, set: setEditComparePrice },
                { label: "Einkaufspreis (€)", val: editCostPrice, set: setEditCostPrice },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input type="number" step="0.01" min="0" value={val} onChange={e => set(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
              ))}
            </div>
            <button onClick={() => patch({
              price: editPrice ? parseFloat(editPrice) : null,
              compare_at_price: editComparePrice ? parseFloat(editComparePrice) : null,
              cost_price: editCostPrice ? parseFloat(editCostPrice) : null,
            }, "prices")} disabled={saving === "prices"}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving === "prices" ? "..." : "Preise speichern"}
            </button>
          </div>

          {/* Bilder */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Bilder</p>
            <div className="flex flex-wrap gap-3 mb-3">
              {(product.images ?? []).map((img: ProductImage) => (
                <div key={img.storage_path} className="relative group w-24 h-24">
                  <img src={img.url} alt={img.alt}
                    className="w-24 h-24 rounded-lg object-cover border border-gray-100" />
                  <button onClick={() => deleteImage(img.storage_path)}
                    className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity text-xs leading-none">
                    ×
                  </button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-200 hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors text-2xl disabled:opacity-50">
                {uploading ? "..." : "+"}
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={e => e.target.files?.[0] && uploadImage(e.target.files[0])} />
            <p className="text-xs text-gray-400">JPG, PNG, WebP — max. 10 MB</p>
          </div>

          {/* Varianten */}
          {hasVariants && (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Varianten</p>
                <button onClick={addVariantOption}
                  className="text-xs text-blue-600 hover:text-blue-700">+ Option hinzufügen</button>
              </div>

              {/* Variant Options */}
              {variantOptions.map((opt, oi) => (
                <div key={oi} className="border border-gray-100 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="text" value={opt.name}
                      placeholder="Option (z.B. Größe)"
                      onChange={e => {
                        const updated = [...variantOptions];
                        updated[oi] = { ...updated[oi], name: e.target.value };
                        setVariantOptions(updated); setVariantsDirty(true);
                      }}
                      className="flex-1 text-sm border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <button onClick={() => {
                      setVariantOptions(prev => prev.filter((_, i) => i !== oi));
                      setVariantsDirty(true);
                    }} className="text-xs text-red-400 hover:text-red-600">Löschen</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {opt.values.map((val, vi) => (
                      <span key={vi} className="flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5">
                        {val}
                        <button onClick={() => {
                          const updated = [...variantOptions];
                          updated[oi].values = updated[oi].values.filter((_, i) => i !== vi);
                          setVariantOptions(updated); setVariantsDirty(true);
                        }} className="text-gray-400 hover:text-gray-600">×</button>
                      </span>
                    ))}
                    <input type="text" placeholder="+ Wert"
                      onKeyDown={e => {
                        if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
                          const updated = [...variantOptions];
                          updated[oi].values = [...updated[oi].values, (e.target as HTMLInputElement).value.trim()];
                          setVariantOptions(updated); setVariantsDirty(true);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                      className="text-xs border border-dashed border-gray-300 rounded-full px-2 py-0.5 w-20 focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
              ))}

              {variantOptions.length > 0 && (
                <button onClick={generateVariants}
                  className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors">
                  Varianten generieren
                </button>
              )}

              {/* Variant rows */}
              {variants.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 pr-3 font-medium text-gray-500">Kombination</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500 w-20">SKU</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500 w-20">Preis €</th>
                        <th className="text-left py-2 pr-3 font-medium text-gray-500 w-16">Bestand</th>
                        <th className="text-center py-2 font-medium text-gray-500 w-12">Aktiv</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {variants.map((v, vi) => (
                        <tr key={vi}>
                          <td className="py-2 pr-3 text-gray-700">
                            {Object.values(v.option_values).join(" / ") || "—"}
                          </td>
                          <td className="py-2 pr-3">
                            <input type="text" value={v.sku}
                              onChange={e => { const u = [...variants]; u[vi].sku = e.target.value; setVariants(u); setVariantsDirty(true); }}
                              className="w-full border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="py-2 pr-3">
                            <input type="number" step="0.01" value={v.price ?? ""}
                              onChange={e => { const u = [...variants]; u[vi].price = e.target.value; setVariants(u); setVariantsDirty(true); }}
                              className="w-full border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="py-2 pr-3">
                            <input type="number" value={v.stock_quantity}
                              onChange={e => { const u = [...variants]; u[vi].stock_quantity = parseInt(e.target.value) || 0; setVariants(u); setVariantsDirty(true); }}
                              className="w-full border border-gray-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                          </td>
                          <td className="py-2 text-center">
                            <input type="checkbox" checked={v.is_active}
                              onChange={e => { const u = [...variants]; u[vi].is_active = e.target.checked; setVariants(u); setVariantsDirty(true); }}
                              className="rounded" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {variantsDirty && (
                <button onClick={saveVariants} disabled={saving === "variants"}
                  className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
                  {saving === "variants" ? "..." : "Varianten speichern"}
                </button>
              )}
            </div>
          )}

          {/* Lagerbewegungen */}
          {(hasInventory || editTrackInventory) && (
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lagerbewegungen</p>
                <button onClick={() => setShowAddMovement(!showAddMovement)}
                  className="text-xs text-blue-600 hover:text-blue-700">+ Bewegung</button>
              </div>

              {showAddMovement && (
                <div className="px-5 py-4 border-b border-gray-100 bg-gray-50 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Typ</label>
                      <select value={movForm.type} onChange={e => setMovForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white">
                        <option value="in">Eingang</option>
                        <option value="out">Ausgang</option>
                        <option value="adjustment">Korrektur</option>
                        <option value="return">Retoure</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Menge</label>
                      <input type="number" min="1" value={movForm.quantity}
                        onChange={e => setMovForm(p => ({ ...p, quantity: e.target.value }))}
                        className="w-full text-sm border border-gray-200 rounded px-2 py-1.5" />
                    </div>
                    {variants.length > 0 && (
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Variante</label>
                        <select value={movForm.variant_id} onChange={e => setMovForm(p => ({ ...p, variant_id: e.target.value }))}
                          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white">
                          <option value="">— alle —</option>
                          {product.variants?.map((v: any) => (
                            <option key={v.id} value={v.id}>{Object.values(v.option_values).join(" / ")}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notiz</label>
                    <input type="text" value={movForm.note}
                      onChange={e => setMovForm(p => ({ ...p, note: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addMovement} disabled={!movForm.quantity || saving === "movement"}
                      className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                      {saving === "movement" ? "..." : "Speichern"}
                    </button>
                    <button onClick={() => setShowAddMovement(false)}
                      className="text-sm px-3 py-1.5 text-gray-500 hover:text-gray-700">Abbrechen</button>
                  </div>
                </div>
              )}

              {movements.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">Noch keine Bewegungen</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {movements.map(m => (
                    <div key={m.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`font-mono text-xs font-semibold ${MOVEMENT_COLORS[m.type]}`}>
                          {m.type === "out" ? "-" : "+"}{Math.abs(m.quantity)}
                        </span>
                        <div>
                          <span className="text-xs font-medium text-gray-700 capitalize">{m.type}</span>
                          {m.variant && (
                            <span className="text-xs text-gray-400 ml-1">
                              ({Object.values(m.variant.option_values ?? {}).join(" / ")})
                            </span>
                          )}
                          {m.note && <p className="text-xs text-gray-400">{m.note}</p>}
                        </div>
                      </div>
                      <div className="text-right text-xs text-gray-400">
                        <p>{m.stock_before ?? "—"} → <strong className="text-gray-600">{m.stock_after ?? "—"}</strong></p>
                        <p>{new Date(m.created_at).toLocaleDateString("de-DE")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rechte Spalte */}
        <div className="space-y-5">
          {/* Status */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Status</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[product.status] ?? "bg-gray-100 text-gray-600"}`}>
              {STATUS_LABELS[product.status] ?? product.status}
            </span>
            <div className="flex flex-col gap-2 mt-3">
              {["draft", "active", "archived"].map(s => (
                <button key={s} onClick={() => patch({ status: s }, "status")}
                  disabled={product.status === s || saving === "status"}
                  className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                    product.status === s
                      ? "bg-gray-50 text-gray-400 border-gray-100 cursor-default"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}>
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Typ + Marke */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 text-sm space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Details</p>
            {product.product_type && (
              <div>
                <p className="text-xs text-gray-400">Typ</p>
                <p className="text-gray-700">{product.product_type.name}</p>
              </div>
            )}
            {product.brand && (
              <div>
                <p className="text-xs text-gray-400">Marke</p>
                <p className="text-gray-700">{product.brand.name}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-400">Erstellt</p>
              <p className="text-gray-700">{new Date(product.created_at).toLocaleDateString("de-DE")}</p>
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Stichwörter</p>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedTags.map(tag => (
                <span key={tag.id} className="flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-0.5 text-gray-700">
                  {tag.name}
                  <button onClick={async () => {
                    const updated = selectedTags.filter(t => t.id !== tag.id);
                    setSelectedTags(updated);
                    await patch({ tag_ids: updated.map(t => t.id) }, "tags");
                  }} className="text-gray-400 hover:text-gray-600">×</button>
                </span>
              ))}
            </div>
            <input type="text" value={tagInput} onChange={e => setTagInput(e.target.value)}
              placeholder="Tag + Enter"
              onKeyDown={async e => {
                if (e.key === "Enter" && tagInput.trim()) {
                  e.preventDefault();
                  const res = await fetch("/api/produkt-tags", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ venture: product.venture, name: tagInput.trim() }),
                  });
                  const tag = await res.json();
                  if (tag.id && !selectedTags.find(t => t.id === tag.id)) {
                    const updated = [...selectedTags, tag];
                    setSelectedTags(updated);
                    await patch({ tag_ids: updated.map(t => t.id) }, "tags");
                  }
                  setTagInput("");
                }
              }}
              className="text-xs border border-gray-200 rounded-md px-2 py-1.5 w-full focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>

          {/* Notizen */}
          <NotesField
            value={product?.notes ?? null}
            onSave={async (notes) => {
              await fetch(`/api/produkte/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes }),
              });
            }}
          />

          {/* Anhänge */}
          <AttachmentsPanel entityType="product" entityId={id} venture={product?.venture ?? undefined} />

          {/* Löschen */}
          <button onClick={async () => {
            if (!confirm(`"${product.name}" wirklich löschen? Alle Bilder werden entfernt.`)) return;
            await fetch(`/api/produkte/${id}`, { method: "DELETE" });
            router.push("/produkte");
          }} className="w-full text-xs text-red-400 hover:text-red-600 py-2 border border-red-100 rounded-lg hover:bg-red-50 transition-colors">
            Produkt löschen
          </button>
        </div>
      </div>
    </div>
  );
}
