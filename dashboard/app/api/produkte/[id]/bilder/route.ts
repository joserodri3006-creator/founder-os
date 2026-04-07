import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) return NextResponse.json({ error: "Kein Bild" }, { status: 400 });

  const { data: product } = await supabaseAdmin
    .from("products").select("venture, images").eq("id", id).single();
  if (!product) return NextResponse.json({ error: "Produkt nicht gefunden" }, { status: 404 });

  const ext = file.name.split(".").pop() ?? "jpg";
  const storagePath = `${product.venture}/${id}/${Date.now()}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from("product-images")
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabaseAdmin.storage
    .from("product-images")
    .getPublicUrl(storagePath);

  const newImage = {
    url: urlData.publicUrl,
    storage_path: storagePath,
    alt: file.name.replace(/\.[^.]+$/, ""),
    sort_order: (product.images ?? []).length,
  };

  const updatedImages = [...(product.images ?? []), newImage];
  await supabaseAdmin.from("products").update({ images: updatedImages }).eq("id", id);

  return NextResponse.json(newImage, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { images } = await req.json();

  const { error } = await supabaseAdmin.from("products").update({ images }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { storage_path } = await req.json();

  await supabaseAdmin.storage.from("product-images").remove([storage_path]);

  const { data: product } = await supabaseAdmin
    .from("products").select("images").eq("id", id).single();
  const updatedImages = (product?.images ?? []).filter(
    (img: any) => img.storage_path !== storage_path
  );
  await supabaseAdmin.from("products").update({ images: updatedImages }).eq("id", id);

  return NextResponse.json({ success: true });
}
