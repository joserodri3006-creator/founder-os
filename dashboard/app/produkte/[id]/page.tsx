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

  // Sale price
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editSaleFrom, setEditSaleFrom] = useState("");
  const [editSaleUntil, setEditSaleUntil] = useState("");

  // SEO
  const [editSlug, setEditSlug] = useState("");
  const [editMetaTitle, setEditMetaTitle] = useState("");
  const [editMetaDesc, setEditMetaDesc] = useState("");
  const [editOgTitle, setEditOgTitle] = useState("");
  const [editOgDesc, setEditOgDesc] = useState("");
  const [editCanonical, setEditCanonical] = useState("");
  const [editNoIndex, setEditNoIndex] = useState(false);

  // Categories
  const [allCategories, setAllCategories] = useState<{ id: string; name: string; level: number }[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Tax
  const [taxClasses, setTaxClasses] = useState<{ id: string; name: string; rates: { rate: number }[] }[]>([]);
  const [editTaxClassId, setEditTaxClassId] = useState<string | null>(null);

  // Image upload
  const [uploading, setUploading] = useState(false);

  async function load() {
    const [p, m] = await Promise.all([
      fetch(`/api/produkte/${id}`).then(r => r.json()),
      fetch(`/api/produkte/${id}/lager`).then(r => r.json()),
    ]);
    // Load tax classes for this venture
    if (p.venture) {
      fetch(`/api/steuerklassen?venture=${p.venture}`)
        .then(r => r.json())
        .then(data => setTaxClasses(Array.isArray(data) ? data : []));
    }
    setProduct(p);
    setSelectedCategories((p.categories ?? []).map((c: any) => c.id));
    if (p.venture) {
      fetch(`/api/produkt-kategorien?venture=${p.venture}`)
        .then(r => r.json())
        .then(data => setAllCategories(Array.isArray(data) ? data : []));
    }
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
    setEditSalePrice(p.sale_price != null ? String(p.sale_price) : "");
    setEditSaleFrom(p.sale_from ? p.sale_from.slice(0, 16) : "");
    setEditSaleUntil(p.sale_until ? p.sale_until.slice(0, 16) : "");
    setEditSlug(p.slug ?? "");
    setEditMetaTitle(p.meta_title ?? "");
    setEditMetaDesc(p.meta_description ?? "");
    setEditOgTitle(p.og_title ?? "");
    setEditOgDesc(p.og_description ?? "");
    setEditCanonical(p.canonical_url ?? "");
    setEditNoIndex(p.no_index ?? false);
    setEditTaxClassId(p.tax_class_id ?? null);
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

            {/* Basis-Preise */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Verkaufspreis (€)", val: editPrice, set: setEditPrice },
                { label: "Vergleichspreis (€)", val: editComparePrice, set: setEditComparePrice, hint: "Ursprünglicher Preis, wird durchgestrichen" },
                { label: "Einkaufspreis (€)", val: editCostPrice, set: setEditCostPrice },
              ].map(({ label, val, set, hint }) => (
                <div key={label}>
                  <label className="text-xs text-gray-500 block mb-1">{label}</label>
                  <input type="number" step="0.01" min="0" value={val} onChange={e => set(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                  {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
                </div>
              ))}
            </div>

            {/* Aktionspreis */}
            <div className="border border-dashed border-gray-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Aktionspreis</p>
                {(() => {
                  const now = new Date();
                  const sp = product.sale_price;
                  const sf = product.sale_from ? new Date(product.sale_from) : null;
                  const su = product.sale_until ? new Date(product.sale_until) : null;
                  const active = sp != null && (sf == null || sf <= now) && (su == null || su >= now);
                  return active ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: "rgba(22,163,74,0.1)", color: "#15803D" }}>
                      ✓ Aktionspreis aktiv
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: "#F3F4F6", color: "#6B7280" }}>
                      Inaktiv
                    </span>
                  );
                })()}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Aktionspreis (€)</label>
                  <input type="number" step="0.01" min="0" value={editSalePrice}
                    onChange={e => setEditSalePrice(e.target.value)}
                    placeholder="z.B. 75.00"
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Aktiv von</label>
                  <input type="datetime-local" value={editSaleFrom}
                    onChange={e => setEditSaleFrom(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Aktiv bis</label>
                  <input type="datetime-local" value={editSaleUntil}
                    onChange={e => setEditSaleUntil(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-green-500" />
                </div>
              </div>

              {/* Vorschau */}
              {(editSalePrice || editPrice) && (
                <div className="text-xs rounded-md px-3 py-2" style={{ background: "#F7F8FC", color: "#6B7280" }}>
                  <span className="font-medium" style={{ color: "#14193A" }}>Vorschau im Shop: </span>
                  {editSalePrice ? (
                    <>
                      <span className="font-bold text-green-700">{parseFloat(editSalePrice).toFixed(2)} €</span>
                      {editComparePrice && (
                        <span className="line-through ml-2 text-gray-400">{parseFloat(editComparePrice).toFixed(2)} €</span>
                      )}
                      {editPrice && !editComparePrice && (
                        <span className="line-through ml-2 text-gray-400">{parseFloat(editPrice).toFixed(2)} €</span>
                      )}
                    </>
                  ) : (
                    <span className="font-bold" style={{ color: "#14193A" }}>{editPrice ? parseFloat(editPrice).toFixed(2) + " €" : "—"}</span>
                  )}
                </div>
              )}
            </div>

            <button onClick={() => patch({
              price: editPrice ? parseFloat(editPrice) : null,
              compare_at_price: editComparePrice ? parseFloat(editComparePrice) : null,
              cost_price: editCostPrice ? parseFloat(editCostPrice) : null,
              sale_price: editSalePrice ? parseFloat(editSalePrice) : null,
              sale_from: editSaleFrom ? new Date(editSaleFrom).toISOString() : null,
              sale_until: editSaleUntil ? new Date(editSaleUntil).toISOString() : null,
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

          {/* SEO */}
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">SEO</p>
              {editNoIndex && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-medium">noindex</span>
              )}
            </div>

            {/* Slug */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">URL-Slug</label>
                <button
                  type="button"
                  onClick={() => setEditSlug(editName.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-"))}
                  className="text-[11px] text-blue-500 hover:text-blue-700"
                >
                  Aus Name generieren
                </button>
              </div>
              <div className="flex items-center border border-gray-200 rounded-md overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
                <span className="px-3 py-2 text-xs text-gray-400 bg-gray-50 border-r border-gray-200 whitespace-nowrap">/produkte/</span>
                <input
                  type="text" value={editSlug}
                  onChange={e => setEditSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ""))}
                  placeholder="mein-produkt"
                  className="flex-1 text-sm px-3 py-2 focus:outline-none"
                />
              </div>
            </div>

            {/* Meta Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Meta-Titel</label>
                <span className={`text-[11px] ${editMetaTitle.length > 60 ? "text-red-500" : "text-gray-400"}`}>
                  {editMetaTitle.length}/60
                </span>
              </div>
              <input
                type="text" value={editMetaTitle} onChange={e => setEditMetaTitle(e.target.value)}
                placeholder={editName}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Meta Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-gray-500">Meta-Beschreibung</label>
                <span className={`text-[11px] ${editMetaDesc.length > 160 ? "text-red-500" : "text-gray-400"}`}>
                  {editMetaDesc.length}/160
                </span>
              </div>
              <textarea
                rows={2} value={editMetaDesc} onChange={e => setEditMetaDesc(e.target.value)}
                placeholder="Kurze Beschreibung für Suchmaschinenergebnisse…"
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>

            {/* Google SERP Preview */}
            {(editMetaTitle || editMetaDesc || editSlug) && (
              <div className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-2">Google-Vorschau</p>
                <div className="space-y-0.5">
                  <p className="text-[13px] text-[#1a0dab] leading-snug truncate">
                    {editMetaTitle || editName}
                  </p>
                  <p className="text-[11px] text-[#006621] truncate">
                    example.com › produkte › {editSlug || "produkt"}
                  </p>
                  <p className="text-[12px] text-gray-600 leading-snug line-clamp-2">
                    {editMetaDesc || editDescription || "Keine Beschreibung vorhanden."}
                  </p>
                </div>
              </div>
            )}

            {/* OG Tags (collapsed section) */}
            <details className="group">
              <summary className="text-xs text-gray-500 cursor-pointer list-none flex items-center gap-1 hover:text-gray-700">
                <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
                Open Graph (Social Media)
              </summary>
              <div className="mt-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">OG-Titel</label>
                  <input type="text" value={editOgTitle} onChange={e => setEditOgTitle(e.target.value)}
                    placeholder={editMetaTitle || editName}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">OG-Beschreibung</label>
                  <textarea rows={2} value={editOgDesc} onChange={e => setEditOgDesc(e.target.value)}
                    placeholder={editMetaDesc}
                    className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
                </div>
              </div>
            </details>

            {/* Canonical + noindex */}
            <div className="space-y-3 pt-2 border-t border-gray-100">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Canonical URL <span className="text-gray-300">(optional)</span></label>
                <input type="url" value={editCanonical} onChange={e => setEditCanonical(e.target.value)}
                  placeholder="https://…"
                  className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input type="checkbox" checked={editNoIndex} onChange={e => setEditNoIndex(e.target.checked)} className="rounded" />
                <span>Seite aus Suche ausschließen <span className="text-xs text-gray-400">(noindex)</span></span>
              </label>
            </div>

            <button
              onClick={() => patch({
                slug: editSlug || null,
                meta_title: editMetaTitle || null,
                meta_description: editMetaDesc || null,
                og_title: editOgTitle || null,
                og_description: editOgDesc || null,
                canonical_url: editCanonical || null,
                no_index: editNoIndex,
              }, "seo")}
              disabled={saving === "seo"}
              className="text-sm px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving === "seo" ? "..." : "SEO speichern"}
            </button>
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

          {/* Steuerklasse */}
          {taxClasses.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Steuerklasse</p>
              <select
                value={editTaxClassId ?? ""}
                onChange={async e => {
                  const val = e.target.value || null;
                  setEditTaxClassId(val);
                  await patch({ tax_class_id: val }, "tax");
                }}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">— Keine —</option>
                {taxClasses.map(tc => {
                  const rate = tc.rates?.[0]?.rate;
                  const rateLabel = rate != null ? ` (${(Number(rate) * 100).toFixed(0)}%)` : "";
                  return (
                    <option key={tc.id} value={tc.id}>{tc.name}{rateLabel}</option>
                  );
                })}
              </select>
              {saving === "tax" && <p className="text-xs text-gray-400">Gespeichert…</p>}
            </div>
          )}

          {/* Kategorien */}
          {allCategories.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Kategorien</p>
              <div className="flex flex-wrap gap-1.5">
                {allCategories.map(c => {
                  const active = selectedCategories.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={async () => {
                        const updated = active
                          ? selectedCategories.filter(x => x !== c.id)
                          : [...selectedCategories, c.id];
                        setSelectedCategories(updated);
                        await patch({ category_ids: updated }, "categories");
                      }}
                      className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                      style={{
                        background: active ? "#1B2A5E" : "#FFFFFF",
                        color: active ? "#FFFFFF" : "#6B7280",
                        borderColor: active ? "#1B2A5E" : "#D1D5E8",
                      }}
                    >
                      {c.level > 1 ? "↳ " : ""}{c.name}
                    </button>
                  );
                })}
              </div>
              {saving === "categories" && (
                <p className="text-xs text-gray-400 mt-2">Gespeichert…</p>
              )}
            </div>
          )}

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

          {/* Sync Status */}
          {product.sync_status && (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Storefront-Sync</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    style={{ width: "8px", height: "8px", borderRadius: "50%", display: "inline-block", background: product.sync_status === "synced" ? "#15803D" : product.sync_status === "error" ? "#DC2626" : "#D97706" }}
                  />
                  <span className="text-sm text-gray-700 capitalize">{product.sync_status === "synced" ? "Synchronisiert" : product.sync_status === "error" ? "Sync-Fehler" : "Ausstehend"}</span>
                </div>
                <button
                  onClick={async () => {
                    await fetch(`/api/produkte/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ sync_status: "pending" }),
                    });
                    await load();
                  }}
                  className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
                >
                  ↺ Sync auslösen
                </button>
              </div>
              {product.last_synced_at && (
                <p className="text-xs text-gray-400">
                  Zuletzt: {new Date(product.last_synced_at).toLocaleString("de-DE")}
                </p>
              )}
              {product.wc_product_id && (
                <p className="text-xs text-gray-400 font-mono">WC-ID: {product.wc_product_id}</p>
              )}
            </div>
          )}

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
