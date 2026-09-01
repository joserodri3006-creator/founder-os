"use client";

import { useEffect, useState } from "react";
import { useVenture } from "@/context/VentureContext";
import TasksPipeline, { type PipelineTask } from "@/components/TasksPipeline";
import TasksList, { type ListTask, STATUS_LABELS } from "@/components/TasksList";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assigned_to: string | null;
  sort_order: number;
  entity_type: "lead" | "customer";
  entity_id: string;
  entity_name: string | null;
  entity_company: string | null;
  entity_href: string | null;
  created_at: string;
}

interface TeamMember { user_id: string; name: string; }

const PRIORITY_LABELS: Record<Task["priority"], string> = { low: "Niedrig", medium: "Mittel", high: "Hoch" };

// Tasks ohne echten Lead-/Kunden-Bezug verwenden die Nil-UUID als Platzhalter-Entität
// (bestehende Konvention in der tasks-Tabelle, siehe CLAUDE.md).
const FREE_TASK_ENTITY_ID = "00000000-0000-0000-0000-000000000000";

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
  const [status, setStatus] = useState<Task["status"] | "alle">("alle");
  const [priority, setPriority] = useState<"alle" | Task["priority"]>("alle");
  const [onlyOverdue, setOnlyOverdue] = useState(false);
  const [assignedTo, setAssignedTo] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState<"alle" | "lead" | "customer">("alle");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

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

  // Reihenfolge per Drag & Drop (Liste und Pipeline): kompletten Task-Array vor dem
  // Drag snapshotten, betroffene Aufgabe neben ihre neuen Nachbarn einsortieren und
  // den ganzen (im Client ohnehin geladenen) Array komplett neu durchnummerieren.
  // Nur die tatsächlich geänderten Zeilen gehen an den Server; bei Fehlschlag wird
  // der Snapshot zurückgesetzt (gleiches Prinzip wie bei updateTaskStatus, nur für
  // den ganzen Array statt ein Feld).
  function handleReorder(taskId: string, afterId: string | null, beforeId: string | null, newStatus?: Task["status"]) {
    const previousTasks = tasks;
    const moved = tasks.find(t => t.id === taskId);
    if (!moved) return;
    const rest = tasks.filter(t => t.id !== taskId);

    let insertAt: number;
    if (afterId) {
      const idx = rest.findIndex(t => t.id === afterId);
      insertAt = idx >= 0 ? idx + 1 : rest.length;
    } else if (beforeId) {
      const idx = rest.findIndex(t => t.id === beforeId);
      insertAt = idx >= 0 ? idx : rest.length;
    } else {
      insertAt = 0;
    }

    const updatedMoved = newStatus ? { ...moved, status: newStatus } : moved;
    const next = [...rest.slice(0, insertAt), updatedMoved, ...rest.slice(insertAt)]
      .map((t, i) => ({ ...t, sort_order: i }));

    setTasks(next);
    persistReorder(previousTasks, next);
  }

  async function persistReorder(previousTasks: Task[], updatedTasks: Task[]) {
    const prevById = new Map(previousTasks.map(t => [t.id, t]));
    const changed = updatedTasks.filter(t => {
      const prev = prevById.get(t.id);
      return !prev || prev.sort_order !== t.sort_order || prev.status !== t.status;
    });
    if (changed.length === 0) return;

    try {
      const res = await fetch("/api/tasks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: changed.map(t => ({
            id: t.id,
            sort_order: t.sort_order,
            ...(prevById.get(t.id)?.status !== t.status ? { status: t.status } : {}),
          })),
        }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setTasks(previousTasks);
      alert("Reihenfolge konnte nicht gespeichert werden.");
    }
  }

  const baseFiltered = tasks
    .filter(t => priority === "alle" || t.priority === priority)
    .filter(t => !onlyOverdue || isOverdue(t))
    .filter(t => entityTypeFilter === "alle" || t.entity_type === entityTypeFilter)
    .filter(t => !search.trim() || t.title.toLowerCase().includes(search.trim().toLowerCase()));

  const listFiltered = baseFiltered
    .filter(t => status === "alle" || t.status === status)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="px-4 py-5 sm:p-8 max-w-4xl mx-auto">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Aufgaben</h1>
          <p className="text-sm text-gray-500 mt-0.5">Alle Aufgaben zu Leads und Kunden im aktiven Venture</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowNewForm(v => !v)}
            className="text-sm px-3 py-1.5 rounded-md text-white font-medium shrink-0" style={{ background: "#1B2A5E" }}>
            + Neue Aufgabe
          </button>
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
      </div>

      {showNewForm && (
        <NewTaskForm
          venture={venture}
          members={members}
          onDone={async () => { setShowNewForm(false); await load(); }}
          onCancel={() => setShowNewForm(false)}
        />
      )}

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
            onReorder={(id, after, before, newStatus) => handleReorder(id, after, before, newStatus)}
          />
        )
      ) : listFiltered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center">
          <p className="text-sm text-gray-400">Keine Aufgaben gefunden.</p>
        </div>
      ) : (
        <TasksList
          tasks={listFiltered as ListTask[]}
          members={members}
          editingId={editingId}
          onStatusChange={(t, s) => updateTaskStatus(t as Task, s)}
          onReorder={(id, after, before) => handleReorder(id, after, before)}
          onEdit={setEditingId}
          onEditDone={async () => { setEditingId(null); await load(); }}
          onEditCancel={() => setEditingId(null)}
          onCopy={copyTask}
          onDelete={removeTask}
        />
      )}
    </div>
  );
}

function NewTaskForm({ venture, members, onDone, onCancel }: {
  venture: string; members: TeamMember[]; onDone: () => Promise<void>; onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        venture, entity_type: "lead", entity_id: FREE_TASK_ENTITY_ID,
        title, description: description || null, priority, due_date: dueDate || null, assigned_to: assignedTo || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      alert("Aufgabe konnte nicht angelegt werden.");
      return;
    }
    await onDone();
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-5">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel" autoFocus
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
          {saving ? "Speichert…" : "Anlegen"}
        </button>
        <button onClick={onCancel} className="text-sm px-3 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
          Abbrechen
        </button>
      </div>
    </div>
  );
}
