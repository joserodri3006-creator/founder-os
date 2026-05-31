import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const REVIEW_COLUMNS = [
  "review_status",
  "lead_potential",
  "contact_channel",
  "next_action",
  "review_notes",
  "reviewed_at",
];

function isMissingReviewColumnError(message: string | undefined) {
  return Boolean(message && REVIEW_COLUMNS.some((column) => message.includes(column)));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const source = searchParams.get("source");
  const venture = searchParams.get("venture");
  const showArchived = searchParams.get("archived") === "true";

  const baseSelect = "id,first_name,last_name,email,company_name,status,source,city,industry,follow_up_date,ai_draft_approved,archived_at,created_at,venture,is_duplicate";
  const reviewSelect = `${baseSelect},review_status,lead_potential,contact_channel,next_action`;

  function buildQuery(select: string) {
    let query = supabaseAdmin
      .from("leads")
      .select(select)
      .order("created_at", { ascending: false });

    if (showArchived) {
      query = query.not("archived_at", "is", null);
    } else {
      query = query.is("archived_at", null);
    }

    if (status && status !== "alle") query = query.eq("status", status);
    if (source && source !== "alle") query = query.eq("source", source);
    if (venture && venture !== "alle") query = query.eq("venture", venture);

    return query;
  }

  const { data, error } = await buildQuery(reviewSelect);
  if (!error) return NextResponse.json(data ?? []);

  if (!isMissingReviewColumnError(error.message)) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const fallback = await buildQuery(baseSelect);
  if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
  const fallbackLeads = Array.isArray(fallback.data)
    ? fallback.data as unknown as Array<Record<string, unknown>>
    : [];
  return NextResponse.json(
    fallbackLeads.map((lead) => ({
      ...lead,
      review_status: "unreviewed",
      lead_potential: null,
      contact_channel: "unchecked",
      next_action: "website_pruefen",
    }))
  );
}

export async function PATCH(req: NextRequest) {
  const { id, status } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id und status erforderlich" }, { status: 400 });

  const { error } = await supabaseAdmin.from("leads").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const firstName = typeof body.first_name === "string" ? body.first_name.trim() : "";
  const lastName = typeof body.last_name === "string" ? body.last_name.trim() : "";
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const venture = typeof body.venture === "string" ? body.venture : "online_first";
  const allowedSources = ["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"];

  if (!firstName || !lastName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Name und gueltige E-Mail sind erforderlich" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("email", email)
    .eq("venture", venture)
    .maybeSingle();

  const reviewFields = {
    review_status: body.review_status?.trim() || "unreviewed",
    lead_potential: body.lead_potential?.trim() || null,
    contact_channel: body.contact_channel?.trim() || "unchecked",
    next_action: body.next_action?.trim() || "website_pruefen",
    review_notes: body.review_notes?.trim() || null,
  };
  const insertPayload = {
    venture,
    first_name: firstName,
    last_name: lastName,
    email,
    phone: body.phone?.trim() || null,
    company_name: body.company_name?.trim() || null,
    website: body.website?.trim() || null,
    city: body.city?.trim() || null,
    region: body.region?.trim() || "Hessen",
    industry: body.industry?.trim() || null,
    contact_reason: body.contact_reason?.trim() || null,
    notes: body.notes?.trim() || null,
    source: allowedSources.includes(body.source) ? body.source : "website",
    status: "neu",
    automation_enabled: body.automation_enabled ?? true,
    is_duplicate: Boolean(existing),
  };

  let insertResult = await supabaseAdmin
    .from("leads")
    .insert({ ...insertPayload, ...reviewFields })
    .select("id,first_name,last_name,email,status,created_at")
    .single();

  if (isMissingReviewColumnError(insertResult.error?.message)) {
    insertResult = await supabaseAdmin
      .from("leads")
      .insert(insertPayload)
      .select("id,first_name,last_name,email,status,created_at")
      .single();
  }

  const { data: lead, error } = insertResult;

  if (error || !lead) return NextResponse.json({ error: error?.message ?? "Lead konnte nicht angelegt werden" }, { status: 500 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!existing && supabaseUrl && serviceKey) {
    void fetch(`${supabaseUrl}/functions/v1/lead-qualify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ lead_id: lead.id }),
    });
  }
  if (supabaseUrl && serviceKey) {
    void fetch(`${supabaseUrl}/functions/v1/send-notification`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        venture,
        event_type: "new_lead",
        title: `Neuer Lead: ${lead.first_name} ${lead.last_name}`,
        body: lead.email,
        link: `/leads/${lead.id}`,
      }),
    });
  }

  return NextResponse.json({ success: true, duplicate: Boolean(existing), lead }, { status: 201 });
}
