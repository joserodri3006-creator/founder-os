"use client";

import { useEffect, useState } from "react";
import { Lead, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { getVenture } from "@/lib/ventures";
import { useVenture } from "@/context/VentureContext";
import Link from "next/link";

interface Kpi {
  leadsWeek: number;
  openDrafts: number;
  activeOrders: number;
  newCustomers: number;
}

interface DashboardData {
  kpi: Kpi;
  followUpsFaellig: number;
  recentLeads: Lead[];
}

const DAYS   = ["Sonntag","Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag"];
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

function getDateString() {
  const d = new Date();
  return `${DAYS[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function DashboardPage() {
  const { venture } = useVenture();
  const [data, setData]     = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!venture) return;
    setLoading(true);
    setData(null);
    fetch(`/api/dashboard?venture=${venture}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, [venture]);

  const meta = getVenture(venture ?? "");

  if (loading) return (
    <div className="p-8 flex items-center gap-2" style={{ color: "#6B7280" }}>
      <div
        className="w-4 h-4 rounded-full border-2 animate-spin"
        style={{ borderColor: "#D1D5E8", borderTopColor: "#1B2A5E" }}
      />
      <span className="text-sm">Laden…</span>
    </div>
  );
  if (!data) return null;

  const { kpi, followUpsFaellig, recentLeads } = data;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-8 flex-wrap">
        <div>
          <h1
            className="mb-1"
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 300,
              fontSize: "30px",
              color: "#14193A",
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
            }}
          >
            {getGreeting()}, Jose
          </h1>
          <p className="text-sm" style={{ color: "#6B7280" }}>{getDateString()}</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Aktives Venture Badge */}
          {meta && (
            <span
              className="text-sm font-semibold px-3 py-1.5 rounded-full"
              style={{ background: "#EEF0F7", color: "#1B2A5E" }}
            >
              {meta.label} · {meta.phase}
            </span>
          )}

          {/* Follow-ups */}
          {followUpsFaellig > 0 && (
            <Link
              href="/leads"
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{
                background: "rgba(200,169,110,0.12)",
                color: "#C8A96E",
                border: "1px solid rgba(200,169,110,0.3)",
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: "#C8A96E" }} />
              {followUpsFaellig} Follow-up{followUpsFaellig !== 1 ? "s" : ""} fällig
            </Link>
          )}
        </div>
      </div>

      {/* KPI Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <KpiCard
          label="Leads (7 Tage)"
          value={kpi.leadsWeek}
          icon="👤"
          highlight={kpi.leadsWeek > 0}
          color="blue"
          href="/leads"
        />
        <KpiCard
          label="Offene Drafts"
          value={kpi.openDrafts}
          icon="✉️"
          highlight={kpi.openDrafts > 0}
          color="gold"
          href="/drafts"
        />
        <KpiCard
          label="Aktive Aufträge"
          value={kpi.activeOrders}
          icon="📋"
          highlight={kpi.activeOrders > 0}
          color="blue"
          href="/auftraege"
        />
        <KpiCard
          label="Neue Kunden (Monat)"
          value={kpi.newCustomers}
          icon="🏢"
          highlight={kpi.newCustomers > 0}
          color="green"
          href="/kunden"
        />
      </div>

      {/* Neueste Leads */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "#FFFFFF",
          border: "1px solid #D1D5E8",
          boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        }}
      >
        <div
          className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid #EEF0F7" }}
        >
          <h2
            style={{
              fontFamily: "var(--font-serif)",
              fontWeight: 400,
              fontSize: "18px",
              color: "#14193A",
              letterSpacing: "-0.01em",
            }}
          >
            Neueste Leads
          </h2>
          <Link
            href="/leads"
            className="text-sm font-medium transition-colors"
            style={{ color: "#3A5BA0" }}
          >
            Alle anzeigen →
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full" style={{ minWidth: "480px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #EEF0F7", background: "#F7F8FC" }}>
                {["Name", "Unternehmen", "Status", "Quelle", "Erstellt"].map((h) => (
                  <th
                    key={h}
                    className="px-4 sm:px-6 py-3 text-left font-semibold uppercase"
                    style={{ fontSize: "11px", letterSpacing: "0.07em", color: "#6B7280" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => (
                <tr
                  key={lead.id}
                  style={{ borderBottom: "1px solid #F7F8FC" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "#F7F8FC")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
                >
                  <td className="px-6 py-3.5">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium transition-colors"
                      style={{ color: "#14193A", fontSize: "14px" }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "#1B2A5E")}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "#14193A")}
                    >
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-sm" style={{ color: "#6B7280" }}>
                    {lead.company_name ?? "—"}
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={lead.status} label={STATUS_LABELS[lead.status]} />
                  </td>
                  <td className="px-6 py-3.5 text-sm capitalize" style={{ color: "#6B7280" }}>
                    {lead.source}
                  </td>
                  <td className="px-6 py-3.5 text-xs" style={{ color: "#6B7280" }}>
                    {new Date(lead.created_at).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              ))}
              {recentLeads.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-sm"
                    style={{ color: "#6B7280" }}
                  >
                    Noch keine Leads für dieses Venture
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── KPI Kachel ──────────────────────────────────────────────────────────── */
function KpiCard({
  label, value, icon, highlight, color, href,
}: {
  label: string;
  value: number;
  icon: string;
  highlight?: boolean;
  color: "blue" | "gold" | "green";
  href: string;
}) {
  const colorMap = { blue: "#1B2A5E", gold: "#C8A96E", green: "#16A34A" };
  return (
    <Link
      href={href}
      className="block rounded-2xl transition-all"
      style={{
        background: "#FFFFFF",
        border: "1px solid #D1D5E8",
        boxShadow: "0 2px 12px rgba(27,42,94,0.08)",
        overflow: "hidden",
        textDecoration: "none",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 32px rgba(27,42,94,0.16)";
        (e.currentTarget as HTMLElement).style.borderColor = "#3A5BA0";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 12px rgba(27,42,94,0.08)";
        (e.currentTarget as HTMLElement).style.borderColor = "#D1D5E8";
      }}
    >
      <div style={{ height: "3px", background: "linear-gradient(90deg, #C8A96E, #D4B97E)" }} />
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <span style={{ fontSize: "22px" }}>{icon}</span>
          <span
            className="text-2xl font-bold tabular-nums"
            style={{ color: highlight ? colorMap[color] : "#14193A" }}
          >
            {value}
          </span>
        </div>
        <p className="text-xs font-medium" style={{ color: "#6B7280" }}>{label}</p>
      </div>
    </Link>
  );
}

/* ── Status Badge ────────────────────────────────────────────────────────── */
function StatusBadge({ status, label }: { status: string; label: string }) {
  const dotColors: Record<string, string> = {
    neu: "#3A5BA0", kontaktiert: "#C8A96E", qualifiziert: "#1B2A5E",
    angebot: "#7C3AED", gewonnen: "#16A34A", verloren: "#DC2626", follow_up: "#EA580C",
  };
  const bgColors: Record<string, string> = {
    neu: "#EEF0F7", kontaktiert: "rgba(200,169,110,0.12)", qualifiziert: "#EEF0F7",
    angebot: "rgba(124,58,237,0.08)", gewonnen: "rgba(22,163,74,0.1)",
    verloren: "rgba(220,38,38,0.08)", follow_up: "rgba(234,88,12,0.1)",
  };
  const textColors: Record<string, string> = {
    neu: "#1B2A5E", kontaktiert: "#A07840", qualifiziert: "#14193A",
    angebot: "#5B21B6", gewonnen: "#15803D", verloren: "#B91C1C", follow_up: "#C2410C",
  };
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: bgColors[status] ?? "#F3F4F6", color: textColors[status] ?? "#374151" }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: dotColors[status] ?? "#6B7280" }}
      />
      {label}
    </span>
  );
}
