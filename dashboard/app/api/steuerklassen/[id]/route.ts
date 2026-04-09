import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const { rates, ...classData } = body;

  // Update tax class
  if (Object.keys(classData).length > 0) {
    const { error } = await supabaseAdmin
      .from("tax_classes")
      .update(classData)
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Replace rates if provided
  if (rates !== undefined) {
    await supabaseAdmin.from("tax_rates").delete().eq("tax_class_id", id);
    if (rates.length > 0) {
      await supabaseAdmin.from("tax_rates").insert(
        rates.map((r: any) => ({ ...r, tax_class_id: id }))
      );
    }
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  // Check if any products use this tax class
  const { count } = await supabaseAdmin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("tax_class_id", id);

  if ((count ?? 0) > 0) {
    return NextResponse.json(
      { error: `Diese Steuerklasse wird von ${count} Produkt(en) verwendet. Bitte zuerst die Produkte ändern.` },
      { status: 400 }
    );
  }

  const { error } = await supabaseAdmin.from("tax_classes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
