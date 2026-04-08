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

const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

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
  const { setVenture } = useVenture();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="p-8 flex items-center gap-2" style={{ color: '#6B7280' }}>
      <div
        className="w-4 h-4 rounded-full border-2 animate-spin"
        style={{ borderColor: '#D1D5E8', borderTopColor: '#1B2A5E' }}
      />
      <span className="text-sm">Laden...</span>
    </div>
  );
  if (!data) return null;

  const { ventureKpis, followUpsFaellig, recentLeads } = data;

  return (
    <div className="px-4 py-5 sm:p-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-3 mb-8 flex-wrap">
        <div>
          <h1
            className="mb-1"
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 300,
              fontSize: '30px',
              color: '#14193A',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            {getGreeting()}, Jose
          </h1>
          <p className="text-sm" style={{ color: '#6B7280' }}>{getDateString()}</p>
        </div>
        {followUpsFaellig > 0 && (
          <Link
            href="/leads"
            className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            style={{
              background: 'rgba(200,169,110,0.12)',
              color: '#C8A96E',
              border: '1px solid rgba(200,169,110,0.3)',
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: '#C8A96E' }}
            />
            {followUpsFaellig} Follow-up{followUpsFaellig !== 1 ? "s" : ""} fällig
          </Link>
        )}
      </div>

      {/* Venture KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-5 gap-3 sm:gap-4 mb-8">
        {ventureKpis.map((kpi) => {
          const meta = getVenture(kpi.venture);
          return (
            <button
              key={kpi.venture}
              onClick={() => setVenture(kpi.venture as (typeof VENTURES)[number]["id"])}
              className="text-left rounded-2xl transition-all group"
              style={{
                background: '#FFFFFF',
                border: '1px solid #D1D5E8',
                boxShadow: '0 2px 12px rgba(27,42,94,0.08)',
                padding: '0',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 32px rgba(27,42,94,0.16)';
                (e.currentTarget as HTMLElement).style.borderColor = '#3A5BA0';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(27,42,94,0.08)';
                (e.currentTarget as HTMLElement).style.borderColor = '#D1D5E8';
              }}
            >
              {/* Gold accent line on top */}
              <div style={{ height: '3px', background: 'linear-gradient(90deg, #C8A96E, #D4B97E)' }} />
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: '#EEF0F7', color: '#1B2A5E' }}
                  >
                    {meta?.label ?? kpi.venture}
                  </span>
                  <span
                    className="text-xs transition-colors"
                    style={{ color: '#D1D5E8' }}
                  >
                    →
                  </span>
                </div>

                {/* KPIs */}
                <div className="space-y-2">
                  <KpiRow label="Leads (7 Tage)" value={kpi.leadsWeek} highlight={kpi.leadsWeek > 0} color="blue" />
                  <KpiRow label="Offene Drafts" value={kpi.openDrafts} highlight={kpi.openDrafts > 0} color="gold" />
                  <KpiRow label="Aktive Aufträge" value={kpi.activeOrders} />
                  <KpiRow label="Neue Kunden" value={kpi.newCustomers} highlight={kpi.newCustomers > 0} color="green" />
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Neueste Leads */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#FFFFFF',
          border: '1px solid #D1D5E8',
          boxShadow: '0 2px 12px rgba(27,42,94,0.08)',
        }}
      >
        <div
          className="px-4 sm:px-6 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid #EEF0F7' }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontWeight: 400,
              fontSize: '18px',
              color: '#14193A',
              letterSpacing: '-0.01em',
            }}
          >
            Neueste Leads
          </h2>
          <Link
            href="/leads"
            className="text-sm font-medium transition-colors"
            style={{ color: '#3A5BA0' }}
          >
            Alle anzeigen →
          </Link>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full" style={{ minWidth: '540px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #EEF0F7', background: '#F7F8FC' }}>
              {["Name", "Unternehmen", "Venture", "Status", "Quelle", "Erstellt"].map(h => (
                <th
                  key={h}
                  className="px-4 sm:px-6 py-3 text-left font-semibold uppercase"
                  style={{ fontSize: '11px', letterSpacing: '0.07em', color: '#6B7280' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentLeads.map((lead) => {
              const meta = getVenture((lead as any).venture);
              return (
                <tr
                  key={lead.id}
                  style={{ borderBottom: '1px solid #F7F8FC' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F7F8FC'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td className="px-6 py-3.5">
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium transition-colors"
                      style={{ color: '#14193A', fontSize: '14px' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1B2A5E'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#14193A'}
                    >
                      {lead.first_name} {lead.last_name}
                    </Link>
                  </td>
                  <td className="px-6 py-3.5 text-sm" style={{ color: '#6B7280' }}>{lead.company_name ?? "—"}</td>
                  <td className="px-6 py-3.5">
                    {meta && (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full"
                        style={{ background: '#EEF0F7', color: '#1B2A5E' }}
                      >
                        {meta.label}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3.5">
                    <StatusBadge status={lead.status} label={STATUS_LABELS[lead.status]} />
                  </td>
                  <td className="px-6 py-3.5 text-sm capitalize" style={{ color: '#6B7280' }}>{lead.source}</td>
                  <td className="px-6 py-3.5 text-xs" style={{ color: '#6B7280' }}>
                    {new Date(lead.created_at).toLocaleDateString("de-DE")}
                  </td>
                </tr>
              );
            })}
            {recentLeads.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm" style={{ color: '#6B7280' }}>
                  Noch keine Leads vorhanden
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

function KpiRow({ label, value, highlight, color = "blue" }: {
  label: string;
  value: number;
  highlight?: boolean;
  color?: "blue" | "gold" | "green";
}) {
  const colorMap = {
    blue: '#1B2A5E',
    gold: '#C8A96E',
    green: '#16A34A',
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: '#6B7280' }}>{label}</span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: highlight ? colorMap[color] : '#14193A' }}
      >
        {value}
      </span>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const dotColors: Record<string, string> = {
    neu: '#3A5BA0',
    kontaktiert: '#C8A96E',
    qualifiziert: '#1B2A5E',
    angebot: '#7C3AED',
    gewonnen: '#16A34A',
    verloren: '#DC2626',
    follow_up: '#EA580C',
  };
  const bgColors: Record<string, string> = {
    neu: '#EEF0F7',
    kontaktiert: 'rgba(200,169,110,0.12)',
    qualifiziert: '#EEF0F7',
    angebot: 'rgba(124,58,237,0.08)',
    gewonnen: 'rgba(22,163,74,0.1)',
    verloren: 'rgba(220,38,38,0.08)',
    follow_up: 'rgba(234,88,12,0.1)',
  };
  const textColors: Record<string, string> = {
    neu: '#1B2A5E',
    kontaktiert: '#A07840',
    qualifiziert: '#14193A',
    angebot: '#5B21B6',
    gewonnen: '#15803D',
    verloren: '#B91C1C',
    follow_up: '#C2410C',
  };
  const dot = dotColors[status] ?? '#6B7280';
  const bg = bgColors[status] ?? '#F3F4F6';
  const text = textColors[status] ?? '#374151';

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: bg, color: text }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot }} />
      {label}
    </span>
  );
}
