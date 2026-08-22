import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

interface ReorderUpdate {
  id: string;
  sort_order: number;
  status?: "open" | "in_progress" | "done";
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null) as { updates?: ReorderUpdate[] } | null;
  const updates = body?.updates;
  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: "updates (Array) erforderlich" }, { status: 400 });
  }

  const results = await Promise.all(
    updates.map(({ id, sort_order, status }) => {
      const patch: Record<string, unknown> = { sort_order };
      if (status) {
        patch.status = status;
        patch.completed_at = status === "done" ? new Date().toISOString() : null;
      }
      return supabaseAdmin.from("tasks").update(patch).eq("id", id);
    })
  );

  const failed = results.find(r => r.error);
  if (failed?.error) return NextResponse.json({ error: failed.error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
