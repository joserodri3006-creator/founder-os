import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { addIgnoredId, linkUpdateForEntity, leadPayloadFromInboxMessage } from "@/lib/inbox-actions";

type Params = { params: Promise<{ id: string }> };

type ActionBody =
  | { action: "link"; entity_type: "lead" | "customer" | "supplier"; entity_id: string }
  | { action: "ignore" }
  | { action: "create_lead"; company_name?: string; first_name?: string; last_name?: string; notes?: string };

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
  if (body.action !== "create_lead") {
    return NextResponse.json({ error: "action muss create_lead sein" }, { status: 400 });
  }

  const { data: message, error: messageError } = await supabaseAdmin
    .from("inbox_messages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });
  if (!message) return missingMessage();

  const payload = {
    ...leadPayloadFromInboxMessage(message),
    company_name: typeof body.company_name === "string" && body.company_name.trim() ? body.company_name.trim() : null,
    first_name: typeof body.first_name === "string" && body.first_name.trim() ? body.first_name.trim() : leadPayloadFromInboxMessage(message).first_name,
    last_name: typeof body.last_name === "string" && body.last_name.trim() ? body.last_name.trim() : leadPayloadFromInboxMessage(message).last_name,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : leadPayloadFromInboxMessage(message).notes,
  };

  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("venture", payload.venture)
    .eq("email", payload.email)
    .maybeSingle();

  if (existing?.id) {
    const { error: linkError } = await supabaseAdmin
      .from("inbox_messages")
      .update(linkUpdateForEntity("lead", existing.id))
      .eq("id", id);
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
    return NextResponse.json({ success: true, duplicate: true, lead_id: existing.id });
  }

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .insert(payload)
    .select("id,first_name,last_name,email,company_name,venture")
    .single();
  if (leadError || !lead) return NextResponse.json({ error: leadError?.message ?? "Lead konnte nicht angelegt werden" }, { status: 500 });

  const [{ error: linkError }] = await Promise.all([
    supabaseAdmin.from("inbox_messages").update(linkUpdateForEntity("lead", lead.id)).eq("id", id),
    supabaseAdmin.from("lead_activities").insert({
      lead_id: lead.id,
      activity_type: "email_received",
      description: `Lead aus Inbox-Mail angelegt: ${message.subject || "(ohne Betreff)"}`,
    }),
  ]);

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  return NextResponse.json({ success: true, duplicate: false, lead }, { status: 201 });
}
