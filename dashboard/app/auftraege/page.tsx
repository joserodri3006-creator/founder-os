"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

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
  in_bearbeitung: "In Bearbeitung",
  review: "Review",
  abgeschlossen: "Abgeschlossen",
  storniert: "Storniert",
  pausiert: "Pausiert",
};

const STATUS_DOT: Record<string, string> = {
  neu: '#3A5BA0',
  in_bearbeitung: '#C8A96E',
  review: '#7C3AED',
  abgeschlossen: '#16A34A',
  storniert: '#DC2626',
  pausiert: '#6B7280',
};

const STATUS_BG: Record<string, string> = {
  neu: '#EEF0F7',
  in_bearbeitung: 'rgba(200,169,110,0.12)',
  review: 'rgba(124,58,237,0.08)',
  abgeschlossen: 'rgba(22,163,74,0.1)',
  storniert: 'rgba(220,38,38,0.08)',
  pausiert: '#F3F4F6',
};

const STATUS_TEXT: Record<string, string> = {
  neu: '#1B2A5E',
  in_bearbeitung: '#A07840',
  review: '#5B21B6',
  abgeschlossen: '#15803D',
  storniert: '#B91C1C',
  pausiert: '#374151',
};

export default function AuftraegePage() {
  const { venture } = useVenture();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("alle");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (filterStatus !== "alle") params.set("status", filterStatus);
    params.set("venture", venture);
    fetch(`/api/auftraege?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setOrders(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [filterStatus, venture]);

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
    fontSize: '13px',
    border: '1px solid #D1D5E8',
    borderRadius: '8px',
    padding: '7px 12px',
    background: '#FFFFFF',
    color: '#14193A',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
    width: '260px',
  };

  const selectStyle: React.CSSProperties = {
    fontSize: '13px',
    border: '1px solid #D1D5E8',
    borderRadius: '8px',
    padding: '7px 12px',
    background: '#FFFFFF',
    color: '#14193A',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 300,
              fontSize: '28px',
              color: '#14193A',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Aufträge
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            {filtered.length} Aufträge
            {totalValue > 0 && (
              <span>
                {" "}·{" "}
                <span className="font-semibold" style={{ color: '#14193A' }}>
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
        className="flex gap-2.5 mb-5 items-center p-3 rounded-xl"
        style={{
          background: '#FFFFFF',
          border: '1px solid #D1D5E8',
          boxShadow: '0 2px 12px rgba(27,42,94,0.08)',
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
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8" style={{ color: '#6B7280' }}>
          <div
            className="w-4 h-4 rounded-full border-2 animate-spin"
            style={{ borderColor: '#D1D5E8', borderTopColor: '#1B2A5E' }}
          />
          <span className="text-sm">Laden...</span>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: '#FFFFFF',
            border: '1px solid #D1D5E8',
            boxShadow: '0 2px 12px rgba(27,42,94,0.08)',
          }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #EEF0F7', background: '#F7F8FC' }}>
                {["Titel", "Kunde", "Status", "Paket", "Wert", "Deadline", "Erstellt"].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-semibold uppercase"
                    style={{ fontSize: '11px', letterSpacing: '0.07em', color: '#6B7280' }}
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
                  style={{ borderBottom: '1px solid #F7F8FC' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F8FC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/auftraege/${o.id}`}
                      className="font-medium transition-colors"
                      style={{ color: '#14193A', fontSize: '14px' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1B2A5E'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#14193A'}
                    >
                      {o.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: '#6B7280' }}>
                    {o.customer ? (
                      <div>
                        <div style={{ color: '#14193A', fontWeight: 500 }}>
                          {o.customer.first_name} {o.customer.last_name}
                        </div>
                        {o.customer.company_name && (
                          <div className="text-xs" style={{ color: '#6B7280' }}>{o.customer.company_name}</div>
                        )}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{
                        background: STATUS_BG[o.status] ?? '#F3F4F6',
                        color: STATUS_TEXT[o.status] ?? '#374151',
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: STATUS_DOT[o.status] ?? '#6B7280' }}
                      />
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: '#6B7280' }}>{o.package_type ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm font-semibold" style={{ color: '#14193A' }}>
                    {o.value != null ? `${o.value.toLocaleString("de-DE")} €` : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: '#6B7280' }}>
                    {o.deadline ? new Date(o.deadline).toLocaleDateString("de-DE") : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: '#6B7280' }}>
                    {new Date(o.created_at).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                    Keine Aufträge gefunden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
