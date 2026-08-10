import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get("id");

  if (conversationId) {
    const { data: conv, error: convError } = await supabaseAdmin
      .from("jarvis_conversations")
      .select("id,title,created_at,updated_at")
      .eq("id", conversationId)
      .eq("user_id", user.id)
      .single();
    if (convError || !conv) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const { data: msgs, error: msgsError } = await supabaseAdmin
      .from("jarvis_messages")
      .select("id,role,content,created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    if (msgsError) return NextResponse.json({ error: msgsError.message }, { status: 500 });

    return NextResponse.json({ conversation: conv, messages: msgs ?? [] });
  }

  const { data, error } = await supabaseAdmin
    .from("jarvis_conversations")
    .select("id,title,created_at,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("jarvis_conversations")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
