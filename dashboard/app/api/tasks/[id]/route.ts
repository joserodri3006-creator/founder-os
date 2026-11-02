import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };
type RecurrenceRule = "daily" | "weekly" | "monthly" | "yearly";

const ALLOWED = ["title", "description", "status", "priority", "due_date", "assigned_to", "recurrence_rule", "recurrence_end_date", "checklist"];

function nextOccurrence(date: string | null, rule: RecurrenceRule): string | null {
  if (!date) return null;
  const next = new Date(`${date}T12:00:00Z`);
  if (rule === "daily") next.setUTCDate(next.getUTCDate() + 1);
  if (rule === "weekly") next.setUTCDate(next.getUTCDate() + 7);
  if (rule === "monthly") next.setUTCMonth(next.getUTCMonth() + 1);
  if (rule === "yearly") next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next.toISOString().slice(0, 10);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const updates: Record<string, unknown> = {};
  for (const key of ALLOWED) if (key in body) updates[key] = body[key];

  const { data: original, error: originalError } = await supabaseAdmin
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();
  if (originalError || !original) return NextResponse.json({ error: "Aufgabe nicht gefunden" }, { status: 404 });

  if ("status" in updates) {
    updates.completed_at = updates.status === "done" ? new Date().toISOString() : null;
  }
  if ("checklist" in updates && !Array.isArray(updates.checklist)) {
    return NextResponse.json({ error: "checklist muss ein Array sein" }, { status: 400 });
  }

  if (Object.keys(updates).length === 0) return NextResponse.json({ success: true });

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Beim erstmaligen Erledigen wird die nächste Instanz automatisch oben angelegt.
  const becameDone = original.status !== "done" && updates.status === "done";
  const rule = (updates.recurrence_rule ?? original.recurrence_rule) as RecurrenceRule | null;
  if (becameDone && rule) {
    const nextDueDate = nextOccurrence((updates.due_date ?? original.due_date) as string | null, rule);
    const endDate = (updates.recurrence_end_date ?? original.recurrence_end_date) as string | null;
    if (!endDate || (nextDueDate && nextDueDate <= endDate)) {
      const { data: minRow } = await supabaseAdmin
        .from("tasks")
        .select("sort_order")
        .eq("venture", original.venture)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle();
      await supabaseAdmin.from("tasks").insert({
        venture: original.venture,
        entity_type: original.entity_type,
        entity_id: original.entity_id,
        title: original.title,
        description: updates.description ?? original.description,
        status: "open",
        priority: updates.priority ?? original.priority,
        due_date: nextDueDate,
        assigned_to: updates.assigned_to ?? original.assigned_to,
        recurrence_rule: rule,
        recurrence_end_date: endDate,
        checklist: Array.isArray(updates.checklist) ? updates.checklist : (original.checklist ?? []),
        parent_task_id: original.parent_task_id ?? original.id,
        sort_order: (minRow?.sort_order ?? 0) - 1,
      });
    }
  }

  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
