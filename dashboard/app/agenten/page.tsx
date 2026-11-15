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
  manager: { id: string; name: string; status: string } | null;
}

const SCOPE_LABELS: Record<string, string> = {
  founder_os: "Founder OS",
  portfolio: "Portfolio",
  venture: "Venture",
  personal: "Persönlich",
  shared_service: "Gemeinsame Services",
  client_project: "Kundenprojekte",
};

const AREA_LABELS: Record<string, string> = {
  founder_os: "Systemweite Verwaltung",
  portfolio: "Übergreifende Founder-Aufgaben",
  personal: "Persönliche Prozesse",
  shared_infrastructure: "Technische gemeinsame Infrastruktur",
  online_first: "Online First",
  blazed_outfitters: "Blazed Outfitters",
  brandary: "Brandary",
  droplane: "Droplane",
  worknest: "Worknest",
  itaba: "Itaba",
  perreozone: "PerreoZone",
  sentinel_logic: "Sentinel Logic",
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
  if (!value) return "Noch kein Lauf";
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
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [showClientProjects, setShowClientProjects] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (scope) params.set("scope_type", scope);
    if (type) params.set("agent_type", type);
    if (status) params.set("status", status);
    if (search) params.set("search", search);
    setLoading(true);
    fetch(`/api/agenten?${params}`)
      .then((response) => response.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [scope, type, status, search]);

  const visibleAgents = useMemo(
    () => agents.filter((agent) => showClientProjects || agent.scope_type !== "client_project"),
    [agents, showClientProjects]
  );

  const grouped = useMemo(() => visibleAgents.reduce<Record<string, AgentRecord[]>>((result, agent) => {
    const key = `${agent.scope_type}:${agent.scope_id}`;
    (result[key] ??= []).push(agent);
    return result;
  }, {}), [visibleAgents]);

  const stats = useMemo(() => ({
    total: visibleAgents.length,
    agents: visibleAgents.filter((item) => ["ai_agent", "manager_agent"].includes(item.agent_type)).length,
    automations: visibleAgents.filter((item) => ["script", "worker", "automation"].includes(item.agent_type)).length,
    attention: visibleAgents.filter((item) => ["error", "blocked", "conflict"].includes(item.last_status ?? "") || item.status === "draft").length,
  }), [visibleAgents]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#C8A96E" }}>Founder OS · Steuerung</p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 300, color: "#14193A" }}>Agenten & Automationen</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: "#6B7280" }}>
            Hier siehst du, welche KI-Agenten, Manager, Scripts und Worker in deinem Founder OS existieren, wofür sie zuständig sind und welchem Bereich sie untergeordnet sind.
          </p>
        </div>
        <span className="rounded-full px-3 py-1.5 text-sm" style={{ background: "#EEF0F7", color: "#1B2A5E" }}>{stats.total} Einträge sichtbar</span>
      </div>

      <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: "#D1D5E8" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold" style={{ color: "#14193A" }}>So liest du diese Seite</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6" style={{ color: "#6B7280" }}>
              Ein <strong>KI-Agent</strong> bewertet oder formuliert. Ein <strong>Manager-Agent</strong> koordiniert andere Einträge. Ein <strong>Script</strong> oder <strong>Worker</strong> erledigt einen technisch festen Ablauf. Der Zeitplan ist nur der Auslöser – nicht automatisch ein eigener Agent.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm" style={{ color: "#4B5563" }}>
            <input type="checkbox" checked={showClientProjects} onChange={(event) => setShowClientProjects(event.target.checked)} />
            Kundenprojekte anzeigen
          </label>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Gesamt", stats.total, "Alle sichtbaren Einträge"],
          ["KI-Einheiten", stats.agents, "Agenten und Manager"],
          ["Technische Abläufe", stats.automations, "Scripts, Worker und Automationen"],
          ["Prüfung nötig", stats.attention, "Entwürfe oder letzte Fehler"],
        ].map(([label, value, hint]) => <div key={String(label)} className="rounded-2xl border bg-white p-4" style={{ borderColor: "#D1D5E8" }}><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#9CA3AF" }}>{label}</p><p className="mt-2 text-2xl font-semibold" style={{ color: "#14193A" }}>{value}</p><p className="mt-1 text-xs" style={{ color: "#6B7280" }}>{hint}</p></div>)}
      </section>

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm" style={{ borderColor: "#D1D5E8" }}>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, Rolle oder Zweck suchen…" className="min-w-[230px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: "#D1D5E8" }} />
        <select value={scope} onChange={(event) => setScope(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}><option value="">Alle Bereiche</option>{Object.entries(SCOPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select value={type} onChange={(event) => setType(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}><option value="">Alle Typen</option>{Object.entries(TYPE_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}><option value="">Alle Status</option>{Object.entries(STATUS_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      </div>

      {loading ? <p className="py-12 text-center text-sm" style={{ color: "#6B7280" }}>Agentenübersicht wird geladen…</p> : visibleAgents.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center" style={{ borderColor: "#D1D5E8" }}><p className="text-base font-semibold" style={{ color: "#14193A" }}>Keine Einträge für diese Auswahl</p><p className="mt-2 text-sm" style={{ color: "#6B7280" }}>Passe die Filter an oder aktiviere die Kundenprojekte.</p></div>
      ) : <div className="space-y-7">
        {Object.entries(grouped).map(([key, items]) => {
          const [scopeType, scopeId] = key.split(":");
          const isClient = scopeType === "client_project";
          return <section key={key}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div><p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: isClient ? "#8B5CF6" : "#C8A96E" }}>{SCOPE_LABELS[scopeType] ?? scopeType}</p><h2 className="mt-1 text-xl font-semibold" style={{ color: "#14193A" }}>{AREA_LABELS[scopeId] ?? scopeId}</h2></div>
              <span className="rounded-full px-2.5 py-1 text-xs" style={{ background: isClient ? "#F3E8FF" : "#EEF0F7", color: isClient ? "#7C3AED" : "#6B7280" }}>{items.length} Einträge</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
              {items.map((agent) => <article key={agent.id} className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: isClient ? "#DDD6FE" : "#D1D5E8" }}>
                <div className="mb-3 flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "#315B9A" }}>{TYPE_LABELS[agent.agent_type] ?? agent.agent_type}</p><h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5" style={{ color: "#14193A" }}>{agent.name}</h3></div><span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={statusStyle(agent.status)}>{STATUS_LABELS[agent.status] ?? agent.status}</span></div>
                <p className="line-clamp-2 min-h-10 text-xs leading-5" style={{ color: "#4B5563" }}>{agent.purpose || agent.role}</p>
                <dl className="mt-3 space-y-1.5 border-t pt-3 text-[11px]" style={{ borderColor: "#EEF0F7" }}>
                  <div className="flex justify-between gap-3"><dt style={{ color: "#9CA3AF" }}>Zuständig</dt><dd className="text-right font-medium" style={{ color: "#374151" }}>{agent.manager?.name || (agent.agent_type === "manager_agent" ? "Oberste Ebene" : "Nicht zugeordnet")}</dd></div>
                  <div className="flex justify-between gap-3"><dt style={{ color: "#9CA3AF" }}>Auslöser</dt><dd className="text-right font-medium" style={{ color: "#374151" }}>{agent.trigger_type || "—"}{agent.schedule ? ` · ${agent.schedule}` : ""}</dd></div>
                  <div className="flex justify-between gap-3"><dt style={{ color: "#9CA3AF" }}>Letzter Lauf</dt><dd className="text-right font-medium" style={{ color: "#374151" }}>{formatDate(agent.last_run_at)}</dd></div>
                  {agent.last_status && agent.last_status !== "ok" && <div className="flex justify-between gap-3"><dt style={{ color: "#9CA3AF" }}>Laufstatus</dt><dd className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={statusStyle(agent.last_status)}>{agent.last_status}</dd></div>}
                  {agent.last_error && <div className="rounded-lg px-2 py-1.5" style={{ background: "#FDECEC", color: "#B91C1C" }}>{agent.last_error}</div>}
                </dl>
              </article>)}
            </div>
          </section>;
        })}
      </div>}
    </main>
  );
}
