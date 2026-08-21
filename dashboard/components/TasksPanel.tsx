"use client";
import { useEffect, useState, type CSSProperties } from "react";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "open" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
}

interface TeamMember {
  user_id: string;
  name: string;
}

interface Props {
  entityType: "lead" | "customer";
  entityId: string;
  venture: string;
}

const PRIORITY_LABELS: Record<Task["priority"], string> = { low: "Niedrig", medium: "Mittel", high: "Hoch" };
const PRIORITY_COLORS: Record<Task["priority"], { bg: string; color: string }> = {
  low: { bg: "#F3F4F6", color: "#4B5563" },
  medium: { bg: "#FEF9C3", color: "#A16207" },
  high: { bg: "#FEE2E2", color: "#B91C1C" },
};
const STATUS_LABELS: Record<Task["status"], string> = { open: "Offen", in_progress: "In Bearbeitung", done: "Erledigt" };

function isOverdue(task: Task) {
  if (task.status === "done" || !task.due_date) return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

const fieldStyle: CSSProperties = { padding: "7px 8px", border: "1px solid #D1D5E8", borderRadius: "6px", fontSize: "13px", background: "#fff" };

export default function TasksPanel({ entityType, entityId, venture }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/tasks?venture=${venture}&entity_type=${entityType}&entity_id=${entityId}`);
    const data = await res.json();
    setTasks(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { if (entityId) load(); }, [entityId]);

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(d => {
      const list = (d.members ?? []).map((m: { user_id: string; name?: string; email?: string }) => ({
        user_id: m.user_id, name: m.name || m.email || "Unbekannt",
      }));
      setMembers(list);
    });
  }, []);

  async function updateStatus(task: Task, newStatus: Task["status"]) {
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t));
      alert("Status konnte nicht aktualisiert werden.");
      return;
    }
    await load();
  }

  async function copy(id: string) {
    await fetch(`/api/tasks/${id}/copy`, { method: "POST" });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Aufgabe löschen?")) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Löschen fehlgeschlagen.");
      await load();
    }
  }

  const openTasks = tasks.filter(t => t.status !== "done").sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });
  const doneTasks = tasks.filter(t => t.status === "done");
  const memberName = (id: string | null) => members.find(m => m.user_id === id)?.name ?? null;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #D1D5E8", borderRadius: "16px", boxShadow: "0 2px 12px rgba(27,42,94,0.08)", padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <h3 style={{ fontFamily: "var(--font-serif)", fontWeight: 400, fontSize: "16px", color: "#14193A", margin: 0 }}>
          Aufgaben {openTasks.length > 0 && <span style={{ fontSize: "13px", color: "#6B7280", fontFamily: "var(--font-sans)" }}>({openTasks.length})</span>}
        </h3>
        <button onClick={() => { setShowForm(v => !v); setEditingId(null); }}
          style={{ background: "#1B2A5E", color: "#fff", border: "none", borderRadius: "6px", padding: "6px 14px", fontSize: "13px", cursor: "pointer", fontWeight: 500 }}>
          + Aufgabe
        </button>
      </div>

      {showForm && (
        <TaskForm
          mode="create"
          venture={venture} entityType={entityType} entityId={entityId}
          members={members}
          onDone={async () => { setShowForm(false); await load(); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <p style={{ fontSize: "13px", color: "#6B7280", textAlign: "center", padding: "16px 0", margin: 0 }}>Laden…</p>
      ) : openTasks.length === 0 && doneTasks.length === 0 ? (
        <p style={{ fontSize: "13px", color: "#6B7280", textAlign: "center", padding: "8px 0", margin: 0 }}>Keine Aufgaben</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {openTasks.map(task => (
            editingId === task.id ? (
              <TaskForm
                key={task.id}
                mode="edit"
                initial={task}
                venture={venture} entityType={entityType} entityId={entityId}
                members={members}
                onDone={async () => { setEditingId(null); await load(); }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <TaskRow key={task.id} task={task} assigneeName={memberName(task.assigned_to)}
                onStatusChange={(s) => updateStatus(task, s)}
                onEdit={() => { setEditingId(task.id); setShowForm(false); }}
                onCopy={() => copy(task.id)}
                onDelete={() => remove(task.id)} />
            )
          ))}

          {doneTasks.length > 0 && (
            <>
              <button onClick={() => setShowDone(v => !v)}
                style={{ background: "none", border: "none", color: "#6B7280", fontSize: "12px", cursor: "pointer", textAlign: "left", padding: "4px 0" }}>
                {showDone ? "▲" : "▼"} {doneTasks.length} erledigt
              </button>
              {showDone && doneTasks.map(task => (
                editingId === task.id ? (
                  <TaskForm
                    key={task.id}
                    mode="edit"
                    initial={task}
                    venture={venture} entityType={entityType} entityId={entityId}
                    members={members}
                    onDone={async () => { setEditingId(null); await load(); }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <TaskRow key={task.id} task={task} assigneeName={memberName(task.assigned_to)}
                    onStatusChange={(s) => updateStatus(task, s)}
                    onEdit={() => { setEditingId(task.id); setShowForm(false); }}
                    onCopy={() => copy(task.id)}
                    onDelete={() => remove(task.id)} />
                )
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TaskForm({ mode, initial, venture, entityType, entityId, members, onDone, onCancel }: {
  mode: "create" | "edit";
  initial?: Task;
  venture: string; entityType: "lead" | "customer"; entityId: string;
  members: TeamMember[];
  onDone: () => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priority, setPriority] = useState<Task["priority"]>(initial?.priority ?? "medium");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [assignedTo, setAssignedTo] = useState(initial?.assigned_to ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    if (mode === "create") {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          venture, entity_type: entityType, entity_id: entityId,
          title, description: description || null, priority, due_date: dueDate || null, assigned_to: assignedTo || null,
        }),
      });
    } else if (initial) {
      await fetch(`/api/tasks/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, description: description || null, priority, due_date: dueDate || null, assigned_to: assignedTo || null,
        }),
      });
    }
    setSaving(false);
    await onDone();
  }

  return (
    <div style={{ background: "#F7F8FC", border: "1px solid #D1D5E8", borderRadius: "10px", padding: "12px 14px", marginBottom: "12px" }}>
      <input type="text" placeholder="Titel" value={title} onChange={e => setTitle(e.target.value)}
        style={{ width: "100%", padding: "7px 10px", border: "1px solid #D1D5E8", borderRadius: "6px", fontSize: "13px", outline: "none", marginBottom: "8px", boxSizing: "border-box" }} />
      <textarea placeholder="Beschreibung (optional)" value={description} onChange={e => setDescription(e.target.value)} rows={2}
        style={{ width: "100%", padding: "7px 10px", border: "1px solid #D1D5E8", borderRadius: "6px", fontSize: "13px", outline: "none", marginBottom: "8px", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      <div style={{ display: "flex", gap: "8px", marginBottom: "10px", flexWrap: "wrap" }}>
        <select value={priority} onChange={e => setPriority(e.target.value as Task["priority"])}
          style={{ ...fieldStyle, flex: "1 1 100px" }}>
          {(Object.keys(PRIORITY_LABELS) as Task["priority"][]).map(p => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
        <input type="date" value={dueDate ?? ""} onChange={e => setDueDate(e.target.value)}
          style={{ ...fieldStyle, flex: "1 1 130px" }} />
        <select value={assignedTo ?? ""} onChange={e => setAssignedTo(e.target.value)}
          style={{ ...fieldStyle, flex: "1 1 130px" }}>
          <option value="">Nicht zugewiesen</option>
          {members.map(m => <option key={m.user_id} value={m.user_id}>{m.name}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button onClick={save} disabled={saving || !title.trim()}
          style={{ background: "#1B2A5E", color: "#fff", border: "none", borderRadius: "6px", padding: "7px 16px", fontSize: "13px", cursor: "pointer", fontWeight: 500, opacity: (saving || !title.trim()) ? 0.6 : 1 }}>
          {saving ? "Speichert…" : mode === "create" ? "Anlegen" : "Speichern"}
        </button>
        <button onClick={onCancel}
          style={{ background: "transparent", color: "#6B7280", border: "1px solid #D1D5E8", borderRadius: "6px", padding: "7px 12px", fontSize: "13px", cursor: "pointer" }}>
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task, assigneeName, onStatusChange, onEdit, onCopy, onDelete }: {
  task: Task; assigneeName: string | null;
  onStatusChange: (status: Task["status"]) => void;
  onEdit: () => void; onCopy: () => void; onDelete: () => void;
}) {
  const overdue = isOverdue(task);
  const pc = PRIORITY_COLORS[task.priority];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "10px 12px", background: "#F7F8FC", borderRadius: "8px", border: `1px solid ${overdue ? "#FECACA" : "#EEF0F7"}` }}>
      <select value={task.status} onChange={e => onStatusChange(e.target.value as Task["status"])}
        style={{ ...fieldStyle, marginTop: "1px", padding: "3px 6px", fontSize: "11px" }}>
        {(Object.keys(STATUS_LABELS) as Task["status"][]).map(s => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: "13px", fontWeight: 500,
          color: task.status === "done" ? "#9CA3AF" : "#14193A",
          textDecoration: task.status === "done" ? "line-through" : "none",
        }}>
          {task.title}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, padding: "1px 8px", borderRadius: "999px", background: pc.bg, color: pc.color }}>
            {PRIORITY_LABELS[task.priority]}
          </span>
          {task.due_date && (
            <span style={{ fontSize: "11px", color: overdue ? "#DC2626" : "#6B7280", fontWeight: overdue ? 600 : 400 }}>
              {overdue ? "Überfällig: " : ""}{new Date(task.due_date).toLocaleDateString("de-DE")}
            </span>
          )}
          {assigneeName && <span style={{ fontSize: "11px", color: "#6B7280" }}>· {assigneeName}</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <button onClick={onEdit} title="Bearbeiten"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "12px", padding: "0 2px" }}>
          ✎
        </button>
        <button onClick={onCopy} title="Kopieren"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "12px", padding: "0 2px" }}>
          ⧉
        </button>
        <button onClick={onDelete} title="Löschen"
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: "14px", padding: "0 2px", lineHeight: 1 }}>
          ×
        </button>
      </div>
    </div>
  );
}
