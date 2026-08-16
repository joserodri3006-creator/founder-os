import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Jarvis' Stimme (ElevenLabs Voice-ID, vom Founder ausgewaehlt).
const VOICE_ID = "6IEvIqBOPOMUc5HwR9sQ";
const MAX_CHARS = 5000;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: roleRow } = await supabaseAdmin
    .from("user_venture_roles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (roleRow?.role !== "founder") return new Response("Forbidden", { status: 403 });

  const body = await req.json().catch(() => null) as { text?: string } | null;
  const text = body?.text?.trim().slice(0, MAX_CHARS);
  if (!text) return new Response("text fehlt", { status: 400 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return new Response("ELEVENLABS_API_KEY fehlt", { status: 500 });

  const elevenRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_multilingual_v2",
    }),
  });

  if (!elevenRes.ok || !elevenRes.body) {
    const detail = await elevenRes.text().catch(() => "");
    return new Response(`ElevenLabs Fehler (${elevenRes.status}): ${detail}`, { status: 502 });
  }

  return new Response(elevenRes.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
    },
  });
}
