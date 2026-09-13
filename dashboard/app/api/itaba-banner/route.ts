import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const CONFIG_KEY = "itaba_announcement_banner";
const DEFAULT_TEXT = "Unser neuer Onlineshop ist da — Japanisches Geschirr & Keramik jetzt bequem online bestellen";

type BannerValue = { enabled: boolean; text: string };

function parseBanner(value: unknown): BannerValue {
  if (!value) return { enabled: true, text: DEFAULT_TEXT };
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return {
      enabled: parsed?.enabled !== false,
      text: typeof parsed?.text === "string" && parsed.text.trim() ? parsed.text : DEFAULT_TEXT,
    };
  } catch {
    return { enabled: true, text: DEFAULT_TEXT };
  }
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("system_config")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(parseBanner(data?.value));
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const enabled = typeof body.enabled === "boolean" ? body.enabled : true;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Text darf nicht leer sein" }, { status: 400 });

  const { error } = await supabaseAdmin.from("system_config").upsert(
    {
      key: CONFIG_KEY,
      value: JSON.stringify({ enabled, text }),
      description: "Itaba Ankündigungsbanner (Startseite)",
    },
    { onConflict: "key" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enabled, text });
}
