"use client";

import { useState, type ComponentProps } from "react";
import Link from "next/link";
import {
  DndContext, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface ListTask {
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

export const STATUS_LABELS: Record<ListTask["status"], string> = { open: "Offen", in_progress: "In Bearbeitung", done: "Erledigt" };
const PRIORITY_LABELS: Record<ListTask["priority"], string> = { low: "Niedrig", medium: "Mittel", high: "Hoch" };
const PRIORITY_COLORS: Record<ListTask["priority"], { bg: string; color: string }> = {
  low: { bg: "#F3F4F6", color: "#4B5563" },
  medium: { bg: "#FEF9C3", color: "#A16207" },
  high: { bg: "#FEE2E2", color: "#B91C1C" },
};

function isOverdue(task: ListTask) {
  if (task.status === "done" || !task.due_date) return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

interface Props {
  tasks: ListTask[];
  members: TeamMember[];
  editingId: string | null;
  onStatusChange: (task: ListTask, status: ListTask["status"]) => void;
  onReorder: (taskId: string, afterId: string | null, beforeId: string | null) => void;
  onEdit: (id: string) => void;
  onEditDone: () => Promise<void>;
  onEditCancel: () => void;
  onCopy: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function TasksList({ tasks, members, editingId, onStatusChange, onReorder, onEdit, onEditDone, onEditCancel, onCopy, onDelete }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const memberName = (id: string | null) => members.find(m => m.user_id === id)?.name ?? null;

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tasks.findIndex(t => t.id === active.id);
    const newIndex = tasks.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(tasks, oldIndex, newIndex);
    const idx = reordered.findIndex(t => t.id === active.id);
    onReorder(
      String(active.id),
      idx > 0 ? reordered[idx - 1].id : null,
      idx < reordered.length - 1 ? reordered[idx + 1].id : null
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {tasks.map(task => (
            editingId === task.id ? (
              <TaskEditForm key={task.id} task={task} members={members} onDone={onEditDone} onCancel={onEditCancel} />
            ) : (
              <SortableTaskRow
                key={task.id}
                task={task}
                assigneeName={memberName(task.assigned_to)}
                onStatusChange={(s) => onStatusChange(task, s)}
                onEdit={() => onEdit(task.id)}
                onCopy={() => onCopy(task.id)}
                onDelete={() => onDelete(task.id)}
              />
            )
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function DragHandle(props: ComponentProps<"button">) {
  return (
    <button type="button" aria-label="Reihenfolge ändern" {...props}
      className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none shrink-0 px-0.5">
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="2.5" cy="2.5" r="1.5" /><circle cx="7.5" cy="2.5" r="1.5" />
        <circle cx="2.5" cy="8" r="1.5" /><circle cx="7.5" cy="8" r="1.5" />
        <circle cx="2.5" cy="13.5" r="1.5" /><circle cx="7.5" cy="13.5" r="1.5" />
      </svg>
    </button>
  );
}

function SortableTaskRow({ task, assigneeName, onStatusChange, onEdit, onCopy, onDelete }: {
  task: ListTask; assigneeName: string | null;
  onStatusChange: (status: ListTask["status"]) => void;
  onEdit: () => void; onCopy: () => void; onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const overdue = isOverdue(task);
  const pc = PRIORITY_COLORS[task.priority];

  return (
    <div ref={setNodeRef} style={style}
      className={`bg-white rounded-lg border px-3 py-3 md:py-2 flex flex-col md:flex-row md:items-center gap-2 ${overdue ? "border-red-200" : "border-gray-200"}`}>
      <div className="flex items-center gap-2 md:contents">
        <DragHandle {...listeners} {...attributes} />
        <select value={task.status} onChange={e => onStatusChange(e.target.value as ListTask["status"])}
          className="text-xs border border-gray-200 rounded px-1.5 py-1 bg-white shrink-0">
          {(Object.keys(STATUS_LABELS) as ListTask["status"][]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        <p className={`text-sm font-medium min-w-0 truncate flex-1 md:flex-initial ${task.status === "done" ? "text-gray-400 line-through" : "text-gray-900"}`}>
          {task.title}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap md:contents">
        {task.entity_href && (
          <Link href={task.entity_href} className="text-xs text-blue-600 hover:text-blue-700 shrink-0 truncate max-w-[200px] md:max-w-[160px]">
            {task.entity_name}
            <span className="hidden sm:inline">{task.entity_company ? ` (${task.entity_company})` : ""}</span>
          </Link>
        )}

        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0" style={{ background: pc.bg, color: pc.color }}>
          {PRIORITY_LABELS[task.priority]}
        </span>

        {task.due_date && (
          <span className={`text-xs shrink-0 ${overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
            {overdue ? "Überfällig: " : ""}{new Date(task.due_date).toLocaleDateString("de-DE")}
          </span>
        )}

        {assigneeName && <span className="text-xs text-gray-500 shrink-0">· {assigneeName}</span>}
      </div>

      <div className="flex items-center gap-1 -mx-1 pt-1 md:pt-0 border-t md:border-t-0 border-gray-100 md:contents">
        <button onClick={onEdit} className="text-xs text-gray-400 hover:text-gray-700 min-h-[44px] md:min-h-0 px-2 md:px-0 md:ml-auto md:pl-2">Bearbeiten</button>
        <button onClick={onCopy} className="text-xs text-gray-400 hover:text-gray-700 min-h-[44px] md:min-h-0 px-2 md:px-0">Kopieren</button>
        <button onClick={onDelete} className="text-xs text-gray-400 hover:text-red-600 min-h-[44px] md:min-h-0 px-2 md:px-0">Löschen</button>
      </div>
    </div>
  );
}

function TaskEditForm({ task, members, onDone, onCancel }: {
  task: ListTask; members: TeamMember[]; onDone: () => Promise<void>; onCancel: () => void;
}) {
  const { setNodeRef, transform, transition } = useSortable({ id: task.id, disabled: true });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description ?? "");
  const [priority, setPriority] = useState<ListTask["priority"]>(task.priority);
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
    <div ref={setNodeRef} style={style} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titel"
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 mb-2" />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Beschreibung (optional)" rows={2}
        className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 mb-2 resize-y" />
      <div className="flex gap-2 flex-wrap mb-3">
        <select value={priority} onChange={e => setPriority(e.target.value as ListTask["priority"])}
          className="text-sm border border-gray-200 rounded-md px-2 py-1.5 bg-white flex-1 min-w-[110px]">
          {(Object.keys(PRIORITY_LABELS) as ListTask["priority"][]).map(p => (
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
