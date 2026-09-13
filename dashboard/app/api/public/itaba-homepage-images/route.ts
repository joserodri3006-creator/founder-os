import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  HOMEPAGE_IMAGE_SLOTS,
  canManageHomepageImages,
  mergeHomepageImages,
  parseImages,
  safeImageExtension,
} from "@/lib/itaba-homepage-images";

const CONFIG_KEY = "itaba_homepage_images";
const STORAGE_BUCKET = "product-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function readConfigValue() {
  return supabaseAdmin
    .from("system_config")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();
}

export async function GET() {
  const { data, error } = await readConfigValue();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    key: CONFIG_KEY,
    slots: mergeHomepageImages(data?.value),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: roleRow, error: roleError } = await supabaseAdmin
    .from("user_venture_roles")
    .select("role, venture, permissions")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });
  if (!canManageHomepageImages(roleRow?.role, roleRow?.venture, roleRow?.permissions ?? {})) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const slot = formData.get("slot");
  const file = formData.get("file");
  const slotDefinition = HOMEPAGE_IMAGE_SLOTS.find((item) => item.id === slot);

  if (!slotDefinition || !(file instanceof File)) {
    return NextResponse.json({ error: "Bild und gültiger Bildbereich sind erforderlich." }, { status: 400 });
  }
  const extension = safeImageExtension(file.type);
  if (!extension) {
    return NextResponse.json({ error: "Nur JPG-, PNG- und WebP-Bilder sind erlaubt." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Das Bild darf maximal 10 MB groß sein." }, { status: 413 });
  }

  const { data: currentConfig, error: readError } = await readConfigValue();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });

  const previousImages = parseImages(currentConfig?.value);
  const previous = previousImages[slotDefinition.id];
  const previousStoragePath = typeof previous === "object" ? previous?.storage_path : null;
  const storagePath = `itaba/homepage/${slotDefinition.id}-${Date.now()}.${extension}`;
  const fileBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, fileBuffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrlData } = supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  const images = {
    ...previousImages,
    [slotDefinition.id]: {
      url: publicUrlData.publicUrl,
      storage_path: storagePath,
      updated_at: new Date().toISOString(),
    },
  };
  const { error: updateError } = await supabaseAdmin.from("system_config").upsert({
    key: CONFIG_KEY,
    value: JSON.stringify(images),
    description: "Itaba Startseitenbilder",
  }, { onConflict: "key" });

  if (updateError) {
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([storagePath]);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (typeof previousStoragePath === "string" && previousStoragePath.startsWith("itaba/homepage/")) {
    await supabaseAdmin.storage.from(STORAGE_BUCKET).remove([previousStoragePath]);
  }

  return NextResponse.json({
    key: CONFIG_KEY,
    slots: mergeHomepageImages(images),
  });
}
