import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const venture = new URL(req.url).searchParams.get("venture");
  let query = supabaseAdmin
    .from("tax_classes")
    .select("*, rates:tax_rates(*)")
    .order("is_default", { ascending: false })
    .order("created_at");

  if (venture) query = query.eq("venture", venture);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { rates, ...classData } = body;

  const { data: taxClass, error } = await supabaseAdmin
    .from("tax_classes")
    .insert(classData)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Insert rates if provided
  if (rates && Array.isArray(rates) && rates.length > 0) {
    await supabaseAdmin.from("tax_rates").insert(
      rates.map((r: any) => ({ ...r, tax_class_id: taxClass.id }))
    );
  }

  return NextResponse.json(taxClass, { status: 201 });
}
