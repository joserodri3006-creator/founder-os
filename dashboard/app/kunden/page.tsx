"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

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
}

export default function KundenPage() {
  const { venture } = useVenture();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/api/kunden?venture=${venture}`)
      .then((r) => r.json())
      .then((data) => {
        setCustomers(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, [venture]);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      !q ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.company_name ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-7">
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
            Kunden
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>{filtered.length} Kunden</p>
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
          style={{
            fontSize: '13px',
            border: '1px solid #D1D5E8',
            borderRadius: '8px',
            padding: '7px 12px',
            background: '#FFFFFF',
            color: '#14193A',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            width: '260px',
          }}
        />
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
                {["Name", "Unternehmen", "E-Mail", "Telefon", "Stadt", "Venture", "Erstellt", "Aufträge"].map(h => (
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
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: '1px solid #F7F8FC' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F8FC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-4 py-3.5 font-medium" style={{ color: '#14193A', fontSize: '14px' }}>
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: '#6B7280' }}>{c.company_name ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: '#6B7280' }}>
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        className="transition-colors"
                        style={{ color: '#3A5BA0' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1B2A5E'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3A5BA0'}
                      >
                        {c.email}
                      </a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: '#6B7280' }}>{c.phone ?? "—"}</td>
                  <td className="px-4 py-3.5 text-sm" style={{ color: '#6B7280' }}>{c.city ?? "—"}</td>
                  <td className="px-4 py-3.5">
                    {c.venture ? (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full capitalize"
                        style={{ background: '#EEF0F7', color: '#1B2A5E' }}
                      >
                        {c.venture}
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: '#6B7280' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-xs" style={{ color: '#6B7280' }}>
                    {new Date(c.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/auftraege?customer=${c.id}`}
                      className="text-xs font-semibold transition-colors"
                      style={{ color: '#3A5BA0' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1B2A5E'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#3A5BA0'}
                    >
                      Aufträge →
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                    Keine Kunden gefunden
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
