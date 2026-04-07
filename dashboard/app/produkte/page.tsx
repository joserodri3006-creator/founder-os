"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";
import { getVenture } from "@/lib/ventures";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  compare_at_price: number | null;
  status: string;
  is_featured: boolean;
  images: { url: string; alt: string }[];
  product_type: { id: string; name: string; has_variants: boolean; has_inventory: boolean } | null;
  brand: { id: string; name: string } | null;
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  archived: "Archiviert",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  active: "bg-green-100 text-green-700",
  archived: "bg-red-100 text-red-600",
};

export default function ProdukteListPage() {
  const { venture } = useVenture();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ venture });
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const data = await fetch(`/api/produkte?${params}`).then(r => r.json());
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture, statusFilter]);

  const meta = getVenture(venture);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Produkte</h1>
          {meta && <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${meta.color}`}>{meta.label}</span>}
        </div>
        <Link href="/produkte/neu"
          className="text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
          + Neues Produkt
        </Link>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Suche..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === "Enter" && load()}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none">
          <option value="">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="draft">Entwurf</option>
          <option value="archived">Archiviert</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto">{products.length} Produkte</span>
      </div>

      {/* Tabelle */}
      {loading ? (
        <div className="text-sm text-gray-400 py-12 text-center">Laden...</div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-16 text-center">
          <p className="text-sm text-gray-400 mb-3">Noch keine Produkte</p>
          <Link href="/produkte/neu" className="text-sm text-blue-600 hover:underline">
            Erstes Produkt anlegen →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Produkt</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Typ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">SKU</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Preis</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/produkte/${p.id}`} className="flex items-center gap-3 group">
                      {p.images?.[0] ? (
                        <img src={p.images[0].url} alt={p.images[0].alt}
                          className="w-10 h-10 rounded object-cover bg-gray-100 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-gray-100 shrink-0 flex items-center justify-center text-gray-300 text-lg">□</div>
                      )}
                      <div>
                        <p className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">{p.name}</p>
                        {p.brand && <p className="text-xs text-gray-400">{p.brand.name}</p>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.product_type?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                    {p.sku ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.price != null ? (
                      <div>
                        <span className="font-medium text-gray-800">{p.price.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
                        {p.compare_at_price != null && (
                          <span className="text-xs text-gray-400 line-through ml-2">
                            {p.compare_at_price.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                          </span>
                        )}
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
