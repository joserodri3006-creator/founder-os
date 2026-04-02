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

const STATUS_COLORS: Record<string, string> = {
  neu: "bg-blue-100 text-blue-700",
  in_bearbeitung: "bg-yellow-100 text-yellow-700",
  review: "bg-purple-100 text-purple-700",
  abgeschlossen: "bg-green-100 text-green-700",
  storniert: "bg-red-100 text-red-700",
  pausiert: "bg-gray-100 text-gray-600",
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

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold">Aufträge</h1>
          {totalValue > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              Gesamtwert: <span className="font-medium text-gray-700">{totalValue.toLocaleString("de-DE")} €</span>
            </p>
          )}
        </div>
        <span className="text-sm text-gray-400">{filtered.length} Aufträge</span>
      </div>

      <div className="flex gap-3 mb-5">
        <input
          type="text"
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white w-64 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white"
        >
          <option value="alle">Alle Status</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Laden...</div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-medium">Titel</th>
                <th className="px-4 py-3 text-left font-medium">Kunde</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Paket</th>
                <th className="px-4 py-3 text-left font-medium">Wert</th>
                <th className="px-4 py-3 text-left font-medium">Deadline</th>
                <th className="px-4 py-3 text-left font-medium">Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/auftraege/${o.id}`} className="font-medium hover:text-blue-600 hover:underline">
                      {o.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.customer ? (
                      <div>
                        <div>{o.customer.first_name} {o.customer.last_name}</div>
                        {o.customer.company_name && (
                          <div className="text-xs text-gray-400">{o.customer.company_name}</div>
                        )}
                      </div>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {STATUS_LABELS[o.status] ?? o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{o.package_type ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {o.value != null ? `${o.value.toLocaleString("de-DE")} €` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {o.deadline ? new Date(o.deadline).toLocaleDateString("de-DE") : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {new Date(o.created_at).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
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
