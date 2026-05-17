"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";
import EditAuftragModal from "@/components/EditAuftragModal";
import CopyEntityModal from "@/components/CopyEntityModal";

interface Order {
  id: string;
  title: string;
  package_type: string | null;
  value: number | null;
  status: string;
  deadline: string | null;
  venture: string | null;
  created_at: string;
  notes: string | null;
  archived_at: string | null;
  invoice_number: string | null;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    company_name: string | null;
    email: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, string> = {
  neu: "Neu",
  briefing: "Briefing",
  in_bearbeitung: "In Bearbeitung",
  in_produktion: "In Produktion",
  review: "Review",
  abgeschlossen: "Abgeschlossen",
  nachbetreuung: "Nachbetreuung",
  storniert: "Storniert",
  pausiert: "Pausiert",
  angebot_gesendet: "Angebot gesendet",
};

const STATUS_DOT: Record<string, string> = {
  neu: "#3A5BA0",
  briefing: "#C8A96E",
  in_bearbeitung: "#C8A96E",
  in_produktion: "#1B2A5E",
  review: "#7C3AED",
  abgeschlossen: "#16A34A",
  nachbetreuung: "#16A34A",
  storniert: "#DC2626",
  pausiert: "#6B7280",
  angebot_gesendet: "#EA580C",
};

const STATUS_BG: Record<string, string> = {
  neu: "#EEF0F7",
  briefing: "rgba(200,169,110,0.12)",
  in_bearbeitung: "rgba(200,169,110,0.12)",
  in_produktion: "#EEF0F7",
  review: "rgba(124,58,237,0.08)",
  abgeschlossen: "rgba(22,163,74,0.1)",
  nachbetreuung: "rgba(22,163,74,0.1)",
  storniert: "rgba(220,38,38,0.08)",
  pausiert: "#F3F4F6",
  angebot_gesendet: "rgba(234,88,12,0.1)",
};

const STATUS_TEXT: Record<string, string> = {
  neu: "#1B2A5E",
  briefing: "#A07840",
  in_bearbeitung: "#A07840",
  in_produktion: "#14193A",
  review: "#5B21B6",
  abgeschlossen: "#15803D",
  nachbetreuung: "#15803D",
  storniert: "#B91C1C",
  pausiert: "#374151",
  angebot_gesendet: "#C2410C",
};

type Modal =
  | { type: "edit"; id: string }
  | { type: "copy"; id: string; title: string; venture: string }
  | { type: "delete"; id: string; title: string }
  | null;

export default function AuftraegePage() {
  const { venture } = useVenture();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("alle");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus !== "alle") params.set("status", filterStatus);
    params.set("venture", venture);
    if (showArchived) params.set("archived", "true");
    const data = await fetch(`/api/auftraege?${params}`).then((r) => r.json());
    setOrders(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterStatus, venture, showArchived]);

  async function handleArchive(id: string) {
    await fetch(`/api/auftraege/${id}/archive`, { method: "POST" });
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }

  async function handleDelete(id: string) {
    await fetch(`/api/auftraege/${id}`, { method: "DELETE" });
    setOrders((prev) => prev.filter((o) => o.id !== id));
    setModal(null);
  }

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      !q ||
      o.title.toLowerCase().includes(q) ||
      `${o.customer?.first_name ?? ""} ${o.customer?.last_name ?? ""}`.toLowerCase().includes(q) ||
      (o.customer?.company_name ?? "").toLowerCase().includes(q)
    );
  });

  const totalValue = filtered.reduce((sum, o) => sum + (o.value ?? 0), 0);

  const inputStyle: React.CSSProperties = {
    fontSize: "13px",
    border: "1px solid #D1D5E8",
    borderRadius: "8px",
    padding: "7px 12px",
    background: "#FFFFFF",
    color: "#14193A",
    outline: "none",
    fontFamily: "var(--font-sans)",
    width: "260px",
  };

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
      <div className="flex items-start justify-between mb-7">
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
            Aufträge
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#6B7280" }}>
            {filtered.length} Aufträge
            {totalValue > 0 && (
              <span>
                {" "}·{" "}
                <span className="font-semibold" style={{ color: "#14193A" }}>
                  {totalValue.toLocaleString("de-DE")} €
                </span>{" "}
                Gesamtwert
              </span>
            )}
          </p>
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
          style={inputStyle}
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={selectStyle}
        >
          <option value="alle">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
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
          <table className="w-full" style={{ minWidth: '720px' }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EEF0F7", background: "#F7F8FC" }}>
                {["Titel", "Re.-Nr.", "Kunde", "Status", "Paket", "Wert", "Deadline", "Erstellt", "Aktionen"].map((h) => (
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
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  style={{ borderBottom: "1px solid #F7F8FC" }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.background = "#F7F8FC"}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/auftraege/${o.id}`}
                      className="font-medium transition-colors"
                      style={{ color: "#14193A", fontSize: "14px" }}
                      onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = "#1B2A5E"}
                      onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = "#14193A"}
                    >
                      {o.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-mono" style={{ color: o.invoice_number ? "#14193A" : "#D1D5E8" }}>
                    {o.invoice_number ?? "—"}
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "#6B7280" }}>
                    {o.customer ? (
                      <div>
                        <div style={{ color: "#14193A", fontWeight: 500 }}>
                          {o.customer.first_name} {o.customer.last_name}
                        </div>
                        {o.customer.company_name && (
                          <div className="text-xs" style={{ color: "#6B7280" }}>{o.customer.company_name}</div>
                        )}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: STATUS_BG[o.status] ?? "#F3F4F6",
                        color: STATUS_TEXT[o.status] ?? "#374151",
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: STATUS_DOT[o.status] ?? "#6B7280" }}
                      />
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: "#6B7280" }}>{o.package_type ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: "#14193A" }}>
                    {o.value != null ? `${o.value.toLocaleString("de-DE")} €` : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: "#6B7280" }}>
                    {o.deadline ? new Date(o.deadline).toLocaleDateString("de-DE") : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: "#6B7280" }}>
                    {new Date(o.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <ActionBtn onClick={() => setModal({ type: "edit", id: o.id })}>
                        Bearbeiten
                      </ActionBtn>
                      <ActionBtn onClick={() => setModal({ type: "copy", id: o.id, title: o.title, venture: o.venture ?? "online_first" })}>
                        Kopieren
                      </ActionBtn>
                      {!o.archived_at && (
                        <ActionBtn onClick={() => handleArchive(o.id)}>
                          Archiv
                        </ActionBtn>
                      )}
                      <ActionBtn
                        danger
                        onClick={() => setModal({ type: "delete", id: o.id, title: o.title })}
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
                    Keine Aufträge gefunden
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
        <EditAuftragModal
          auftragId={modal.id}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); setTimeout(load, 300); }}
        />
      )}
      {modal?.type === "copy" && (
        <CopyEntityModal
          mode="venture"
          entityId={modal.id}
          entityName={modal.title}
          entityLabel="Auftrag"
          currentVenture={modal.venture}
          endpoint={`/api/auftraege/${modal.id}/copy`}
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
              Auftrag löschen
            </h2>
            <p className="text-sm" style={{ color: "#6B7280" }}>
              <span className="font-semibold" style={{ color: "#14193A" }}>{modal.title}</span> wird unwiderruflich gelöscht.
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
