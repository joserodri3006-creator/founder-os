import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type InboxMessage = {
  id: string;
  venture: string;
  account_email: string;
  provider: string;
  from_email: string;
  from_name: string | null;
  subject: string | null;
  body_preview: string | null;
  body_text: string | null;
  received_at: string;
  match_status: "matched_lead" | "matched_customer" | "matched_supplier" | "unmatched";
  lead_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  has_attachments: boolean;
  attachment_names: string[];
};

function tableMissing(error: { message?: string; code?: string } | null) {
  return error?.code === "42P01" || error?.message?.includes("inbox_messages");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const venture = searchParams.get("venture");
  const entityType = searchParams.get("entity_type");
  const entityId = searchParams.get("entity_id");
  const matchStatus = searchParams.get("match_status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100", 10) || 100, 200);

  let query = supabaseAdmin
    .from("inbox_messages")
    .select("*")
    .order("received_at", { ascending: false })
    .limit(limit);

  if (venture) query = query.eq("venture", venture);
  if (matchStatus && matchStatus !== "alle") query = query.eq("match_status", matchStatus);

  if (entityType && entityId) {
    if (entityType === "lead") query = query.eq("lead_id", entityId);
    else if (entityType === "customer") query = query.eq("customer_id", entityId);
    else if (entityType === "supplier") query = query.eq("supplier_id", entityId);
    else return NextResponse.json({ error: "entity_type muss lead, customer oder supplier sein" }, { status: 400 });
  }

  const { data, error } = await query;
  if (error) {
    if (tableMissing(error)) {
      return NextResponse.json({ error: "Inbox-Tabelle ist noch nicht migriert." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messages = (data ?? []) as InboxMessage[];
  if (entityType && entityId) return NextResponse.json(messages);

  const leadIds = [...new Set(messages.map((m) => m.lead_id).filter(Boolean))] as string[];
  const customerIds = [...new Set(messages.map((m) => m.customer_id).filter(Boolean))] as string[];
  const supplierIds = [...new Set(messages.map((m) => m.supplier_id).filter(Boolean))] as string[];

  const [leadsRes, customersRes, suppliersRes] = await Promise.all([
    leadIds.length
      ? supabaseAdmin.from("leads").select("id, first_name, last_name, company_name").in("id", leadIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; company_name: string | null }[] }),
    customerIds.length
      ? supabaseAdmin.from("customers").select("id, first_name, last_name, company_name").in("id", customerIds)
      : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string; company_name: string | null }[] }),
    supplierIds.length
      ? supabaseAdmin.from("suppliers").select("id, name, contact_name").in("id", supplierIds)
      : Promise.resolve({ data: [] as { id: string; name: string; contact_name: string | null }[] }),
  ]);

  const leadMap = new Map((leadsRes.data ?? []).map((l) => [l.id, l]));
  const customerMap = new Map((customersRes.data ?? []).map((c) => [c.id, c]));
  const supplierMap = new Map((suppliersRes.data ?? []).map((s) => [s.id, s]));

  const enriched = messages.map((m) => {
    if (m.lead_id) {
      const lead = leadMap.get(m.lead_id);
      return {
        ...m,
        entity_type: "lead",
        entity_name: lead ? `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || lead.company_name : null,
        entity_company: lead?.company_name ?? null,
        entity_href: `/leads/${m.lead_id}`,
      };
    }
    if (m.customer_id) {
      const customer = customerMap.get(m.customer_id);
      return {
        ...m,
        entity_type: "customer",
        entity_name: customer ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim() || customer.company_name : null,
        entity_company: customer?.company_name ?? null,
        entity_href: `/kunden/${m.customer_id}`,
      };
    }
    if (m.supplier_id) {
      const supplier = supplierMap.get(m.supplier_id);
      return {
        ...m,
        entity_type: "supplier",
        entity_name: supplier?.name ?? null,
        entity_company: supplier?.contact_name ?? null,
        entity_href: "/einstellungen/lieferanten",
      };
    }
    return { ...m, entity_type: null, entity_name: null, entity_company: null, entity_href: null };
  });

  return NextResponse.json(enriched);
}
