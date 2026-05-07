import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET /api/notifications?venture=xxx&unread_only=true&limit=50&offset=0
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const venture    = searchParams.get("venture");
  const unreadOnly = searchParams.get("unread_only") === "true";
  const limit      = parseInt(searchParams.get("limit")  ?? "50");
  const offset     = parseInt(searchParams.get("offset") ?? "0");

  let query = supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (venture)    query = query.eq("venture", venture);
  if (unreadOnly) query = query.eq("read", false);

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ungelesen-Count
  let unreadQuery = supabaseAdmin
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);
  if (venture) unreadQuery = unreadQuery.eq("venture", venture);
  const { count: unreadCount } = await unreadQuery;

  return NextResponse.json({
    notifications: data ?? [],
    total:  count ?? 0,
    unread: unreadCount ?? 0,
  });
}

// PATCH /api/notifications  — als gelesen markieren
// Body: { ids: string[] } | { all: true, venture?: string }
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  if (body.all) {
    let query = supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    if (body.venture) query = query.eq("venture", body.venture);
    const { error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .in("id", body.ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "ids[] or all required" }, { status: 400 });
}
