"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";
import EditKundeModal from "@/components/EditKundeModal";
import CopyEntityModal from "@/components/CopyEntityModal";

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  venture: string | null;
  created_at: string;
  archived_at: string | null;
}

type Modal =
  | { type: "edit"; id: string }
  | { type: "copy"; id: string; name: string; venture: string }
  | { type: "delete"; id: string; name: string }
  | null;

export default function KundenPage() {
  const { venture } = useVenture();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("venture", venture);
    if (showArchived) params.set("archived", "true");
    const data = await fetch(`/api/kunden?${params}`).then((r) => r.json());
    setCustomers(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture, showArchived]);

  async function handleArchive(id: string) {
    await fetch(`/api/kunden/${id}/archive`, { method: "POST" });
    setCustomers((prev) => prev.filter((c) => c.id !== id));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/kunden/${id}`, { method: "DELETE" });
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setModal(null);
  }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.company_name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const selectStyle: React.CSSProperties = {
    fontSize: "13px",
    border: "1px solid #D1D5E8",
    borderRadius: "8px",
    padding: "7px 12px",
    background: "#FFFFFF",
    color: "#14193A",
    outline: "none",
    fontFamily: "var(--font-sans)",
  };

  return (
    <div className="px-4 py-5 sm:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-7">
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
            Kunden
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>{filtered.length} Kunden</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="flex gap-2.5 mb-5 items-center flex-wrap p-3 rounded-xl"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D1D5E8",
          boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        }}
      >
        <input
          type="text"
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...selectStyle, width: "260px" }}
        />
        <button
          onClick={() => setShowArchived((v) => !v)}
          className="text-sm px-3 py-1.5 rounded-lg transition-colors font-medium"
          style={{
            border: showArchived ? "1.5px solid #1B2A5E" : "1px solid #D1D5E8",
            background: showArchived ? "#EEF0F7" : "transparent",
            color: showArchived ? "#1B2A5E" : "#6B7280",
            cursor: "pointer",
          }}
        >
          {showArchived ? "← Aktive" : "Archiv"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8" style={{ color: "#6B7280" }}>
          <div
            className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }}
          />
          <span className="text-sm">Laden...</span>
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
          <table className="w-full" style={{ minWidth: '680px' }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EEF0F7", background: "#F7F8FC" }}>
                {["Name", "Unternehmen", "E-Mail", "Telefon", "Stadt", "Venture", "Erstellt", "Aktionen"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-semibold uppercase"
                    style={{ fontSize: "11px", letterSpacing: "0.07em", color: "#6B7280" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: "1px solid #F7F8FC" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F7F8FC"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <td className="px-4 py-3.5 font-medium" style={{ color: "#14193A", fontSize: "14px" }}>
                    <Link
                      href={`/kunden/${c.id}`}
                      style={{ color: "#14193A", textDecoration: "none" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "#1B2A5E"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "#14193A"}
                    >
                      {c.first_name} {c.last_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "#6B7280" }}>{c.company_name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "#6B7280" }}>
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        style={{ color: "#3A5BA0" }}
                        onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "#1B2A5E"}
                        onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "#3A5BA0"}
                      >
                        {c.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "#6B7280" }}>{c.phone ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "#6B7280" }}>{c.city ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    {c.venture ? (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                        style={{ background: "#EEF0F7", color: "#1B2A5E" }}
                      >
                        {c.venture}
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: "#6B7280" }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: "#6B7280" }}>
                    {new Date(c.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <ActionBtn onClick={() => setModal({ type: "edit", id: c.id })}>
                        Bearbeiten
                      </ActionBtn>
                      <ActionBtn onClick={() => setModal({ type: "copy", id: c.id, name: `${c.first_name} ${c.last_name}`.trim() || c.company_name || c.id, venture: c.venture ?? "online_first" })}>
                        Kopieren
                      </ActionBtn>
                      {!c.archived_at && (
                        <ActionBtn onClick={() => handleArchive(c.id)}>
                          Archiv
                        </ActionBtn>
                      )}
                      <ActionBtn
                        danger
                        onClick={() => setModal({ type: "delete", id: c.id, name: `${c.first_name} ${c.last_name}`.trim() || c.company_name || "Kunde" })}
                      >
                        Löschen
                      </ActionBtn>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: "#6B7280" }}>
                    Keine Kunden gefunden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === "edit" && (
        <EditKundeModal
          kundeId={modal.id}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setTimeout(load, 300); }}
        />
      )}
      {modal?.type === "copy" && (
        <CopyEntityModal
          mode="venture"
          entityId={modal.id}
          entityName={modal.name}
          entityLabel="Kunde"
          currentVenture={modal.venture}
          endpoint={`/api/kunden/${modal.id}/copy`}
          onClose={() => setModal(null)}
          onCopied={() => setTimeout(load, 300)}
        />
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
              Kunde löschen
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
