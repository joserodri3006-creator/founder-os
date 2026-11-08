import { NextRequest, NextResponse } from "next/server";
import { requireFounder } from "@/lib/private-os-auth";
import { createClient } from "@/lib/supabase-server";

const MAX_CONTENT_BYTES = 2_000_000;

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { id } = await context.params;
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
  const update: Record<string, unknown> = {};
  if (typeof input.name === "string" && input.name.trim()) update.name = input.name.trim().slice(0, 160);
  if (input.content && typeof input.content === "object") update.content = input.content;
  if (typeof input.venture === "string") update.venture = input.venture;
  if (input.links && typeof input.links === "object") {
    const rawTaskIds = (input.links as Record<string, unknown>).task_ids;
    update.links = {
      task_ids: Array.isArray(rawTaskIds)
        ? rawTaskIds.filter((taskId: unknown): taskId is string => typeof taskId === "string").slice(0, 100)
        : [],
    };
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Keine änderbaren Daten übergeben." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whiteboards")
    .update(update)
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("archived_at", null)
    .select("id, user_id, venture, name, template_id, content, links, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: "Whiteboard konnte nicht aktualisiert werden." }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireFounder();
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const supabase = await createClient();
  const { error } = await supabase
    .from("whiteboards")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .is("archived_at", null);

  if (error) return NextResponse.json({ error: "Whiteboard konnte nicht archiviert werden." }, { status: 500 });
  return NextResponse.json({ success: true });
}
