"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable,
  type DragEndEvent, type DragStartEvent, type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, verticalListSortingStrategy,
  sortableKeyboardCoordinates, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

export interface PipelineTask {
  id: string;
  title: string;
  status: "open" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  due_date: string | null;
  assigned_to: string | null;
  sort_order: number;
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

function groupByStatus(tasks: PipelineTask[]): Record<PipelineTask["status"], PipelineTask[]> {
  const sorted = [...tasks].sort((a, b) => a.sort_order - b.sort_order);
  return {
    open: sorted.filter(t => t.status === "open"),
    in_progress: sorted.filter(t => t.status === "in_progress"),
    done: sorted.filter(t => t.status === "done"),
  };
}

interface Props {
  tasks: PipelineTask[];
  members: TeamMember[];
  onReorder: (taskId: string, afterId: string | null, beforeId: string | null, newStatus?: PipelineTask["status"]) => void;
}

export default function TasksPipeline({ tasks, members, onReorder }: Props) {
  const [columns, setColumns] = useState<Record<PipelineTask["status"], PipelineTask[]>>(() => groupByStatus(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId) setColumns(groupByStatus(tasks));
  }, [tasks, activeId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const memberName = (id: string | null) => members.find(m => m.user_id === id)?.name ?? null;

  function findContainer(id: string): PipelineTask["status"] | undefined {
    if (id === "open" || id === "in_progress" || id === "done") return id;
    for (const key of Object.keys(columns) as PipelineTask["status"][]) {
      if (columns[key].some(t => t.id === id)) return key;
    }
    return undefined;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    if (!activeContainer || !overContainer || activeContainer === overContainer) return;

    setColumns(prev => {
      const activeItems = prev[activeContainer];
      const overItems = prev[overContainer];
      const activeIndex = activeItems.findIndex(t => t.id === activeId);
      if (activeIndex === -1) return prev;
      const overIndex = overItems.findIndex(t => t.id === overId);
      const newIndex = overIndex >= 0 ? overIndex : overItems.length;
      const moved = { ...activeItems[activeIndex], status: overContainer };
      return {
        ...prev,
        [activeContainer]: activeItems.filter(t => t.id !== activeId),
        [overContainer]: [...overItems.slice(0, newIndex), moved, ...overItems.slice(newIndex)],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeId = String(active.id);
    setActiveId(null);
    if (!over) return;

    const container = findContainer(activeId);
    if (!container) return;
    const items = columns[container];
    const activeIndex = items.findIndex(t => t.id === activeId);
    if (activeIndex === -1) return;
    const overContainer = findContainer(String(over.id));
    const overIndex = overContainer === container ? items.findIndex(t => t.id === String(over.id)) : items.length - 1;
    const reordered = arrayMove(items, activeIndex, overIndex >= 0 ? overIndex : items.length - 1);
    setColumns(prev => ({ ...prev, [container]: reordered }));

    const idx = reordered.findIndex(t => t.id === activeId);
    const afterId = idx > 0 ? reordered[idx - 1].id : null;
    const beforeId = idx < reordered.length - 1 ? reordered[idx + 1].id : null;
    const originalTask = tasks.find(t => t.id === activeId);
    onReorder(activeId, afterId, beforeId, originalTask && container !== originalTask.status ? container : undefined);
  }

  const activeTask = activeId ? tasks.find(t => t.id === activeId) ?? null : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-4 overflow-x-auto pb-2">
        {COLUMNS.map(col => (
          <PipelineColumn
            key={col.key}
            statusKey={col.key}
            label={col.label}
            tasks={columns[col.key]}
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
  const { setNodeRef, isOver } = useDroppable({ id: statusKey });
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
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableCard key={task.id} task={task} assigneeName={memberName(task.assigned_to)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableCard({ task, assigneeName }: { task: PipelineTask; assigneeName: string | null }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
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
