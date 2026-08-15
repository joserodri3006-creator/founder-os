import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { JarvisScope } from "@/lib/jarvis-tools";
import { createSseStream, runJarvisTurn } from "@/lib/jarvis-loop";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: roleRow } = await supabaseAdmin
    .from("user_venture_roles")
    .select("role,venture")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (roleRow?.role !== "founder") {
    return new Response("Jarvis ist aktuell nur für den Founder verfügbar.", { status: 403 });
  }

  const scope: JarvisScope = { userId: user.id, role: "founder", venture: roleRow.venture ?? null };

  const body = await req.json().catch(() => null) as { message?: string; conversation_id?: string } | null;
  const userMessage = body?.message?.trim();
  if (!userMessage) return new Response("message fehlt", { status: 400 });

  let conversationId = body?.conversation_id;
  let containerId: string | null = null;
  if (!conversationId) {
    const { data: conv, error } = await supabaseAdmin
      .from("jarvis_conversations")
      .insert({ user_id: user.id, title: userMessage.slice(0, 60) })
      .select("id")
      .single();
    if (error || !conv) return new Response("Konversation konnte nicht erstellt werden", { status: 500 });
    conversationId = conv.id;
  } else {
    const { data: pending } = await supabaseAdmin
      .from("jarvis_pending_actions")
      .select("id")
      .eq("conversation_id", conversationId)
      .maybeSingle();
    if (pending) {
      return new Response(
        "Diese Konversation wartet noch auf eine Bestätigung. Bitte erst bestätigen oder ablehnen.",
        { status: 409 }
      );
    }
    const { data: conv } = await supabaseAdmin
      .from("jarvis_conversations")
      .select("container_id")
      .eq("id", conversationId)
      .maybeSingle();
    containerId = conv?.container_id ?? null;
  }

  const { data: history } = await supabaseAdmin
    .from("jarvis_messages")
    .select("role,content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  const messages: Anthropic.MessageParam[] = (history ?? []).map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content as Anthropic.MessageParam["content"],
  }));
  messages.push({ role: "user", content: userMessage });

  await supabaseAdmin.from("jarvis_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: [{ type: "text", text: userMessage }],
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return new Response("ANTHROPIC_API_KEY fehlt", { status: 500 });
  const client = new Anthropic({ apiKey });

  const stream = createSseStream(async (send) => {
    send({ type: "conversation", conversation_id: conversationId });
    await runJarvisTurn({ client, scope, conversationId: conversationId as string, messages, send, containerId });
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
