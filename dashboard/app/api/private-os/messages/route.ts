import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requireFounder } from "@/lib/private-os-auth";

const VALID_PROVIDERS = new Set(["instagram", "whatsapp", "all"]);

type ThreadRow = {
  id: string;
  provider: "instagram" | "whatsapp";
  contact_id: string | null;
  title: string | null;
  status: string;
  is_group: boolean;
  last_message_at: string | null;
  last_message_text: string | null;
  unread_count: number;
  private_os_contacts?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_tracked: boolean;
  } | null;
};

function tableMissing(error: { code?: string; message?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("private_os_");
}

export async function GET(req: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider") ?? "instagram";
  const trackedOnly = searchParams.get("tracked_only") !== "false";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 250);

  if (!VALID_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: "provider muss instagram, whatsapp oder all sein" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("private_os_threads")
    .select(trackedOnly
      ? "*, private_os_contacts!inner(display_name, username, avatar_url, is_tracked)"
      : "*, private_os_contacts(display_name, username, avatar_url, is_tracked)")
    .neq("status", "archived")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (provider !== "all") query = query.eq("provider", provider);
  if (trackedOnly) query = query.eq("private_os_contacts.is_tracked", true);

  const { data, error } = await query;
  if (error) {
    if (tableMissing(error)) {
      return NextResponse.json({ error: "Private-OS-Messaging-Tabellen sind noch nicht migriert." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ThreadRow[];
  return NextResponse.json(rows.map((thread) => ({
    ...thread,
    display_name: thread.private_os_contacts?.display_name ?? thread.title ?? "Unbekannter Kontakt",
    username: thread.private_os_contacts?.username ?? null,
    avatar_url: thread.private_os_contacts?.avatar_url ?? null,
    is_tracked: thread.private_os_contacts?.is_tracked ?? false,
  })));
}
