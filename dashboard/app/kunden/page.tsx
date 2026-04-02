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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Kunden</h1>
        <span className="text-sm text-gray-400">{filtered.length} Kunden</span>
      </div>

      <div className="mb-5">
        <input
          type="text"
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Laden...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Unternehmen</th>
                <th className="px-4 py-3 text-left font-medium">E-Mail</th>
                <th className="px-4 py-3 text-left font-medium">Telefon</th>
                <th className="px-4 py-3 text-left font-medium">Stadt</th>
                <th className="px-4 py-3 text-left font-medium">Venture</th>
                <th className="px-4 py-3 text-left font-medium">Erstellt</th>
                <th className="px-4 py-3 text-left font-medium">Aufträge</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {c.first_name} {c.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.company_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} className="hover:text-blue-600">{c.email}</a>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{c.city ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{c.venture ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(c.created_at).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/auftraege?customer=${c.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Aufträge →
                    </Link>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
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
