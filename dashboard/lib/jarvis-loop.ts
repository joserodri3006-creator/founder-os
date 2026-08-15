import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { JARVIS_TOOLS, executeJarvisTool, JarvisScope, CONFIRM_REQUIRED_TOOLS, describeAction } from "@/lib/jarvis-tools";
import { searchMemory, formatMemoryContext, extractAndStoreMemories } from "@/lib/jarvis-memory";

export const JARVIS_SYSTEM_PROMPT = `Du bist Jarvis, der KI-Assistent im Founder OS Dashboard von Jose. Du hilfst ihm,
Leads, Kunden und Aufträge über alle Ventures (Online First, Blazed Outfitters, Droplane, Brandary,
Worknest) hinweg zu überblicken und zu bearbeiten. Antworte auf Deutsch, präzise und ohne Floskeln.
Nutze die verfügbaren Tools, um aktuelle Daten abzurufen, statt zu raten. Wenn ein Tool-Aufruf eine
Datenänderung vornimmt (Notiz hinzufügen, Lead-Status ändern, Lead importieren, Auftrag anlegen,
E-Mail-Entwurf erstellen), fasse danach kurz zusammen was du geändert hast. Für die Google-Lead-Suche
(search_new_leads) gilt: Ergebnisse enthalten nie Kontaktperson/E-Mail — frag den Nutzer aktiv danach,
bevor du import_lead aufrufst, und erfinde niemals Kontaktdaten. update_order_status kann eine
automatisierte Kunden-E-Mail auslösen und wird deshalb vom System erst nach Bestätigung durch den
Nutzer ausgeführt — rufe es trotzdem normal auf, das Bestätigungs-UI übernimmt den Rest.`;

export type SendFn = (event: Record<string, unknown>) => void;

function sseEncode(event: Record<string, unknown>) {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function createSseStream(run: (send: SendFn) => Promise<void>) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(sseEncode(event)));
      }
      try {
        await run(send);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Unbekannter Fehler" });
      } finally {
        controller.close();
      }
    },
  });
}

function extractText(content: string | Array<{ type: string; text?: string }>): string {
  if (typeof content === "string") return content;
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

function lastUserText(messages: Anthropic.MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = extractText(messages[i].content as any);
    if (text.trim()) return text;
  }
  return "";
}

function usedWebSearchInContent(content: Array<{ type: string }>): boolean {
  return content.some((b) => b.type === "server_tool_use" || b.type === "web_search_tool_result");
}

interface ToolBatchResult {
  results: Anthropic.ToolResultBlockParam[];
  paused: { queue: Anthropic.ToolUseBlock[] } | null;
}

async function runToolBatch(scope: JarvisScope, tools: Anthropic.ToolUseBlock[], send: SendFn): Promise<ToolBatchResult> {
  const results: Anthropic.ToolResultBlockParam[] = [];
  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    if (CONFIRM_REQUIRED_TOOLS.has(tool.name)) {
      return { results, paused: { queue: tools.slice(i) } };
    }
    send({ type: "tool_start", id: tool.id, name: tool.name, input: tool.input });
    const result = await executeJarvisTool(scope, tool.name, tool.input as Record<string, unknown>);
    send({ type: "tool_result", id: tool.id, name: tool.name, result });
    results.push({ type: "tool_result", tool_use_id: tool.id, content: result });
  }
  return { results, paused: null };
}

export async function runJarvisTurn(opts: {
  client: Anthropic;
  scope: JarvisScope;
  conversationId: string;
  messages: Anthropic.MessageParam[];
  send: SendFn;
}) {
  const { client, scope, conversationId, messages, send } = opts;

  const userText = lastUserText(messages);
  const memoryHits = await searchMemory(scope, userText);
  const system = JARVIS_SYSTEM_PROMPT + formatMemoryContext(memoryHits);
  let usedWebSearch = false;
  // web_search fuehrt intern Code-Ausfuehrung in einem Sandbox-Container aus. Bei einem
  // pause_turn (oder generell einem Folge-Request innerhalb desselben Turns) muss die
  // Container-ID der vorherigen Antwort mitgegeben werden, sonst kann die Recherche-Session
  // nicht fortgesetzt werden ("container_id is required when there are pending tool uses...").
  let containerId: string | undefined;

  while (true) {
    const anthropicStream = client.messages.stream({
      model: "claude-opus-5",
      max_tokens: 4096,
      system,
      tools: JARVIS_TOOLS,
      messages,
      ...(containerId ? { container: containerId } : {}),
    });

    anthropicStream.on("text", (delta) => send({ type: "text", delta }));

    const message = await anthropicStream.finalMessage();
    messages.push({ role: "assistant", content: message.content });
    if (usedWebSearchInContent(message.content)) usedWebSearch = true;
    if (message.container?.id) containerId = message.container.id;

    if (message.stop_reason === "pause_turn") continue;

    const toolUseBlocks = message.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      await supabaseAdmin.from("jarvis_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: message.content,
      });
      send({ type: "done", conversation_id: conversationId });
      await extractAndStoreMemories(
        scope,
        { userText, assistantText: extractText(message.content), usedWebSearch },
        conversationId
      );
      return;
    }

    const batch = await runToolBatch(scope, toolUseBlocks, send);

    if (batch.paused) {
      await supabaseAdmin.from("jarvis_messages").insert({
        conversation_id: conversationId,
        role: "assistant",
        content: message.content,
      });
      const nextTool = batch.paused.queue[0];
      const summary = describeAction(nextTool.name, nextTool.input as Record<string, unknown>);
      await supabaseAdmin.from("jarvis_pending_actions").insert({
        conversation_id: conversationId,
        tool_queue: batch.paused.queue,
        executed_results: batch.results,
        summary,
      });
      send({
        type: "awaiting_confirmation",
        conversation_id: conversationId,
        name: nextTool.name,
        input: nextTool.input,
        summary,
      });
      return;
    }

    messages.push({ role: "user", content: batch.results });
  }
}

export { runToolBatch };
