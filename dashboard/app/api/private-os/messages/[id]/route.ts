import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireFounder } from "@/lib/private-os-auth";

type Params = { params: Promise<{ id: string }> };

type MessageRow = {
  id: string;
  provider: "instagram" | "whatsapp";
  thread_id: string;
  contact_id: string | null;
  provider_message_id: string;
  direction: "inbound" | "outbound";
  sender_name: string | null;
  body_text: string | null;
  media: unknown[] | null;
  received_at: string;
  remote_deleted_at: string | null;
  local_deleted_at: string | null;
};

function tableMissing(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("private_os_");
}

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 500);

  const { data, error } = await supabaseAdmin
    .from("private_os_messages")
    .select("*")
    .eq("thread_id", id)
    .is("local_deleted_at", null)
    .order("received_at", { ascending: true })
    .limit(limit);

  if (error) {
    if (tableMissing(error)) {
      return NextResponse.json({ error: "Private-OS-Messaging-Tabellen sind noch nicht migriert." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as MessageRow[]);
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = await req.json() as { action?: string; body_text?: string; message_id?: string };

  const { data: thread, error: threadError } = await supabaseAdmin
    .from("private_os_threads")
    .select("id, provider")
    .eq("id", id)
    .maybeSingle();
  if (threadError) return NextResponse.json({ error: threadError.message }, { status: 500 });
  if (!thread) return NextResponse.json({ error: "Thread nicht gefunden" }, { status: 404 });

  if (body.action === "reply") {
    const text = body.body_text?.trim();
    if (!text) return NextResponse.json({ error: "Antworttext fehlt" }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from("private_os_message_actions")
      .insert({
        provider: thread.provider,
        thread_id: id,
        action: "reply",
        payload: { body_text: text },
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, queued: true, action_id: data.id });
  }

  if (body.action === "delete_local" || body.action === "delete_remote") {
    if (!body.message_id) return NextResponse.json({ error: "message_id fehlt" }, { status: 400 });
    const { data, error } = await supabaseAdmin
      .from("private_os_message_actions")
      .insert({
        provider: thread.provider,
        thread_id: id,
        message_id: body.message_id,
        action: body.action,
        payload: {},
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, queued: true, action_id: data.id });
  }

  return NextResponse.json({ error: "action muss reply, delete_local oder delete_remote sein" }, { status: 400 });
}
