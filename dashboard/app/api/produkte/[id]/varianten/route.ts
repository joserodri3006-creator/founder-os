import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  // Upsert variant options
  if (body.variant_options) {
    await supabaseAdmin.from("product_variant_options").delete().eq("product_id", id);
    if (body.variant_options.length) {
      await supabaseAdmin.from("product_variant_options").insert(
        body.variant_options.map((o: any, idx: number) => ({
          product_id: id, name: o.name, values: o.values, sort_order: idx,
        }))
      );
    }
  }

  // Upsert variants
  if (body.variants) {
    // Delete variants not in list
    const keepIds = body.variants.filter((v: any) => v.id).map((v: any) => v.id);
    if (keepIds.length) {
      await supabaseAdmin.from("product_variants")
        .delete().eq("product_id", id).not("id", "in", `(${keepIds.join(",")})`);
    } else {
      await supabaseAdmin.from("product_variants").delete().eq("product_id", id);
    }

    for (const variant of body.variants) {
      const { id: vid, ...fields } = variant;
      if (vid) {
        await supabaseAdmin.from("product_variants").update({ ...fields, product_id: id }).eq("id", vid);
      } else {
        await supabaseAdmin.from("product_variants").insert({ ...fields, product_id: id });
      }
    }
  }

  return NextResponse.json({ success: true });
}
