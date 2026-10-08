import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createServerClient } from "@supabase/ssr";

type Params = { params: Promise<{ id: string }> };

async function currentUserId(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  );
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null) as {
    action?: "publish" | "reject" | "flag" | "reply" | "unpublish";
    reason?: string;
    response_text?: string;
  } | null;
  if (!body?.action) return NextResponse.json({ error: "action fehlt" }, { status: 400 });

  const { data: review, error } = await supabaseAdmin.from("reviews").select("id,venture,status,public_consent,rating").eq("id", id).maybeSingle();
  if (error || !review) return NextResponse.json({ error: "Bewertung nicht gefunden" }, { status: 404 });

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { updated_at: now };

  if (body.action === "publish") {
    if (!review.public_consent) return NextResponse.json({ error: "Der Kunde hat der Veröffentlichung nicht zugestimmt." }, { status: 409 });
    update.status = "published";
    update.published_at = now;
    update.moderation_reason = null;
  } else if (body.action === "unpublish") {
    update.status = "pending";
    update.published_at = null;
  } else if (body.action === "reject" || body.action === "flag") {
    const reason = (body.reason ?? "").trim();
    if (!reason) return NextResponse.json({ error: "Ein dokumentierter Grund ist erforderlich." }, { status: 400 });
    update.status = body.action === "reject" ? "rejected" : "flagged";
    update.moderation_reason = reason.slice(0, 500);
    update.published_at = null;
  } else if (body.action === "reply") {
    const text = (body.response_text ?? "").trim();
    if (!text) return NextResponse.json({ error: "Antwort darf nicht leer sein." }, { status: 400 });
    update.response_text = text.slice(0, 1500);
    update.response_at = now;
    update.response_by = await currentUserId(req);
  } else {
    return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin.from("reviews").update(update).eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
