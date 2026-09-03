import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { addIgnoredId, linkUpdateForEntity, payloadFromInboxMessage } from "@/lib/inbox-actions";

type Params = { params: Promise<{ id: string }> };

type EntityType = "lead" | "customer" | "supplier";

type ActionBody =
  | { action: "link"; entity_type: EntityType; entity_id: string; apply_to_sender?: boolean }
  | { action: "ignore"; apply_to_sender?: boolean }
  | { action: "create"; entity_type: EntityType; company_name?: string; first_name?: string; last_name?: string; notes?: string; apply_to_sender?: boolean }
  | { action: "mail_archive" | "mail_delete" | "mail_send" };

const MAIL_ACTIONS_KEY = "inbox_pending_mail_actions";

function missingMessage() {
  return NextResponse.json({ error: "Inbox-Nachricht nicht gefunden" }, { status: 404 });
}

function parseMailActions(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function queueMailAction(messageId: string, action: "mail_archive" | "mail_delete" | "mail_send") {
  const { data: message, error: messageError } = await supabaseAdmin
    .from("inbox_messages")
    .select("id,venture,account_id,account_email,provider,folder,message_uid,subject,from_email,received_at")
    .eq("id", messageId)
    .maybeSingle();
  if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });
  if (!message) return missingMessage();

  if (action === "mail_send" && message.folder !== "drafts") {
    return NextResponse.json({ error: "Senden ist nur für Entwürfe möglich." }, { status: 400 });
  }
  if (action === "mail_archive" && message.folder !== "INBOX") {
    return NextResponse.json({ error: "Archivieren ist nur für Eingangsmails möglich." }, { status: 400 });
  }

  const { data: config } = await supabaseAdmin
    .from("system_config")
    .select("value")
    .eq("key", MAIL_ACTIONS_KEY)
    .maybeSingle();
  const actions = parseMailActions(config?.value);
  const queued = {
    id: crypto.randomUUID(),
    status: "queued",
    action,
    message,
    queued_at: new Date().toISOString(),
  };
  actions.push(queued);
  const { error } = await supabaseAdmin.from("system_config").upsert({
    key: MAIL_ACTIONS_KEY,
    value: JSON.stringify(actions),
    description: "Founder OS Inbox: freigegebene Mailbox-Aktionen für lokalen Worker",
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, queued: true, action_id: queued.id });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = (await req.json()) as ActionBody;

  if (["mail_archive", "mail_delete", "mail_send"].includes(body.action)) {
    return queueMailAction(id, body.action as "mail_archive" | "mail_delete" | "mail_send");
  }

  if (body.action === "ignore") {
    const { data: message, error: messageError } = await supabaseAdmin
      .from("inbox_messages")
      .select("id,venture,from_email")
      .eq("id", id)
      .maybeSingle();
    if (messageError) return NextResponse.json({ error: messageError.message }, { status: 500 });
    if (!message) return missingMessage();

    let ids = [message.id];
    if (body.apply_to_sender) {
      const { data: sameSender } = await supabaseAdmin
        .from("inbox_messages")
        .select("id")
        .eq("venture", message.venture)
        .eq("from_email", message.from_email);
      ids = (sameSender ?? []).map((row) => row.id);
    }

    const { data: config } = await supabaseAdmin
      .from("system_config")
      .select("value")
      .eq("key", "inbox_ignored_message_ids")
      .maybeSingle();

    const value = ids.reduce((current, messageId) => addIgnoredId(current, messageId), config?.value ?? "[]");
    const { error } = await supabaseAdmin.from("system_config").upsert({
      key: "inbox_ignored_message_ids",
      value,
      description: "Founder OS Inbox: ausgeblendete/ignorierte Nachrichten-IDs",
      updated_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, affected: ids.length });
  }

  if (body.action === "link") {
    let update: Record<string, string | null>;
    try {
      update = linkUpdateForEntity(body.entity_type, body.entity_id);
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : "Ungültige Verknüpfung" }, { status: 400 });
    }

    const { data: sourceMessage, error: sourceError } = await supabaseAdmin
      .from("inbox_messages")
      .select("id,venture,from_email")
      .eq("id", id)
      .maybeSingle();
    if (sourceError) return NextResponse.json({ error: sourceError.message }, { status: 500 });
    if (!sourceMessage) return missingMessage();

    let updateQuery = supabaseAdmin.from("inbox_messages").update(update);
    if (body.apply_to_sender) {
      updateQuery = updateQuery.eq("venture", sourceMessage.venture).eq("from_email", sourceMessage.from_email);
    } else {
      updateQuery = updateQuery.eq("id", id);
    }
    const { data, error } = await updateQuery.select("id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.length) return missingMessage();

    if (body.entity_type === "lead") {
      await supabaseAdmin.from("lead_activities").insert({
        lead_id: body.entity_id,
        activity_type: "email_received",
        description: "E-Mail aus Founder-OS-Inbox manuell verknüpft",
      });
    }

    return NextResponse.json({ success: true, affected: data.length });
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
    let linkQuery = supabaseAdmin.from("inbox_messages").update(linkUpdateForEntity(body.entity_type, existing.id));
    linkQuery = body.apply_to_sender
      ? linkQuery.eq("venture", message.venture).eq("from_email", message.from_email)
      : linkQuery.eq("id", id);
    const { data: linkedRows, error: linkError } = await linkQuery.select("id");
    if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
    return NextResponse.json({ success: true, duplicate: true, entity_type: body.entity_type, entity_id: existing.id, affected: linkedRows?.length ?? 0 });
  }

  const { data: entity, error: entityError } = await supabaseAdmin
    .from(table)
    .insert(payload)
    .select("*")
    .single();
  if (entityError || !entity) return NextResponse.json({ error: entityError?.message ?? "Datensatz konnte nicht angelegt werden" }, { status: 500 });

  let linkQuery = supabaseAdmin.from("inbox_messages").update(linkUpdateForEntity(body.entity_type, entity.id));
  linkQuery = body.apply_to_sender
    ? linkQuery.eq("venture", message.venture).eq("from_email", message.from_email)
    : linkQuery.eq("id", id);
  const { data: linkedRows, error: linkError } = await linkQuery.select("id");
  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });

  if (body.entity_type === "lead") {
    await supabaseAdmin.from("lead_activities").insert({
      lead_id: entity.id,
      activity_type: "email_received",
      description: `Lead aus Inbox-Mail angelegt: ${message.subject || "(ohne Betreff)"}`,
    });
  }
  return NextResponse.json({ success: true, duplicate: false, entity_type: body.entity_type, entity, affected: linkedRows?.length ?? 0 }, { status: 201 });
}
