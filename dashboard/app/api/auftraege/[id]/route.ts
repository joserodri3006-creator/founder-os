import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { shouldCreateReviewInvitation } from "@/lib/review-domain";
import { createReviewInvitation } from "@/lib/review-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(`*, customer:customers(id, first_name, last_name, company_name, email, phone, city, venture)`)
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { data: before } = await supabaseAdmin
    .from("orders")
    .select("status,venture,title,customer_id,customer:customers(id,first_name,last_name,email)")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabaseAdmin.from("orders").update(body).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let review: unknown = null;
  const customer = before?.customer as unknown as { id: string; first_name: string | null; last_name: string | null; email: string | null } | null;
  if (before && process.env.REVIEW_INVITES_ENABLED === "true" && shouldCreateReviewInvitation({
    venture: before.venture,
    previousStatus: before.status,
    nextStatus: body?.status ?? before.status,
    customerEmail: customer?.email ?? null,
  })) {
    try {
      const result = await createReviewInvitation({
        venture: before.venture,
        customerId: before.customer_id,
        orderId: id,
        email: customer!.email!,
        customerName: [customer?.first_name, customer?.last_name].filter(Boolean).join(" "),
        orderTitle: before.title ?? "Bestellung",
      });
      review = { created: result.created, sent: "sent" in result ? result.sent : false, warning: "warning" in result ? result.warning : null };
      if (result.created) {
        await supabaseAdmin.from("order_activities").insert({
          order_id: id,
          activity_type: "review_invited",
          description: result.sent ? "Neutrale Bewertungseinladung versendet" : "Bewertungseinladung angelegt (nicht versendet)",
        });
      }
    } catch (err) {
      review = { created: false, error: err instanceof Error ? err.message : "Einladung fehlgeschlagen" };
    }
  }
  return NextResponse.json({ success: true, review });
}

export async function PUT(req: NextRequest, { params }: Params) {
  return PATCH(req, { params });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await supabaseAdmin.from("orders").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
