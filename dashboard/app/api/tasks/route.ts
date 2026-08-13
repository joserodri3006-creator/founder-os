import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");
  const entity_type = searchParams.get("entity_type");
  const entity_id = searchParams.get("entity_id");
  const status = searchParams.get("status");
  const assigned_to = searchParams.get("assigned_to");

  let query = supabaseAdmin.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false });
  if (venture) query = query.eq("venture", venture);
  if (entity_type) query = query.eq("entity_type", entity_type);
  if (entity_id) query = query.eq("entity_id", entity_id);
  if (status && status !== "alle") query = query.eq("status", status);
  if (assigned_to) query = query.eq("assigned_to", assigned_to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tasks = data ?? [];

  // Für die entitätsspezifische Ansicht (Panel auf Lead-/Kundendetail) kennt der
  // Aufrufer die Entität bereits — Anreicherung nur für die globale Übersicht.
  if (entity_type && entity_id) return NextResponse.json(tasks);

  const leadIds = tasks.filter(t => t.entity_type === "lead").map(t => t.entity_id);
  const customerIds = tasks.filter(t => t.entity_type === "customer").map(t => t.entity_id);

  const [leadsRes, customersRes] = await Promise.all([
    leadIds.length
      ? supabaseAdmin.from("leads").select("id, first_name, last_name, company_name").in("id", leadIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; company_name: string | null }[] }),
    customerIds.length
      ? supabaseAdmin.from("customers").select("id, first_name, last_name, company_name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; company_name: string | null }[] }),
  ]);

  const leadMap = new Map((leadsRes.data ?? []).map(l => [l.id, l]));
  const customerMap = new Map((customersRes.data ?? []).map(c => [c.id, c]));

  const enriched = tasks.map(t => {
    const entity = t.entity_type === "lead" ? leadMap.get(t.entity_id) : customerMap.get(t.entity_id);
    return {
      ...t,
      entity_name: entity ? `${entity.first_name} ${entity.last_name}`.trim() : null,
      entity_company: entity?.company_name ?? null,
      entity_href: entity ? `/${t.entity_type === "lead" ? "leads" : "kunden"}/${t.entity_id}` : null,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { venture, entity_type, entity_id, title, description, priority, due_date, assigned_to } = body;

  if (!venture || !entity_type || !entity_id || !title?.trim()) {
    return NextResponse.json({ error: "venture, entity_type, entity_id und title erforderlich" }, { status: 400 });
  }
  if (!["lead", "customer"].includes(entity_type)) {
    return NextResponse.json({ error: "entity_type muss lead oder customer sein" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .insert({
      venture,
      entity_type,
      entity_id,
      title,
      description: description || null,
      priority: priority || "medium",
      due_date: due_date || null,
      assigned_to: assigned_to || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
