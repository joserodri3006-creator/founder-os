"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useVenture } from "@/context/VentureContext";
import { getVenture } from "@/lib/ventures";
import CopyEntityModal from "@/components/CopyEntityModal";

interface Product {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  compare_at_price: number | null;
  status: string;
  sync_status: string | null;
  is_featured: boolean;
  images: { url: string; alt: string }[];
  product_type: { id: string; name: string; has_variants: boolean; has_inventory: boolean } | null;
  brand: { id: string; name: string } | null;
}

const SYNC_DOT: Record<string, { color: string; title: string }> = {
  synced: { color: "#15803D", title: "Synchronisiert" },
  pending: { color: "#D97706", title: "Sync ausstehend" },
  error: { color: "#DC2626", title: "Sync-Fehler" },
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  active: "Aktiv",
  archived: "Archiviert",
};

const STATUS_BG: Record<string, string> = {
  draft: "#F3F4F6",
  active: "rgba(22,163,74,0.1)",
  archived: "rgba(220,38,38,0.08)",
};

const STATUS_TEXT: Record<string, string> = {
  draft: "#374151",
  active: "#15803D",
  archived: "#B91C1C",
};

type Modal =
  | { type: "copy"; id: string; name: string }
  | { type: "archive"; id: string; name: string }
  | { type: "delete"; id: string; name: string }
  | null;

