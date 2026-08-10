import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { executeJarvisTool, describeAction, JarvisScope } from "@/lib/jarvis-tools";
import { createSseStream, runJarvisTurn, runToolBatch } from "@/lib/jarvis-loop";

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

  const body = await req.json().catch(() => null) as { conversation_id?: string; approved?: boolean } | null;
  const conversationId = body?.conversation_id;
  const approved = Boolean(body?.approved);
  if (!conversationId) return new Response("conversation_id fehlt", { status: 400 });

  const { data: conversation } = await supabaseAdmin
    .from("jarvis_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conversation) return new Response("Konversation nicht gefunden", { status: 404 });

  const { data: pending } = await supabaseAdmin
    .from("jarvis_pending_actions")
    .select("id,tool_queue,executed_results")
    .eq("conversation_id", conversationId)
    .maybeSingle();
  if (!pending) return new Response("Keine offene Bestätigung für diese Konversation", { status: 404 });

  const toolQueue = pending.tool_queue as Anthropic.ToolUseBlock[];
  const [firstTool, ...restTools] = toolQueue;
  const executedResults = pending.executed_results as Anthropic.ToolResultBlockParam[];

  const stream = createSseStream(async (send) => {
    const firstResult = approved
      ? await executeJarvisTool(scope, firstTool.name, firstTool.input as Record<string, unknown>)
      : JSON.stringify({ error: "Vom Nutzer abgelehnt." });

    send({ type: "tool_start", id: firstTool.id, name: firstTool.name, input: firstTool.input });
    send({ type: "tool_result", id: firstTool.id, name: firstTool.name, result: firstResult });

    const resultsSoFar: Anthropic.ToolResultBlockParam[] = [
      ...executedResults,
      { type: "tool_result", tool_use_id: firstTool.id, content: firstResult },
    ];

    const batch = await runToolBatch(scope, restTools, send);
    const allResults = [...resultsSoFar, ...batch.results];

    if (batch.paused) {
      const nextTool = batch.paused.queue[0];
      const summary = describeAction(nextTool.name, nextTool.input as Record<string, unknown>);
      await supabaseAdmin
        .from("jarvis_pending_actions")
        .update({ tool_queue: batch.paused.queue, executed_results: allResults, summary })
        .eq("conversation_id", conversationId);
      send({ type: "awaiting_confirmation", conversation_id: conversationId, name: nextTool.name, input: nextTool.input, summary });
      return;
    }

    await supabaseAdmin.from("jarvis_pending_actions").delete().eq("conversation_id", conversationId);

    const { data: history } = await supabaseAdmin
      .from("jarvis_messages")
      .select("role,content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    const messages: Anthropic.MessageParam[] = (history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as Anthropic.MessageParam["content"],
    }));
    messages.push({ role: "user", content: allResults });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY fehlt");
    const client = new Anthropic({ apiKey });

    await runJarvisTurn({ client, scope, conversationId, messages, send });
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
