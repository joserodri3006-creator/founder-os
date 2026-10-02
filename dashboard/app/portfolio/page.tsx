"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface Project {
  id: string;
  name: string;
  area: string;
  venture: string;
  use_case: string;
  audience: string;
  status: string;
  visibility: string;
  portfolio_relevance: string;
  role: string;
  tech_stack: string;
  url: string | null;
  link_check: string;
  next_step: string;
  notes: string;
  is_archived: boolean;
  updated_at: string;
}

const VENTURES: Record<string, { label: string; color: string; soft: string }> = {
  online_first: { label: "Online First", color: "#315B9A", soft: "#EAF1FB" },
  blazed_outfitters: { label: "Blazed Outfitters", color: "#C2410C", soft: "#FFF0E8" },
  droplane: { label: "Droplane", color: "#7C3AED", soft: "#F1EAFF" },
  brandary: { label: "Brandary", color: "#15803D", soft: "#EAF8EF" },
  worknest: { label: "Worknest", color: "#0F766E", soft: "#E7F8F6" },
};

const STATUS: Record<string, string> = {
  live: "Live / umgesetzt", active: "Aktiv", development: "Prototyp / Entwicklung",
  concept: "Konzept / Idee", archived: "Archiviert",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  live: { bg: "#EAF8EF", text: "#15803D" }, active: { bg: "#EAF1FB", text: "#315B9A" },
  development: { bg: "#FFF7E6", text: "#A16207" }, concept: { bg: "#F3F4F6", text: "#4B5563" },
  archived: { bg: "#FDECEC", text: "#B91C1C" },
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function tags(stack: string) {
  return stack.split(/,|\/|·/).map((s) => s.trim()).filter(Boolean).slice(0, 4);
}

export default function PortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [venture, setVenture] = useState("");
  const [status, setStatus] = useState("");
  const [area, setArea] = useState("");
  const [relevance, setRelevance] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (venture) params.set("venture", venture);
    if (status) params.set("status", status);
    if (area) params.set("area", area);
    if (relevance) params.set("relevance", relevance);
    if (showArchived) params.set("include_archived", "true");
    setLoading(true);
    fetch(`/api/portfolio?${params}`)
      .then((r) => r.json())
      .then((data) => setProjects(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [search, venture, status, area, relevance, showArchived]);

  const areas = useMemo(() => [...new Set(projects.map((p) => p.area).filter(Boolean))].sort(), [projects]);
  const relevanceOptions = useMemo(() => [...new Set(projects.map((p) => p.portfolio_relevance).filter(Boolean))].sort(), [projects]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "#C8A96E" }}>Founder OS · Übersicht</p>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: 32, fontWeight: 300, color: "#14193A" }}>Portfolio</h1>
          <p className="mt-1 text-sm" style={{ color: "#6B7280" }}>Projekte, Websites und digitale Produkte auf einen Blick.</p>
        </div>
        <div className="rounded-full px-3 py-1.5 text-sm" style={{ background: "#EEF0F7", color: "#1B2A5E" }}>
          {projects.length} Projekte sichtbar
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border bg-white p-3 shadow-sm" style={{ borderColor: "#D1D5E8" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Projekt oder Tech Stack suchen…" className="min-w-[220px] flex-1 rounded-lg border px-3 py-2 text-sm outline-none" style={{ borderColor: "#D1D5E8" }} />
        <select value={venture} onChange={(e) => setVenture(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}><option value="">Alle Ventures</option>{Object.entries(VENTURES).map(([id, v]) => <option key={id} value={id}>{v.label}</option>)}</select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}><option value="">Alle Status</option>{Object.entries(STATUS).filter(([id]) => id !== "archived").map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}><option value="">Alle Bereiche</option>{areas.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <select value={relevance} onChange={(e) => setRelevance(e.target.value)} className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: "#D1D5E8" }}><option value="">Alle Relevanzen</option>{relevanceOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>
        <label className="flex items-center gap-2 px-2 text-sm" style={{ color: "#6B7280" }}><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} /> Archivierte</label>
      </div>

      {loading ? <p className="py-12 text-center text-sm" style={{ color: "#6B7280" }}>Portfolio wird geladen…</p> : projects.length === 0 ? <p className="rounded-2xl border bg-white p-10 text-center text-sm" style={{ borderColor: "#D1D5E8", color: "#6B7280" }}>Keine Projekte für diese Auswahl.</p> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => {
          const v = VENTURES[project.venture] ?? { label: project.venture, color: "#475569", soft: "#F1F5F9" };
          const s = STATUS_COLORS[project.status] ?? STATUS_COLORS.concept;
          return <article key={project.id} className="overflow-hidden rounded-[24px] border bg-white shadow-sm transition-shadow hover:shadow-md" style={{ borderColor: "#D1D5E8" }}>
            <div className="h-2" style={{ background: v.color }} />
            <div className="p-5">
              <div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: v.color }}>{v.label}</p><h2 className="mt-1 text-xl font-semibold" style={{ color: "#14193A" }}>{project.name}</h2><p className="mt-1 text-sm" style={{ color: "#6B7280" }}>{project.area}</p></div><span className="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: s.bg, color: s.text }}>{STATUS[project.status] ?? project.status}</span></div>
              <div className="mb-4 flex flex-wrap gap-1.5">{tags(project.tech_stack).map((tag) => <span key={tag} className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: v.soft, color: v.color }}>{tag}</span>)}</div>
              <p className="line-clamp-3 text-sm leading-6" style={{ color: "#4B5563" }}>{project.use_case}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: "#EEF0F7" }}><div><p className="text-[11px] uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Portfolio</p><p className="mt-1 text-xs font-medium" style={{ color: "#374151" }}>{project.portfolio_relevance || "—"}</p></div><div><p className="text-[11px] uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Aktualisiert</p><p className="mt-1 text-xs font-medium" style={{ color: "#374151" }}>{formatDate(project.updated_at)}</p></div></div>
              <details className="mt-4 rounded-xl" style={{ background: "#F7F8FC" }}><summary className="cursor-pointer px-3 py-2.5 text-sm font-medium" style={{ color: "#315B9A" }}>Details anzeigen</summary><div className="space-y-3 px-3 pb-3 text-sm" style={{ color: "#4B5563" }}><p><strong>Rolle:</strong> {project.role || "—"}</p><p><strong>Zielgruppe:</strong> {project.audience || "—"}</p><p><strong>Nächster Schritt:</strong> {project.next_step || "—"}</p><p><strong>Sichtbarkeit:</strong> {project.visibility || "—"}</p><p><strong>Link-Prüfung:</strong> {project.link_check || "—"}</p>{project.url && <Link href={project.url} target="_blank" className="inline-flex font-semibold" style={{ color: v.color }}>Website öffnen ↗</Link>}</div></details>
            </div>
          </article>;
        })}
      </div>}
    </main>
  );
}
