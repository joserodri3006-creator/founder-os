import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail } from "@/lib/mail-helpers";

async function requireFounder() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const { data: roleRow } = await supabaseAdmin
    .from("user_venture_roles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (roleRow?.role !== "founder") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function GET(req: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const venture = searchParams.get("venture");

  let query = supabaseAdmin
    .from("jarvis_autonomous_actions")
    .select("id,venture,action_type,entity_type,entity_id,action_payload,reason,status,result,created_at,resolved_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (status) query = query.eq("status", status);
  if (venture) query = query.eq("venture", venture);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// Fuehrt eine genehmigte Aktion tatsaechlich aus. In v1 wird nur 'send_followup_email'
// unterstuetzt (das einzige vom Cron erzeugte Aktions-Muster) — alles andere muesste
// erst einen eigenen Executor bekommen, bevor es hier auto-ausgefuehrt werden darf.
async function executeAction(action: {
  id: string; venture: string; action_type: string; entity_type: string | null;
  entity_id: string | null; action_payload: Record<string, unknown>;
}) {
  if (action.action_type !== "send_followup_email" || action.entity_type !== "lead" || !action.entity_id) {
    throw new Error(`Automatische Ausführung für Aktionstyp '${action.action_type}' nicht unterstützt.`);
  }

  const { data: lead, error: leadError } = await supabaseAdmin
    .from("leads")
    .select("first_name, last_name, email")
    .eq("id", action.entity_id)
    .single();
  if (leadError || !lead) throw new Error("Lead nicht gefunden");
  if (!lead.email) throw new Error("Lead hat keine E-Mail-Adresse");

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY nicht konfiguriert");

  const subject = action.action_payload.subject as string;
  const body = action.action_payload.body as string;
  const sender = getSender(action.venture);
  const recipientName = `${lead.first_name} ${lead.last_name}`.trim();

  const resendRes = await sendMail(RESEND_API_KEY, {
    from: `${sender.name} <${sender.email}>`,
    to: [recipientName ? `${recipientName} <${lead.email}>` : lead.email],
    subject,
    text: body,
  });
  if (!resendRes.ok) throw new Error(`E-Mail-Versand fehlgeschlagen: ${await resendRes.text()}`);

  await supabaseAdmin.from("lead_activities").insert({
    lead_id: action.entity_id,
    activity_type: "email_sent",
    description: `Betreff: ${subject} (Jarvis, vom Founder bestätigt)`,
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null) as { id?: string; approved?: boolean } | null;
  const id = body?.id;
  if (!id || typeof body?.approved !== "boolean") {
    return NextResponse.json({ error: "id und approved erforderlich" }, { status: 400 });
  }

  const { data: action, error: fetchError } = await supabaseAdmin
    .from("jarvis_autonomous_actions")
    .select("id,venture,action_type,entity_type,entity_id,action_payload,status")
    .eq("id", id)
    .single();
  if (fetchError || !action) return NextResponse.json({ error: "Aktion nicht gefunden" }, { status: 404 });
  if (action.status !== "pending") {
    return NextResponse.json({ error: "Aktion ist bereits bearbeitet" }, { status: 409 });
  }

  if (!body.approved) {
    const { error } = await supabaseAdmin
      .from("jarvis_autonomous_actions")
      .update({ status: "rejected", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, status: "rejected" });
  }

  try {
    await executeAction(action);
    await supabaseAdmin
      .from("jarvis_autonomous_actions")
      .update({ status: "executed", result: { sent: true }, resolved_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ success: true, status: "executed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ausführung fehlgeschlagen";
    await supabaseAdmin
      .from("jarvis_autonomous_actions")
      .update({ status: "failed", result: { error: message }, resolved_at: new Date().toISOString() })
      .eq("id", id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
