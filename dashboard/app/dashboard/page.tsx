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

function periodStart(period: Json) {
  return period?.start ?? period?.from;
}

function periodEnd(period: Json) {
  if (period?.end) return period.end;
  if (!period?.to_exclusive) return null;
  const end = new Date(`${period.to_exclusive}T00:00:00`);
  end.setDate(end.getDate() - 1);
  return end.toISOString().slice(0, 10);
}

function dateRangeLabel(period: Json) {
  return `${dateLabel(periodStart(period))} bis ${dateLabel(periodEnd(period))}`;
}

export default function DashboardPage() {
  const { venture } = useVenture();
  const [period, setPeriod] = useState<Period>("month");
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Json | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!venture) return;
    const controller = new AbortController();
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20000);
    setLoading(true); setError(null);
    fetch(`/api/dashboard?venture=${encodeURIComponent(venture)}&period=${period}&as_of=${asOf}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Dashboard konnte nicht geladen werden");
        return body;
      })
      .then((body) => { setData(body); setLoadedAt(new Date()); })
      .catch((reason) => {
        if (timedOut) setError("Der Datenabruf dauert zu lange. Bitte erneut versuchen.");
        else if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => { window.clearTimeout(timeout); setLoading(false); });
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [venture, period, asOf, reloadKey]);

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
          <p className="mt-1 text-sm text-[#6B7280]">{PERIOD_LABELS[period]} · {dateRangeLabel(periodData)}</p>
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
      {error && <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><span>{error}</span><button onClick={() => setReloadKey((current) => current + 1)} className="font-semibold underline">Wiederholen</button></div>}
      {!loading && !error && data && (
        <>
          <section className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Neue Leads" value={value(crm, "new_leads")} hint={periodLabel(periodData)} href="/leads" />
            <Kpi label="Aufträge" value={value(commerce, "orders")} hint={qualityLabel(quality.commerce)} href="/auftraege" />
            <Kpi label="Auftragswert" value={formatMoney(commerce?.order_value)} hint={qualityLabel(quality.commerce)} href="/auftraege" />
            <Kpi label="Offene Aufgaben" value={value(tasks, "open_total")} hint="Gesamtbestand" href="/aufgaben" />
          </section>

          <section className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Gewonnene Leads" value={value(crm, "won_leads")} hint={periodLabel(periodData)} href="/leads" />
            <Kpi label="Neue Kunden" value={value(crm, "customers_created")} hint={periodLabel(periodData)} href="/kunden" />
            <Kpi label="Offene Leads" value={value(crm, "open_leads_total")} hint="Gesamtbestand" href="/leads" />
            <Kpi label="Erstellte Aufgaben" value={value(tasks, "created")} hint={periodLabel(periodData)} href="/aufgaben" />
            <Kpi label="Erledigte Aufgaben" value={value(tasks, "completed")} hint={periodLabel(periodData)} href="/aufgaben" />
            <Kpi label="Aktive Produkte" value={value(commerce, "active_products")} hint="Gesamtbestand" href="/produkte" />
            <Kpi label="Einnahmen" value={formatMoney(finance?.income)} hint="Teilweise Daten" href="/finanzen" />
            <Kpi label="Ausgaben" value={formatMoney(finance?.expense)} hint="Teilweise Daten" href="/finanzen" />
          </section>

          <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
            <section className="rounded-2xl border border-[#D1D5E8] bg-white p-5 shadow-[0_2px_12px_rgba(27,42,94,0.08)] sm:p-6">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">Entwicklung</p><h2 className="mt-1 text-lg font-semibold text-[#14193A]">Leads und Aufträge im Zeitraum</h2></div><span className="text-right text-xs text-[#8A90A3]">{dateRangeLabel(periodData)}</span></div>
              {trend.length ? <div className="flex h-44 items-end gap-2 border-b border-[#E6E8F0] px-2">{trend.map((item: Json, index: number) => <div key={index} className="flex flex-1 items-end gap-1" title={`${item.label ?? index + 1}`}><div className="flex-1 rounded-t bg-[#3A5BA0]" style={{ height: `${Math.max(4, (n(item.leads) / maxTrend) * 100)}%` }} /><div className="flex-1 rounded-t bg-[#C8A96E]" style={{ height: `${Math.max(4, (n(item.orders) / maxTrend) * 100)}%` }} /></div>)}</div> : <div className="flex h-44 items-center justify-center border-b border-[#E6E8F0] text-sm text-[#6B7280]">Keine Aktivität im Zeitraum</div>}
              <div className="mt-3 flex gap-5 text-xs text-[#6B7280]"><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#3A5BA0]" />Leads</span><span><i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#C8A96E]" />Aufträge</span></div>
            </section>

            <section className="rounded-2xl border border-[#D1D5E8] bg-white p-5 shadow-[0_2px_12px_rgba(27,42,94,0.08)] sm:p-6"><SectionTitle eyebrow="Datenqualität" title="Quellenstatus" />
              <div className="mt-5 space-y-3">{[["CRM", quality.crm ?? "ready"], ["Aufträge", quality.commerce ?? quality.orders], ["Finanzen", quality.finance], ["WooCommerce", quality.woocommerce ?? (quality.woocommerce_included ? "ready" : "not_included")]].map(([label, status]) => <div key={String(label)} className="flex items-center justify-between border-b border-[#F0F2F8] pb-3 text-sm"><span className="text-[#374151]">{label}</span><Status value={String(status ?? "ready")} /></div>)}</div>
            </section>
          </div>

          <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Kpi label="Aktive Agenten" value={value(agents, "active")} hint={`von ${value(agents, "registered")} registriert`} href="/agenten" /><Kpi label="KI-Agenten" value={value(agents, "ai_agents")} hint="aktiv" href="/agenten" /><Kpi label="Manager-Agenten" value={value(agents, "manager_agents")} hint="aktiv" href="/agenten" /><Kpi label={`Läufe ${PERIOD_LABELS[period]}`} value={value(agents, "runs_in_period")} hint={agents.telemetry_ready ? "Zentrale Laufdaten" : "Zentrale Laufstatistik fehlt"} href="/agenten" /></section>

          <section className="mt-6 rounded-2xl border border-[#D1D5E8] bg-white shadow-[0_2px_12px_rgba(27,42,94,0.08)]"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#EEF0F7] px-5 py-4 sm:px-6"><div><SectionTitle eyebrow="Agenten" title="Katalog, Zuständigkeit und Betriebsstatus" /></div><Link href="/agenten" className="text-sm font-medium text-[#3A5BA0]">Agenten öffnen</Link></div><div className="divide-y divide-[#F0F2F8]">{agentList.length ? agentList.slice(0, 8).map((agent: Json) => <div key={agent.id ?? agent.slug ?? agent.name} className="grid gap-2 px-5 py-4 sm:grid-cols-[1.4fr_0.7fr_0.7fr_0.8fr_auto] sm:items-center sm:px-6"><div><p className="font-medium text-[#14193A]">{agent.name ?? agent.slug}</p><p className="text-xs text-[#8A90A3]">{agent.purpose ?? agent.role ?? "Keine Zweckbeschreibung"}</p></div><span className="text-xs text-[#6B7280]">{agentTypeLabel(agent.agent_type ?? agent.type)}</span><Status value={String(agent.status ?? "unbekannt")} /><span className="text-xs text-[#8A90A3]">{agent.last_run_at ? dateLabel(agent.last_run_at) : "Keine Daten"}</span><Link href="/agenten" className="text-sm font-medium text-[#3A5BA0]">Details</Link></div>) : <div className="px-5 py-10 text-center text-sm text-[#6B7280]">Agentenkatalog ist für dieses Venture noch nicht verfügbar.</div>}</div></section>

          <p className="mt-5 text-xs text-[#8A90A3]">Stichtag: {dateLabel(data?.period?.as_of ?? asOf)}{loadedAt ? ` · Abgerufen: ${loadedAt.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr` : ""} · Finanzdaten und Agentenlaufdaten können teilweise noch unvollständig sein.</p>
        </>
      )}
    </div>
  );
}

function periodLabel(period: Json) { return period?.label ?? dateRangeLabel(period); }
function qualityLabel(valueIn: unknown) { return statusLabel(String(valueIn ?? "Founder OS")); }
function formatMoney(valueIn: unknown) { const amount = n(valueIn); return `${amount.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`; }
function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) { return <><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">{eyebrow}</p><h2 className="mt-1 text-lg font-semibold text-[#14193A]">{title}</h2></>; }
function statusLabel(status: string) {
  const labels: Record<string, string> = { ready: "Bereit", partial: "Teilweise", missing: "Fehlt", not_included: "Nicht enthalten", active: "Aktiv", paused: "Pausiert", retired: "Archiviert", draft: "Entwurf", testing: "Test", pilot: "Pilot" };
  return labels[status.toLowerCase()] ?? status;
}
function agentTypeLabel(type: unknown) { return ({ ai_agent: "KI-Agent", manager_agent: "Manager-Agent", script: "Script", worker: "Worker", automation: "Automation" } as Record<string, string>)[String(type)] ?? String(type ?? "Agent"); }
function Status({ value: status }: { value: string }) { const partial = /teil|partial|fehl|missing/i.test(status); return <span className={`inline-flex w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${partial ? "bg-[#FFF7E8] text-[#A16207]" : "bg-[#EEF0F7] text-[#1B2A5E]"}`}>{statusLabel(status)}</span>; }
function Kpi({ label, value: metric, hint, href }: { label: string; value: number | string; hint: string; href: string }) { return <Link href={href} className="block overflow-hidden rounded-2xl border border-[#D1D5E8] bg-white shadow-[0_2px_12px_rgba(27,42,94,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(27,42,94,0.14)]"><div className="h-[3px] bg-gradient-to-r from-[#C8A96E] to-[#D4B97E]" /><div className="p-4 sm:p-5"><p className="text-xs font-medium text-[#6B7280]">{label}</p><p className="mt-3 text-2xl font-bold tabular-nums text-[#14193A]">{metric}</p><p className="mt-1 text-xs text-[#8A90A3]">{hint}</p></div></Link>; }
function DashboardSkeleton() { return <div className="space-y-6" aria-label="Dashboard lädt"><div className="h-16 animate-pulse rounded-xl bg-[#EEF0F7]" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[1,2,3,4].map((x) => <div key={x} className="h-32 animate-pulse rounded-2xl bg-[#EEF0F7]" />)}</div><div className="h-64 animate-pulse rounded-2xl bg-[#EEF0F7]" /></div>; }
