"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useVenture } from "@/context/VentureContext";
import { getVenture } from "@/lib/ventures";

type Period = "week" | "month" | "quarter" | "year";
type Json = Record<string, any>;

const PERIOD_LABELS: Record<Period, string> = {
  week: "Kalenderwoche",
  month: "Monat",
  quarter: "Kalenderquartal",
  year: "Jahr",
};

function n(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}
function value(group: Json | undefined, ...keys: string[]) {
  let current: any = group;
  for (const key of keys) current = current?.[key];
  return n(current);
}
function euro(valueInCents: number) {
  return `${(valueInCents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}
function dateLabel(valueIn: unknown) {
  if (!valueIn) return "—";
  const date = new Date(String(valueIn));
  return Number.isNaN(date.getTime()) ? String(valueIn) : date.toLocaleDateString("de-DE");
}

export default function DashboardPage() {
  const { venture } = useVenture();
  const [period, setPeriod] = useState<Period>("month");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Json | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!venture) return;
    const controller = new AbortController();
    setLoading(true); setError(null);
    fetch(`/api/dashboard?venture=${encodeURIComponent(venture)}&period=${period}&as_of=${asOf}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Dashboard konnte nicht geladen werden");
        return body;
      })
      .then(setData)
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [venture, period, asOf]);

  const meta = getVenture(venture ?? "");
  const periodData = data?.period ?? {};
  const crm = data?.crm;
  const tasks = data?.tasks;
  const commerce = data?.commerce;
  const finance = data?.finance;
  const agents = data?.agents ?? {};
  const quality = data?.data_quality ?? {};
  const agentList = Array.isArray(agents.items) ? agents.items : Array.isArray(agents.list) ? agents.list : [];
  const trend = Array.isArray(data?.trend) ? data.trend : Array.isArray(data?.series) ? data.series : [];
  const maxTrend = Math.max(1, ...trend.map((item: Json) => Math.max(n(item.leads), n(item.orders), n(item.value))));

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:p-8">
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C8A96E]">Founder OS · Dashboard</p>
          <h1 className="text-[30px] font-light tracking-tight text-[#14193A]" style={{ fontFamily: "var(--font-serif)" }}>{meta?.label ?? venture}</h1>
          <p className="mt-1 text-sm text-[#6B7280]">{PERIOD_LABELS[period]} · {dateLabel(periodData.start)} bis {dateLabel(periodData.end)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Zeitraum
            <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="ml-2 rounded-lg border border-[#D1D5E8] bg-white px-3 py-2 text-sm font-normal normal-case text-[#14193A]">
              {Object.entries(PERIOD_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Stichtag
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="ml-2 rounded-lg border border-[#D1D5E8] bg-white px-3 py-2 text-sm font-normal normal-case text-[#14193A]" />
          </label>
        </div>
      </header>

      {loading && <DashboardSkeleton />}
      {error && <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setAsOf(asOf)} className="font-semibold underline">Wiederholen</button></div>}
      {!loading && !error && data && (
        <>
          <section className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Neue Leads" value={value(crm, "new_leads")} hint={periodLabel(periodData)} href="/leads" />
            <Kpi label="Aufträge" value={value(commerce, "orders")} hint={qualityLabel(quality.commerce)} href="/auftraege" />
            <Kpi label="Auftragswert" value={formatMoney(commerce?.order_value)} hint={qualityLabel(quality.commerce)} href="/auftraege" />
            <Kpi label="Offene Aufgaben" value={value(tasks, "open")} hint="Gesamtbestand" href="/aufgaben" />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <section className="rounded-2xl border border-[#D1D5E8] bg-white p-5 shadow-[0_2px_12px_rgba(27,42,94,0.08)] sm:p-6">
              <div className="mb-5 flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">Entwicklung</p><h2 className="mt-1 text-lg font-semibold text-[#14193A]">Leads und Aufträge im Zeitraum</h2></div><span className="text-xs text-[#8A90A3]">{dateLabel(data?.period?.start)} – {dateLabel(data?.period?.end)}</span></div>
              {trend.length ? <div className="flex h-44 items-end gap-2 border-b border-[#E6E8F0] px-2">{trend.map((item: Json, index: number) => <div key={index} className="flex flex-1 items-end gap-1" title={`${item.label ?? index + 1}`}><div className="flex-1 rounded-t bg-[#3A5BA0]" style={{ height: `${Math.max(4, (n(item.leads) / maxTrend) * 100)}%` }} /><div className="flex-1 rounded-t bg-[#C8A96E]" style={{ height: `${Math.max(4, (n(item.orders) / maxTrend) * 100)}%` }} /></div>)}</div> : <div className="flex h-44 items-center justify-center border-b border-[#E6E8F0] text-sm text-[#6B7280]">Keine Aktivität im Zeitraum</div>}
              <div className="mt-3 flex gap-5 text-xs text-[#6B7280]"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#3A5BA0]" />Leads</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#C8A96E]" />Aufträge</span></div>
            </section>

            <section className="rounded-2xl border border-[#D1D5E8] bg-white p-5 shadow-[0_2px_12px_rgba(27,42,94,0.08)] sm:p-6"><SectionTitle eyebrow="Datenqualität" title="Quellenstatus" />
              <div className="mt-5 space-y-3">{[["CRM", quality.crm], ["Aufträge", quality.commerce], ["Finanzen", quality.finance], ["WooCommerce", quality.woocommerce ?? "nicht enthalten"]].map(([label, status]) => <div key={String(label)} className="flex items-center justify-between border-b border-[#F0F2F8] pb-3 text-sm"><span className="text-[#374151]">{label}</span><Status value={String(status ?? "bereit")} /></div>)}</div>
            </section>
          </div>

          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Kpi label="Aktive Agenten" value={value(agents, "active")} hint={`von ${value(agents, "registered")} registriert`} href="/agenten" /><Kpi label="KI-Agenten" value={value(agents, "ai_agents")} hint="aktiv" href="/agenten" /><Kpi label="Manager-Agenten" value={value(agents, "manager_agents")} hint="aktiv" href="/agenten" /><Kpi label={`Läufe ${PERIOD_LABELS[period]}`} value={value(agents, "runs")} hint={value(agents, "tracking_available") ? "Founder OS" : "Tracking fehlt"} href="/agenten" /></section>

          <section className="mt-6 rounded-2xl border border-[#D1D5E8] bg-white shadow-[0_2px_12px_rgba(27,42,94,0.08)]"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#EEF0F7] px-5 py-4 sm:px-6"><div><SectionTitle eyebrow="Agenten" title="Katalog, Zuständigkeit und Betriebsstatus" /></div><Link href="/agenten" className="text-sm font-medium text-[#3A5BA0]">Agenten öffnen →</Link></div><div className="divide-y divide-[#F0F2F8]">{agentList.length ? agentList.slice(0, 8).map((agent: Json) => <div key={agent.id ?? agent.slug ?? agent.name} className="grid gap-2 px-5 py-4 sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_auto] sm:items-center sm:px-6"><div><p className="font-medium text-[#14193A]">{agent.name ?? agent.slug}</p><p className="text-xs text-[#8A90A3]">{agent.purpose ?? agent.role ?? "Keine Zweckbeschreibung"}</p></div><span className="text-xs text-[#6B7280]">{agent.agent_type ?? agent.type ?? "Agent"}</span><Status value={String(agent.status ?? "unbekannt")} /><span className="text-xs text-[#8A90A3]">{agent.last_run ? dateLabel(agent.last_run) : "Keine Daten"}</span><Link href="/agenten" className="text-sm font-medium text-[#3A5BA0]">Details</Link></div>) : <div className="px-5 py-10 text-center text-sm text-[#6B7280]">Keine Agenten für dieses Venture verfügbar</div>}</div></section>

          <p className="mt-5 text-xs text-[#8A90A3]">Datenstand: {dateLabel(data?.period?.as_of ?? asOf)} · Finanzdaten und Agentenlaufdaten können teilweise noch unvollständig sein.</p>
        </>
      )}
    </div>
  );
}

