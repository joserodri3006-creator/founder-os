"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useVenture } from "@/context/VentureContext";
import TasksPipeline, { type PipelineTask } from "@/components/TasksPipeline";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done";
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

const STATUS_LABELS: Record<Task["status"], string> = { open: "Offen", in_progress: "In Bearbeitung", done: "Erledigt" };
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
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [status, setStatus] = useState<Task["status"] | "alle">("open");
  const [priority, setPriority] = useState<"alle" | Task["priority"]>("alle");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<"alle" | "lead" | "customer">("alle");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams({ venture });
    if (assignedTo) params.set("assigned_to", assignedTo);
    const res = await fetch(`/api/tasks?${params}`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [venture, assignedTo]);

  useEffect(() => { setEditingId(null); }, [viewMode]);

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(d => {
      const list = (d.members ?? []).map((m: { user_id: string; name?: string; email?: string }) => ({
        user_id: m.user_id, name: m.name || m.email || "Unbekannt",
      }));
      setMembers(list);
    });
  }, []);

  async function updateTaskStatus(task: Task, newStatus: Task["status"]) {
    if (task.status === newStatus) return;
    const prevStatus = task.status;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: prevStatus } : t));
      alert("Status konnte nicht aktualisiert werden.");
    }
  }

  async function copyTask(id: string) {
    await fetch(`/api/tasks/${id}/copy`, { method: "POST" });
    await load();
  }

  async function removeTask(id: string) {
    if (!confirm("Aufgabe löschen?")) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Löschen fehlgeschlagen.");
      await load();
    }
  }

  const memberName = (id: string | null) => members.find(m => m.user_id === id)?.name ?? null;

  const baseFiltered = tasks
    .filter(t => priority === "alle" || t.priority === priority)
    .filter(t => !onlyOverdue || isOverdue(t))
    .filter(t => entityTypeFilter === "alle" || t.entity_type === entityTypeFilter)
    .filter(t => !search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase()));

  const listFiltered = baseFiltered
    .filter(t => status === "alle" || t.status === status)
    .sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Aufgaben</h1>
          <p className="text-sm text-gray-500 mt-0.5">Alle Aufgaben zu Leads und Kunden im aktiven Venture</p>
        </div>
        <div className="flex text-sm rounded-md border border-gray-200 overflow-hidden shrink-0">
          <button onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            Liste
          </button>
          <button onClick={() => setViewMode("pipeline")}
            className={`px-3 py-1.5 border-l border-gray-200 ${viewMode === "pipeline" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
            Pipeline
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {viewMode === "list" && (
          <select value={status} onChange={e => setStatus(e.target.value as Task["status"] | "alle")}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
            {(Object.keys(STATUS_LABELS) as Task["status"][]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
            <option value="alle">Alle Status</option>
          </select>
        )}
        <select value={priority} onChange={e => setPriority(e.target.value as "alle" | Task["priority"])}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
          <option value="alle">Alle Prioritäten</option>
          {(Object.keys(PRIORITY_LABELS) as Task["priority"][]).map(p => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
          <option value="">Alle Zuweisungen</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
        </select>
        <select value={entityTypeFilter} onChange={e => setEntityTypeFilter(e.target.value as "alle" | "lead" | "customer")}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white">
          <option value="alle">Leads &amp; Kunden</option>
          <option value="lead">Nur Leads</option>
          <option value="customer">Nur Kunden</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Titel durchsuchen…"
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white flex-1 min-w-[160px]" />
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={onlyOverdue} onChange={e => setOnlyOverdue(e.target.checked)} />
          Nur überfällig
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-4">Laden…</p>
      ) : viewMode === "pipeline" ? (
        baseFiltered.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center">
            <p className="text-sm text-gray-400">Keine Aufgaben gefunden.</p>
          </div>
        ) : (
          <TasksPipeline
            tasks={baseFiltered as PipelineTask[]}
            members={members}
            onStatusChange={(t, s) => updateTaskStatus(t as Task, s)}
          />
        )
      ) : listFiltered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center">
          <p className="text-sm text-gray-400">Keine Aufgaben gefunden.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {listFiltered.map(task => (
            editingId === task.id ? (
              <TaskEditForm key={task.id} task={task} members={members}
                onDone={async () => { setEditingId(null); await load(); }}
                onCancel={() => setEditingId(null)} />
            ) : (
              <TaskListRow key={task.id} task={task} assigneeName={memberName(task.assigned_to)}
                onStatusChange={(s) => updateTaskStatus(task, s)}
                onEdit={() => setEditingId(task.id)}
                onCopy={() => copyTask(task.id)}
                onDelete={() => removeTask(task.id)} />
            )
          ))}
        </div>
      )}
    </div>
  );
}

function TaskListRow({ task, assigneeName, onStatusChange, onEdit, onCopy, onDelete }: {
  task: Task; assigneeName: string | null;
  onStatusChange: (status: Task["status"]) => void;
  onEdit: () => void; onCopy: () => void; onDelete: () => void;
}) {
  const overdue = isOverdue(task);
  const pc = PRIORITY_COLORS[task.priority];
  return (
    <div className={`bg-white rounded-lg border px-4 py-3 flex items-start gap-3 ${overdue ? "border-red-200" : "border-gray-200"}`}>
      <select value={task.status} onChange={e => onStatusChange(e.target.value as Task["status"])}
        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white mt-0.5">
        {(Object.keys(STATUS_LABELS) as Task["status"][]).map(s => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
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
          {assigneeName && <span className="text-gray-500">· {assigneeName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 text-xs">
        <button onClick={onEdit} className="text-gray-400 hover:text-gray-700">Bearbeiten</button>
        <button onClick={onCopy} className="text-gray-400 hover:text-gray-700">Kopieren</button>
        <button onClick={onDelete} className="text-gray-400 hover:text-red-600">Löschen</button>
      </div>
    </div>
  );
}

function TaskEditForm({ task, members, onDone, onCancel }: {
  task: Task; members: TeamMember[]; onDone: () => Promise<void>; onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(task.priority);
  const [dueDate, setDueDate] = useState(task.due_date ?? "");
  const [assignedTo, setAssignedTo] = useState(task.assigned_to ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, description: description || null, priority, due_date: dueDate || null, assigned_to: assignedTo || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert("Speichern fehlgeschlagen.");
      return;
    }
    await onDone();
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel"
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 mb-2" />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Beschreibung (optional)" rows={2}
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 mb-2 resize-y" />
      <div className="flex gap-2 flex-wrap mb-3">
        <select value={priority} onChange={e => setPriority(e.target.value as Task["priority"])}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white flex-1 min-w-[110px]">
          {(Object.keys(PRIORITY_LABELS) as Task["priority"][]).map(p => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 flex-1 min-w-[130px]" />
        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white flex-1 min-w-[130px]">
          <option value="">Nicht zugewiesen</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !title.trim()}
          className="text-sm px-3 py-1.5 rounded-md text-white font-medium disabled:opacity-40" style={{ background: "#1B2A5E" }}>
          {saving ? "Speichert…" : "Speichern"}
        </button>
        <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
          Abbrechen
        </button>
      </div>
    </div>
  );
}
