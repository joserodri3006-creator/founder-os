import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const venture = req.nextUrl.searchParams.get("venture");
  const status  = req.nextUrl.searchParams.get("status");

  let query = supabaseAdmin
    .from("returns")
    .select(`*, order:orders(id, title, invoice_number, value)`)
    .order("requested_at", { ascending: false });

  if (venture && venture !== "alle") query = query.eq("venture", venture);
  if (status && status !== "alle")   query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin.from("returns").insert(body).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
