import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { JARVIS_TOOLS, executeJarvisTool, JarvisScope } from "@/lib/jarvis-tools";

export const maxDuration = 120;

const SYSTEM_PROMPT = `Du bist Jarvis, der KI-Assistent im Founder OS Dashboard von Jose. Du hilfst ihm,
Leads, Kunden und Aufträge über alle Ventures (Online First, Blazed Outfitters, Droplane, Brandary,
Worknest) hinweg zu überblicken und zu bearbeiten. Antworte auf Deutsch, präzise und ohne Floskeln.
Nutze die verfügbaren Tools, um aktuelle Daten abzurufen, statt zu raten. Wenn ein Tool-Aufruf eine
Datenänderung vornimmt (Notiz hinzufügen, Lead-Status ändern), fasse danach kurz zusammen was du
geändert hast.`;

function sseEncode(event: Record<string, unknown>) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

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
  if (!conversationId) {
    const { data: conv, error } = await supabaseAdmin
      .from("jarvis_conversations")
      .insert({ user_id: user.id, title: userMessage.slice(0, 60) })
      .select("id")
      .single();
    if (error || !conv) return new Response("Konversation konnte nicht erstellt werden", { status: 500 });
    conversationId = conv.id;
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

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(sseEncode(event)));
      }

      try {
        send({ type: "conversation", conversation_id: conversationId });

        let finalAssistantContent: Anthropic.ContentBlockParam[] = [];

        while (true) {
          const anthropicStream = client.messages.stream({
            model: "claude-opus-5",
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            tools: JARVIS_TOOLS,
            messages,
          });

          anthropicStream.on("text", (delta) => {
            send({ type: "text", delta });
          });

          const message = await anthropicStream.finalMessage();
          finalAssistantContent = message.content;
          messages.push({ role: "assistant", content: message.content });

          if (message.stop_reason === "pause_turn") continue;

          const toolUseBlocks = message.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );

          if (toolUseBlocks.length === 0) break;

          const toolResults: Anthropic.ToolResultBlockParam[] = [];
          for (const tool of toolUseBlocks) {
            send({ type: "tool_start", id: tool.id, name: tool.name, input: tool.input });
            const result = await executeJarvisTool(scope, tool.name, tool.input as Record<string, unknown>);
            send({ type: "tool_result", id: tool.id, name: tool.name, result });
            toolResults.push({ type: "tool_result", tool_use_id: tool.id, content: result });
          }

          messages.push({ role: "user", content: toolResults });
        }

        await supabaseAdmin.from("jarvis_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: finalAssistantContent,
        });

        send({ type: "done", conversation_id: conversationId });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unbekannter Fehler" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
