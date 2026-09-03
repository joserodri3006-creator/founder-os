import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { addIgnoredId, linkUpdateForEntity, payloadFromInboxMessage } from "@/lib/inbox-actions";

type Params = { params: Promise<{ id: string }> };

type EntityType = "lead" | "customer" | "supplier";

type ActionBody =
  | { action: "link"; entity_type: EntityType; entity_id: string }
  | { action: "ignore" }
  | { action: "create"; entity_type: EntityType; company_name?: string; first_name?: string; last_name?: string; notes?: string };

function missingMessage() {
  return NextResponse.json({ error: "Inbox-Nachricht nicht gefunden" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as ActionBody;

  if (body.action === "ignore") {
    const { data: message, error: messageError } = await supabaseAdmin
      .from("inbox_messages")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });
    if (!message) return missingMessage();

    const { data: config } = await supabaseAdmin
      .from("system_config")
      .select("value")
      .eq("key", "inbox_ignored_message_ids")
      .maybeSingle();

    const { error } = await supabaseAdmin.from("system_config").upsert({
      key: "inbox_ignored_message_ids",
      value: addIgnoredId(config?.value, id),
      description: "Founder OS Inbox: ausgeblendete/ignorierte Nachrichten-IDs",
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  if (body.action === "link") {
    let update: Record<string, string | null>;
    try {
      update = linkUpdateForEntity(body.entity_type, body.entity_id);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Ungültige Verknüpfung" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("inbox_messages")
      .update(update)
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return missingMessage();

    if (body.entity_type === "lead") {
      await supabaseAdmin.from("lead_activities").insert({
        lead_id: body.entity_id,
        activity_type: "email_received",
        description: "E-Mail aus Founder-OS-Inbox manuell verknüpft",
      });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "action muss link oder ignore sein" }, { status: 400 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as ActionBody;
  if (body.action !== "create") {
    return NextResponse.json({ error: "action muss create sein" }, { status: 400 });
  }

  const { data: message, error: messageError } = await supabaseAdmin
    .from("inbox_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });
  if (!message) return missingMessage();

  const tableByType: Record<EntityType, "leads" | "customers" | "suppliers"> = {
    lead: "leads",
    customer: "customers",
    supplier: "suppliers",
  };
  const table = tableByType[body.entity_type];
  if (!table) return NextResponse.json({ error: "entity_type muss lead, customer oder supplier sein" }, { status: 400 });

  const payload = payloadFromInboxMessage(body.entity_type, message, {
    company_name: body.company_name,
    first_name: body.first_name,
    last_name: body.last_name,
    notes: body.notes,
  });

  const { data: existing } = await supabaseAdmin
    .from(table)
    .select("id")
    .eq("venture", payload.venture)
    .eq("email", payload.email)
    .maybeSingle();

  if (existing?.id) {
    const { error: linkError } = await supabaseAdmin
      .from("inbox_messages")
      .update(linkUpdateForEntity(body.entity_type, existing.id))
      .eq("id", id);
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
    return NextResponse.json({ success: true, duplicate: true, entity_type: body.entity_type, entity_id: existing.id });
  }

  const { data: entity, error: entityError } = await supabaseAdmin
    .from(table)
    .insert(payload)
    .select("*")
    .single();
  if (entityError || !entity) return NextResponse.json({ error: entityError?.message ?? "Datensatz konnte nicht angelegt werden" }, { status: 500 });

  const { error: linkError } = await supabaseAdmin
    .from("inbox_messages")
    .update(linkUpdateForEntity(body.entity_type, entity.id))
    .eq("id", id);
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  if (body.entity_type === "lead") {
    await supabaseAdmin.from("lead_activities").insert({
      lead_id: entity.id,
      activity_type: "email_received",
      description: `Lead aus Inbox-Mail angelegt: ${message.subject || "(ohne Betreff)"}`,
    });
  }
  return NextResponse.json({ success: true, duplicate: false, entity_type: body.entity_type, entity }, { status: 201 });
}
