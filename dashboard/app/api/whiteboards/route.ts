import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/private-os-auth";
import { createClient } from "@/lib/supabase-server";

const VENTURES = new Set(["online_first", "blazed_outfitters", "droplane", "brandary", "worknest"]);
const MAX_CONTENT_BYTES = 2_000_000;

function validVenture(value: unknown): string | null {
  return typeof value === "string" && VENTURES.has(value) ? value : null;
}

function safeName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 160) : "Unbenanntes Whiteboard";
}

export async function GET(request: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const supabase = await createClient();
  const venture = request.nextUrl.searchParams.get("venture");
  let query = supabase
    .from("whiteboards")
    .select("id, user_id, venture, name, template_id, content, links, created_at, updated_at")
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  if (venture && validVenture(venture)) query = query.eq("venture", venture);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Whiteboards konnten nicht geladen werden." }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_CONTENT_BYTES) {
    return NextResponse.json({ error: "Das Whiteboard ist zu groß für die Speicherung." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Ungültiger Whiteboard-Body." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const content = input.content && typeof input.content === "object" ? input.content : {};
  const links = input.links && typeof input.links === "object" ? input.links : { task_ids: [] };
  const rawTaskIds = (links as Record<string, unknown>).task_ids;
  const taskIds = Array.isArray(rawTaskIds)
    ? rawTaskIds.filter((id: unknown): id is string => typeof id === "string").slice(0, 100)
    : [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whiteboards")
    .insert({
      user_id: auth.user.id,
      venture: validVenture(input.venture),
      name: safeName(input.name),
      template_id: typeof input.template_id === "string" ? input.template_id.slice(0, 80) : "freeform",
      content,
      links: { task_ids: taskIds },
    })
    .select("id, user_id, venture, name, template_id, content, links, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: "Whiteboard konnte nicht gespeichert werden." }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
