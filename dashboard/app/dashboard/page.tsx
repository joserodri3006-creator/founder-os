"use client";

import { useEffect, useState } from "react";
import { Lead, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { VENTURES, getVenture } from "@/lib/ventures";
import { useVenture } from "@/context/VentureContext";
import Link from "next/link";

interface VentureKpi {
  venture: string;
  leadsWeek: number;
  openDrafts: number;
  activeOrders: number;
  newCustomers: number;
}

interface DashboardData {
  ventureKpis: VentureKpi[];
  followUpsFaellig: number;
  recentLeads: Lead[];
}

export default function DashboardPage() {
  const { setVenture } = useVenture();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="p-8 text-gray-400 text-sm">Laden...</div>;
  if (!data) return null;

  const { ventureKpis, followUpsFaellig, recentLeads } = data;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold">Founder Dashboard</h1>
        {followUpsFaellig > 0 && (
          <Link href="/leads" className="text-sm text-orange-600 font-medium bg-orange-50 px-3 py-1.5 rounded-md hover:bg-orange-100 transition-colors">
            {followUpsFaellig} Follow-up{followUpsFaellig !== 1 ? "s" : ""} fällig →
          </Link>
        )}
      </div>

      {/* Venture KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
        {ventureKpis.map((kpi) => {
          const meta = getVenture(kpi.venture);
          return (
            <button
              key={kpi.venture}
              onClick={() => setVenture(kpi.venture as (typeof VENTURES)[number]["id"])}
              className="bg-white rounded-lg border border-gray-200 p-4 text-left hover:border-blue-300 hover:shadow-sm transition-all group"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta?.color ?? "bg-gray-100 text-gray-600"}`}>
                  {meta?.label ?? kpi.venture}
                </span>
                <span className="text-xs text-gray-300 group-hover:text-blue-400 transition-colors">→</span>
              </div>

              {/* KPIs */}
              <div className="space-y-2">
                <KpiRow label="Leads (7 Tage)" value={kpi.leadsWeek} highlight={kpi.leadsWeek > 0} />
                <KpiRow label="Offene Drafts" value={kpi.openDrafts} highlight={kpi.openDrafts > 0} color="orange" />
                <KpiRow label="Aktive Aufträge" value={kpi.activeOrders} />
                <KpiRow label="Neue Kunden (Monat)" value={kpi.newCustomers} highlight={kpi.newCustomers > 0} color="green" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Neueste Leads */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-medium">Neueste Leads</h2>
          <Link href="/leads" className="text-xs text-blue-600 hover:underline">Alle anzeigen</Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left font-medium">Name</th>
              <th className="px-5 py-3 text-left font-medium">Unternehmen</th>
              <th className="px-5 py-3 text-left font-medium">Venture</th>
              <th className="px-5 py-3 text-left font-medium">Status</th>
              <th className="px-5 py-3 text-left font-medium">Quelle</th>
              <th className="px-5 py-3 text-left font-medium">Erstellt</th>
            </tr>
          </thead>
          <tbody>
            {recentLeads.map((lead) => {
              const meta = getVenture((lead as any).venture);
              return (
                <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/leads/${lead.id}`} className="hover:text-blue-600 hover:underline">
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{lead.company_name ?? "—"}</td>
                  <td className="px-5 py-3">
                    {meta && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[lead.status]}`}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-500 capitalize">{lead.source}</td>
                  <td className="px-5 py-3 text-gray-400">{new Date(lead.created_at).toLocaleDateString("de-DE")}</td>
                </tr>
              );
            })}
            {recentLeads.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">Noch keine Leads</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiRow({ label, value, highlight, color = "blue" }: {
  label: string;
  value: number;
  highlight?: boolean;
  color?: "blue" | "orange" | "green";
}) {
  const colorMap = { blue: "text-blue-700", orange: "text-orange-600", green: "text-green-700" };
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? colorMap[color] : "text-gray-700"}`}>
        {value}
      </span>
    </div>
  );
}
