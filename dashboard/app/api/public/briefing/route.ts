import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cleanText, enforcePublicRateLimit, salesError } from "@/lib/public-sales";

export async function POST(req: NextRequest) {
  const limited = await enforcePublicRateLimit(req, "briefing", 10);
  if (limited) return limited;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const token = cleanText(body?.token, 200);
  if (!token) return salesError("Ungueltiger Briefing-Link.", 403);

  const { data: order, error } = await supabaseAdmin
    .from("orders")
    .select("id,briefing_completed_at")
    .eq("briefing_token", token)
    .single();
  if (error || !order) return salesError("Ungueltiger Briefing-Link.", 403);
  if (order.briefing_completed_at) return salesError("Dieses Briefing wurde bereits eingereicht.", 409);

  const required = [
    "business_description",
    "target_audience",
    "core_offer",
    "primary_call_to_action",
    "preferred_pages",
  ];
  if (required.some((key) => !cleanText(body?.[key], 4000))) {
    return salesError("Bitte fuellen Sie alle Pflichtfelder aus.");
  }

  const submittedAt = new Date().toISOString();
  const { error: briefingError } = await supabaseAdmin.from("project_briefings").insert({
    order_id: order.id,
    business_description: cleanText(body?.business_description, 4000),
    target_audience: cleanText(body?.target_audience, 4000),
    core_offer: cleanText(body?.core_offer, 4000),
    primary_call_to_action: cleanText(body?.primary_call_to_action, 1000),
    preferred_pages: cleanText(body?.preferred_pages, 1000),
    visual_direction: cleanText(body?.visual_direction, 2000) || null,
    existing_assets: cleanText(body?.existing_assets, 2000) || null,
    domain_access: cleanText(body?.domain_access, 1000) || null,
    booking_link: cleanText(body?.booking_link, 1000) || null,
    additional_notes: cleanText(body?.additional_notes, 4000) || null,
    submitted_at: submittedAt,
  });
  if (briefingError) return salesError("Das Briefing konnte nicht gespeichert werden.", 500);

  await supabaseAdmin
    .from("orders")
    .update({ briefing_completed_at: submittedAt, status: "in_bearbeitung" })
    .eq("id", order.id);
  await supabaseAdmin.from("order_activities").insert({
    order_id: order.id,
    activity_type: "briefing_received",
    description: "Projektbriefing ueber den Online-First-Funnel eingereicht.",
  });

  return NextResponse.json({ success: true });
}
