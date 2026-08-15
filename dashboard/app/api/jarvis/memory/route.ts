import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { embedText } from "@/lib/voyage-embeddings";

async function requireFounder(req: NextRequest) {
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
  const auth = await requireFounder(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const memoryType = searchParams.get("type");
  const venture = searchParams.get("venture");
  const q = searchParams.get("q");

  let query = supabaseAdmin
    .from("jarvis_memory")
    .select("id,venture,memory_type,content,source,source_ref,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (memoryType) query = query.eq("memory_type", memoryType);
  if (venture) query = query.eq("venture", venture);
  if (q) query = query.ilike("content", `%${q.replace(/[%,]/g, "")}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function PATCH(req: NextRequest) {
  const auth = await requireFounder(req);
  if (auth.error) return auth.error;

  const body = await req.json().catch(() => null) as { id?: string; content?: string } | null;
  const id = body?.id;
  const content = body?.content?.trim();
  if (!id || !content) return NextResponse.json({ error: "id und content erforderlich" }, { status: 400 });

  try {
    const embedding = await embedText(content, "document");
    const { error } = await supabaseAdmin
      .from("jarvis_memory")
      .update({ content, embedding })
      .eq("id", id)
      .eq("user_id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler beim Neu-Einbetten" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireFounder(req);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("jarvis_memory")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
