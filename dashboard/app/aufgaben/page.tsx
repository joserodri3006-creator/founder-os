"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assigned_to: string | null;
  entity_type: "lead" | "customer";
  entity_id: string;
  entity_name: string | null;
  entity_company: string | null;
  entity_href: string | null;
  created_at: string;
}

interface TeamMember { user_id: string; name: string; }

const PRIORITY_LABELS: Record<Task["priority"], string> = { low: "Niedrig", medium: "Mittel", high: "Hoch" };
const PRIORITY_COLORS: Record<Task["priority"], { bg: string; color: string }> = {
  low: { bg: "#F3F4F6", color: "#4B5563" },
  medium: { bg: "#FEF9C3", color: "#A16207" },
  high: { bg: "#FEE2E2", color: "#B91C1C" },
};

function isOverdue(task: Task) {
  if (task.status === "done" || !task.due_date) return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

export default function AufgabenPage() {
  const { venture } = useVenture();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"open" | "done" | "alle">("open");
  const [priority, setPriority] = useState<"alle" | Task["priority"]>("alle");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ venture, status });
    const res = await fetch(`/api/tasks?${params}`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture, status]);

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(d => {
      const list = (d.members ?? []).map((m: { user_id: string; name?: string; email?: string }) => ({
        user_id: m.user_id, name: m.name || m.email || "Unbekannt",
      }));
      setMembers(list);
    });
  }, []);

  async function toggleDone(task: Task) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: t.status === "done" ? "open" : "done" } : t));
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: task.status === "done" ? "open" : "done" }),
    });
    if (status !== "alle") await load();
  }

  const memberName = (id: string | null) => members.find(m => m.user_id === id)?.name ?? null;

  const filtered = tasks
    .filter(t => priority === "alle" || t.priority === priority)
    .filter(t => !onlyOverdue || isOverdue(t))
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Aufgaben</h1>
        <p className="text-sm text-gray-500 mt-0.5">Alle Aufgaben zu Leads und Kunden im aktiven Venture</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select value={status} onChange={e => setStatus(e.target.value as "open" | "done" | "alle")}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
          <option value="open">Offen</option>
          <option value="done">Erledigt</option>
          <option value="alle">Alle</option>
        </select>
        <select value={priority} onChange={e => setPriority(e.target.value as "alle" | Task["priority"])}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
          <option value="alle">Alle Prioritäten</option>
          {(Object.keys(PRIORITY_LABELS) as Task["priority"][]).map(p => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} />
          Nur überfällig
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Laden…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center">
          <p className="text-sm text-gray-400">Keine Aufgaben gefunden.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => {
            const overdue = isOverdue(task);
            const pc = PRIORITY_COLORS[task.priority];
            return (
              <div key={task.id} className={`bg-white rounded-lg border px-4 py-3 flex items-start gap-3 ${overdue ? "border-red-200" : "border-gray-200"}`}>
                <input type="checkbox" checked={task.status === "done"} onChange={() => toggleDone(task)}
                  className="mt-1 cursor-pointer" />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${task.status === "done" ? "text-gray-400 line-through" : "text-gray-900"}`}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-xs">
                    {task.entity_href && (
                      <Link href={task.entity_href} className="text-blue-600 hover:text-blue-700">
                        {task.entity_name}{task.entity_company ? ` (${task.entity_company})` : ""}
                      </Link>
                    )}
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: pc.bg, color: pc.color }}>
                      {PRIORITY_LABELS[task.priority]}
                    </span>
                    {task.due_date && (
                      <span className={overdue ? "text-red-600 font-medium" : "text-gray-500"}>
                        {overdue ? "Überfällig: " : ""}{new Date(task.due_date).toLocaleDateString("de-DE")}
                      </span>
                    )}
                    {task.assigned_to && <span className="text-gray-500">· {memberName(task.assigned_to)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
