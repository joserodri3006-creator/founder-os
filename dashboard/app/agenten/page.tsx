"use client";

import { useEffect, useMemo, useState } from "react";

interface AgentRecord {
  id: string;
  name: string;
  slug: string;
  agent_type: string;
  owner_type: string;
  scope_type: string;
  scope_id: string;
  venture: string | null;
  project_id: string | null;
  role: string;
  purpose: string | null;
  status: string;
  trigger_type: string | null;
  cron_job_id: string | null;
  provider: string | null;
  model: string | null;
  schedule: string | null;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
}

const SCOPE_LABELS: Record<string, string> = {
  founder_os: "Founder OS",
  portfolio: "Portfolio",
  venture: "Venture",
  personal: "Persönlich",
  shared_service: "Gemeinsamer Service",
  client_project: "Kundenprojekt",
};

const TYPE_LABELS: Record<string, string> = {
  ai_agent: "KI-Agent",
  manager_agent: "Manager-Agent",
  script: "Script",
  worker: "Worker",
  automation: "Automation",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  testing: "Test",
  active: "Aktiv",
  pilot: "Pilot",
  paused: "Pausiert",
  retired: "Archiviert",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function statusStyle(status: string) {
  if (["active", "ok"].includes(status)) return { background: "#EAF8EF", color: "#15803D" };
  if (["error", "blocked", "conflict"].includes(status)) return { background: "#FDECEC", color: "#B91C1C" };
  if (["pilot", "testing", "partial"].includes(status)) return { background: "#FFF7E6", color: "#A16207" };
  return { background: "#EEF0F7", color: "#4B5563" };
}

export default function AgentenPage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (scope) params.set("scope_type", scope);
    if (type) params.set("agent_type", type);
    if (search) params.set("search", search);
    setLoading(true);
    fetch(`/api/agenten?${params}`)
      .then((response) => response.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [scope, type, search]);

  const grouped = useMemo(() => {
    return agents.reduce<Record<string, AgentRecord[]>>((result, agent) => {
      const key = `${agent.scope_type}:${agent.scope_id}`;
      (result[key] ??= []).push(agent);
      return result;
    }, {});
  }, [agents]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#C8A96E" }}>Founder OS · Systemübersicht</p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 300, color: "#14193A" }}>Agenten & Automationen</h1>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: "#6B7280" }}>
            Zentrale Übersicht für KI-Agenten, Manager, Scripts, Worker und Automationen. Ein Venture ist optional: System-, Portfolio-, persönliche und Kundenbereiche bleiben getrennt.
          </p>
        </div>
        <div className="rounded-full px-3 py-1.5 text-sm" style={{ background: "#EEF0F7", color: "#1B2A5E" }}>
          {agents.length} Einträge
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm" style={{ borderColor: "#D1D5E8" }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Rolle oder Zweck suchen…" className="min-w-[230px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: "#D1D5E8" }} />
        <select value={scope} onChange={(event) => setScope(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}>
          <option value="">Alle Scopes</option>
          {Object.entries(SCOPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}>
          <option value="">Alle Typen</option>
          {Object.entries(TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>

      {loading ? <p className="py-12 text-center text-sm" style={{ color: "#6B7280" }}>Agentenübersicht wird geladen…</p> : agents.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center" style={{ borderColor: "#D1D5E8" }}>
          <p className="text-base font-semibold" style={{ color: "#14193A" }}>Noch keine Registry-Einträge</p>
          <p className="mx-auto mt-2 max-w-xl text-sm" style={{ color: "#6B7280" }}>
            Die Struktur ist bereit. Bestehende Hermes-Jobs werden im nächsten Schritt kontrolliert zugeordnet – nicht pauschal Online First.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([key, items]) => {
            const [scopeType, scopeId] = key.split(":");
            return <section key={key}>
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-lg font-semibold" style={{ color: "#14193A" }}>{SCOPE_LABELS[scopeType] ?? scopeType}</h2>
                <span className="rounded-full px-2 py-0.5 text-xs" style={{ background: "#EEF0F7", color: "#6B7280" }}>{scopeId}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map((agent) => <article key={agent.id} className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "#D1D5E8" }}>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#315B9A" }}>{TYPE_LABELS[agent.agent_type] ?? agent.agent_type}</p><h3 className="mt-1 text-base font-semibold" style={{ color: "#14193A" }}>{agent.name}</h3></div>
                    <span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={statusStyle(agent.status)}>{STATUS_LABELS[agent.status] ?? agent.status}</span>
                  </div>
                  <p className="text-sm" style={{ color: "#4B5563" }}>{agent.purpose || agent.role}</p>
                  <dl className="mt-4 space-y-2 border-t pt-3 text-xs" style={{ borderColor: "#EEF0F7" }}>
                    <div className="flex justify-between gap-3"><dt style={{ color: "#9CA3AF" }}>Bereich</dt><dd className="text-right font-medium" style={{ color: "#374151" }}>{agent.venture || agent.project_id || SCOPE_LABELS[agent.scope_type]}</dd></div>
                    <div className="flex justify-between gap-3"><dt style={{ color: "#9CA3AF" }}>Trigger</dt><dd className="text-right font-medium" style={{ color: "#374151" }}>{agent.trigger_type || "—"}{agent.schedule ? ` · ${agent.schedule}` : ""}</dd></div>
                    <div className="flex justify-between gap-3"><dt style={{ color: "#9CA3AF" }}>Letzter Lauf</dt><dd className="text-right font-medium" style={{ color: "#374151" }}>{formatDate(agent.last_run_at)}</dd></div>
                    {agent.last_error && <div className="rounded-lg px-2 py-1.5" style={{ background: "#FDECEC", color: "#B91C1C" }}>{agent.last_error}</div>}
                  </dl>
                </article>)}
              </div>
            </section>;
          })}
        </div>
      )}
    </main>
  );
}
