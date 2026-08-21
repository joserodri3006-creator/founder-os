"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, useDraggable, useDroppable,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export interface PipelineTask {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assigned_to: string | null;
  entity_name: string | null;
  entity_company: string | null;
  entity_href: string | null;
}

interface TeamMember { user_id: string; name: string; }

const PRIORITY_LABELS: Record<PipelineTask["priority"], string> = { low: "Niedrig", medium: "Mittel", high: "Hoch" };
const PRIORITY_COLORS: Record<PipelineTask["priority"], { bg: string; color: string }> = {
  low: { bg: "#F3F4F6", color: "#4B5563" },
  medium: { bg: "#FEF9C3", color: "#A16207" },
  high: { bg: "#FEE2E2", color: "#B91C1C" },
};

const COLUMNS: { key: PipelineTask["status"]; label: string }[] = [
  { key: "open", label: "Offen" },
  { key: "in_progress", label: "In Bearbeitung" },
  { key: "done", label: "Erledigt" },
];

function isOverdue(task: PipelineTask) {
  if (task.status === "done" || !task.due_date) return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

interface Props {
  tasks: PipelineTask[];
  members: TeamMember[];
  onStatusChange: (task: PipelineTask, newStatus: PipelineTask["status"]) => void;
}

export default function TasksPipeline({ tasks, members, onStatusChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const memberName = (id: string | null) => members.find(m => m.user_id === id)?.name ?? null;

  function sortByDue(list: PipelineTask[]) {
    return [...list].sort((a, b) => {
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = String(over.id).replace("column-", "") as PipelineTask["status"];
    const task = tasks.find(t => t.id === active.id);
    if (task && task.status !== newStatus) onStatusChange(task, newStatus);
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) ?? null : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map(col => (
          <PipelineColumn
            key={col.key}
            statusKey={col.key}
            label={col.label}
            tasks={sortByDue(tasks.filter(t => t.status === col.key))}
            memberName={memberName}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <PipelineCard task={activeTask} assigneeName={memberName(activeTask.assigned_to)} overlay />}
      </DragOverlay>
    </DndContext>
  );
}

function PipelineColumn({ statusKey, label, tasks, memberName }: {
  statusKey: PipelineTask["status"]; label: string; tasks: PipelineTask[];
  memberName: (id: string | null) => string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column-${statusKey}` });
  return (
    <div className="flex-1 min-w-[260px]">
      <div className="text-sm font-medium text-gray-700 mb-2 px-1">
        {label} <span className="text-gray-400 font-normal">({tasks.length})</span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[160px] rounded-lg border p-2 transition-colors ${
          isOver ? "border-blue-300 bg-blue-50" : "border-gray-100 bg-gray-50/50"
        }`}
      >
        {tasks.map(task => (
          <DraggableCard key={task.id} task={task} assigneeName={memberName(task.assigned_to)} />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ task, assigneeName }: { task: PipelineTask; assigneeName: string | null }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : 1 }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <PipelineCard task={task} assigneeName={assigneeName} />
    </div>
  );
}

function PipelineCard({ task, assigneeName, overlay }: { task: PipelineTask; assigneeName: string | null; overlay?: boolean }) {
  const overdue = isOverdue(task);
  const pc = PRIORITY_COLORS[task.priority];
  return (
    <div
      className={`bg-white rounded-md border px-3 py-2.5 text-sm cursor-grab active:cursor-grabbing touch-none ${
        overdue ? "border-red-200" : "border-gray-200"
      } ${overlay ? "shadow-lg rotate-1" : ""}`}
    >
      <p className="font-medium text-gray-900 mb-1">{task.title}</p>
      {task.entity_href && (
        <Link
          href={task.entity_href}
          onClick={(e) => e.stopPropagation()}
          className="text-xs text-blue-600 hover:text-blue-700 block mb-1 truncate"
        >
          {task.entity_name}{task.entity_company ? ` (${task.entity_company})` : ""}
        </Link>
      )}
      <div className="flex items-center gap-1.5 flex-wrap text-xs">
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
  );
}