function periodLabel(period: Json) { return period?.label ?? "Ausgewählter Zeitraum"; }
function qualityLabel(valueIn: unknown) { return valueIn ? String(valueIn) : "Founder OS"; }
function formatMoney(valueIn: unknown) { const amount = n(valueIn); return `${amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`; }
function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-[#14193A]">{title}</h2></>; }
function Status({ value: status }: { value: string }) { const partial = /teil|partial/i.test(status); return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${partial ? "bg-[#FFF7E8] text-[#A16207]" : "bg-[#EEF0F7] text-[#1B2A5E]"}`}>{status}</span>; }
function Kpi({ label, value: metric, hint, href }: { label: string; value: number | string; hint: string; href: string }) { return <Link href={href} className="block overflow-hidden rounded-2xl border border-[#D1D5E8] bg-white shadow-[0_2px_12px_rgba(27,42,94,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(27,42,94,0.14)]"><div className="h-[3px] bg-gradient-to-r from-[#C8A96E] to-[#D4B97E]" /><div className="p-4 sm:p-5"><p className="text-xs font-medium text-[#6B7280]">{label}</p><p className="mt-3 text-2xl font-bold tabular-nums text-[#14193A]">{metric}</p><p className="mt-1 text-xs text-[#8A90A3]">{hint}</p></div></Link>; }
function DashboardSkeleton() { return <div className="space-y-6" aria-label="Dashboard lädt"><div className="h-16 animate-pulse rounded-xl bg-[#EEF0F7]" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1,2,3,4].map((x) => <div key={x} className="h-32 animate-pulse rounded-2xl bg-[#EEF0F7]" />)}</div><div className="h-64 animate-pulse rounded-2xl bg-[#EEF0F7]" /></div>; }