export default function ProdukteListPage() {
  const { venture } = useVenture();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<Modal>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ venture });
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const data = await fetch(`/api/produkte?${params}`).then((r) => r.json());
    setProducts(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture, statusFilter]);

  async function handleArchive(id: string) {
    await fetch(`/api/produkte/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setProducts((prev) => prev.map((p) => p.id === id ? { ...p, status: "archived" } : p));
    setModal(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/produkte/${id}`, { method: "DELETE" });
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setModal(null);
  }

  const meta = getVenture(venture);

  return (
    <div className="px-4 py-5 sm:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div
        className="flex items-center justify-between mb-7"
      >
        <div>
          <h1
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 300,
              fontSize: "28px",
              color: "#14193A",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            Produkte
          </h1>
          {meta && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${meta.color}`}>
              {meta.label}
            </span>
          )}
        </div>
        <Link
          href="/produkte/neu"
          className="text-sm px-4 py-2 rounded-lg font-semibold transition-colors"
          style={{ background: "#1B2A5E", color: "#FFFFFF", border: "none" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#243672"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#1B2A5E"}
        >
          + Neues Produkt
        </Link>
      </div>

      {/* Filter */}
      <div
        className="flex items-center gap-2.5 mb-5 p-3 rounded-xl flex-wrap"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D1D5E8",
          boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        }}
      >
        <input
          type="text"
          placeholder="Suche..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && load()}
          style={{
            fontSize: "13px",
            border: "1px solid #D1D5E8",
            borderRadius: "8px",
            padding: "7px 12px",
            background: "#FFFFFF",
            color: "#14193A",
            outline: "none",
            fontFamily: "var(--font-sans)",
            width: "260px",
          }}
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            fontSize: "13px",
            border: "1px solid #D1D5E8",
            borderRadius: "8px",
            padding: "7px 12px",
            background: "#FFFFFF",
            color: "#14193A",
            outline: "none",
            fontFamily: "var(--font-sans)",
          }}
        >
          <option value="">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="draft">Entwurf</option>
          <option value="archived">Archiviert</option>
        </select>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/produkte/sync-log" className="text-xs text-gray-500 hover:text-[#1B2A5E] flex items-center gap-1">
            🔄 Sync-Log
          </Link>
          <span className="text-xs" style={{ color: "#6B7280" }}>{products.length} Produkte</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8" style={{ color: "#6B7280" }}>
          <div
            className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }}
          />
          <span className="text-sm">Laden...</span>
        </div>
      ) : products.length === 0 ? (
        <div
          className="rounded-2xl py-16 text-center"
          style={{ background: "#FFFFFF", border: "1px solid #D1D5E8" }}
        >
          <p className="text-sm mb-3" style={{ color: "#6B7280" }}>Noch keine Produkte</p>
          <Link href="/produkte/neu" className="text-sm" style={{ color: "#1B2A5E" }}>
            Erstes Produkt anlegen →
          </Link>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#FFFFFF",
            border: "1px solid #D1D5E8",
            boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
          }}
        >
          <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: '580px' }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EEF0F7", background: "#F7F8FC" }}>
                {["Produkt", "Typ", "SKU", "Preis", "Status", "Aktionen"].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 font-semibold uppercase ${h === "Preis" ? "text-right" : h === "Status" ? "text-center" : "text-left"}`}
                    style={{ fontSize: "11px", letterSpacing: "0.07em", color: "#6B7280" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr
                  key={p.id}
                  style={{ borderBottom: "1px solid #F7F8FC" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F7F8FC"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <td className="px-4 py-3">
                    <Link href={`/produkte/${p.id}`} className="flex items-center gap-3 group">
                      {p.images?.[0] ? (
                        <img
                          src={p.images[0].url}
                          alt={p.images[0].alt}
                          className="w-10 h-10 rounded object-cover shrink-0"
                          style={{ background: "#F7F8FC" }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded shrink-0 flex items-center justify-center text-xl"
                          style={{ background: "#EEF0F7", color: "#D1D5E8" }}
                        >
                          □
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p
                            className="font-medium"
                            style={{ color: "#14193A" }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "#1B2A5E"}
                            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "#14193A"}
                          >
                            {p.name}
                          </p>
                          {p.sync_status && SYNC_DOT[p.sync_status] && (
                            <span
                              title={SYNC_DOT[p.sync_status].title}
                              style={{ width: "6px", height: "6px", borderRadius: "50%", background: SYNC_DOT[p.sync_status].color, display: "inline-block", flexShrink: 0 }}
                            />
                          )}
                        </div>
                        {p.brand && <p className="text-xs" style={{ color: "#6B7280" }}>{p.brand.name}</p>}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3" style={{ color: "#6B7280", fontSize: "13px" }}>
                    {p.product_type?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs" style={{ color: "#6B7280" }}>
                    {p.sku ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.price != null ? (
                      <div>
                        <span className="font-semibold" style={{ color: "#14193A" }}>
                          {p.price.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                        </span>
                        {p.compare_at_price != null && (
                          <span className="text-xs line-through ml-2" style={{ color: "#6B7280" }}>
                            {p.compare_at_price.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
                          </span>
                        )}
                      </div>
                    ) : <span style={{ color: "#6B7280" }}>—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-semibold"
                      style={{
                        background: STATUS_BG[p.status] ?? "#F3F4F6",
                        color: STATUS_TEXT[p.status] ?? "#374151",
                      }}
                    >
                      {STATUS_LABELS[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <ActionBtn onClick={() => router.push(`/produkte/${p.id}`)}>
                        Bearbeiten
                      </ActionBtn>
                      <ActionBtn onClick={() => setModal({ type: "copy", id: p.id, name: p.name })}>
                        Kopieren
                      </ActionBtn>
                      {p.status !== "archived" && (
                        <ActionBtn onClick={() => setModal({ type: "archive", id: p.id, name: p.name })}>
                          Archiv
                        </ActionBtn>
                      )}
                      <ActionBtn
                        danger
                        onClick={() => setModal({ type: "delete", id: p.id, name: p.name })}
                      >
                        Löschen
                      </ActionBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "copy" && (
        <CopyEntityModal
          mode="produkt"
          entityId={modal.id}
          entityName={modal.name}
          onClose={() => setModal(null)}
          onCopied={(newId) => { setModal(null); router.push(`/produkte/${newId}`); }}
        />
      )}
      {modal?.type === "archive" && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(20,25,58,0.5)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-sm p-6 space-y-4 rounded-2xl"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 20px 56px rgba(27,42,94,0.24)",
              border: "1px solid #D1D5E8",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "20px", color: "#14193A" }}>
              Produkt archivieren
            </h2>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              <span className="font-semibold" style={{ color: "#14193A" }}>{modal.name}</span> wird archiviert und ist nicht mehr aktiv.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => handleArchive(modal.id)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                style={{ background: "#1B2A5E", color: "#FFFFFF", border: "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#243672"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#1B2A5E"}
              >
                Archivieren
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg"
                style={{ background: "transparent", color: "#14193A", border: "1.5px solid #D1D5E8", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#EEF0F7"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
      {modal?.type === "delete" && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: "rgba(20,25,58,0.5)", backdropFilter: "blur(4px)" }}
        >
          <div
            className="w-full max-w-sm p-6 space-y-4 rounded-2xl"
            style={{
              background: "#FFFFFF",
              boxShadow: "0 20px 56px rgba(27,42,94,0.24)",
              border: "1px solid #D1D5E8",
            }}
          >
            <h2 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "20px", color: "#14193A" }}>
              Produkt löschen
            </h2>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              <span className="font-semibold" style={{ color: "#14193A" }}>{modal.name}</span> wird unwiderruflich gelöscht.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => handleDelete(modal.id)}
                className="flex-1 py-2.5 text-sm font-semibold rounded-lg"
                style={{ background: "#DC2626", color: "#FFFFFF", border: "none", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#B91C1C"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#DC2626"}
              >
                Löschen
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 text-sm font-medium rounded-lg"
                style={{ background: "transparent", color: "#14193A", border: "1.5px solid #D1D5E8", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#EEF0F7"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, children, danger }: {
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded-md transition-colors font-medium"
      style={{ color: danger ? "#B91C1C" : "#6B7280", background: "transparent", border: "none", cursor: "pointer" }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = danger ? "rgba(220,38,38,0.08)" : "#EEF0F7";
        (e.currentTarget as HTMLElement).style.color = danger ? "#B91C1C" : "#14193A";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = danger ? "#B91C1C" : "#6B7280";
      }}
    >
      {children}
    </button>
  );
}
