import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { embedText } from "@/lib/voyage-embeddings";
import type { JarvisScope } from "@/lib/jarvis-tools";

export type MemoryType = "personal" | "venture" | "knowledge";
export type MemorySource = "explicit" | "extracted" | "research";

export interface MemoryHit {
  id: string;
  venture: string | null;
  memory_type: MemoryType;
  content: string;
  source: MemorySource;
  source_ref: string | null;
  created_at: string;
  similarity: number;
}

// Kosinus-Distanz-Schwelle fuers Dedup: darunter wird ein bestehender Eintrag
// aktualisiert statt einen neuen anzulegen. 0.15 ist bewusst eng (sehr aehnlich).
const DEDUP_MAX_DISTANCE = 0.15;

export async function searchMemory(
  scope: JarvisScope,
  queryText: string,
  opts?: { limit?: number; types?: MemoryType[] }
): Promise<MemoryHit[]> {
  if (!process.env.VOYAGE_API_KEY || !queryText.trim()) return [];
  try {
    const embedding = await embedText(queryText, "query");
    const { data, error } = await supabaseAdmin.rpc("match_jarvis_memory", {
      query_embedding: embedding,
      match_user: scope.userId,
      match_venture: scope.venture,
      match_count: opts?.limit ?? 8,
      match_types: opts?.types ?? ["personal", "venture", "knowledge"],
    });
    if (error) {
      console.error("Jarvis memory search failed:", error.message);
      return [];
    }
    return (data ?? []) as MemoryHit[];
  } catch (err) {
    console.error("Jarvis memory search failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

export async function upsertMemory(
  scope: JarvisScope,
  entry: { memory_type: MemoryType; content: string; venture?: string | null; source: MemorySource; source_ref?: string | null }
): Promise<{ id: string; action: "created" | "updated" } | null> {
  if (!process.env.VOYAGE_API_KEY || !entry.content.trim()) return null;
  const venture = entry.memory_type === "venture" ? (entry.venture ?? scope.venture) : null;

  try {
    const embedding = await embedText(entry.content, "document");

    const { data: similar } = await supabaseAdmin.rpc("find_similar_jarvis_memory", {
      query_embedding: embedding,
      match_user: scope.userId,
      match_memory_type: entry.memory_type,
      match_venture: venture,
    });
    const nearest = (similar as { id: string; content: string; distance: number }[] | null)?.[0];

    if (nearest && nearest.distance < DEDUP_MAX_DISTANCE) {
      const { error } = await supabaseAdmin
        .from("jarvis_memory")
        .update({ content: entry.content, embedding, source: entry.source, source_ref: entry.source_ref ?? null })
        .eq("id", nearest.id);
      if (error) throw error;
      return { id: nearest.id, action: "updated" };
    }

    const { data: inserted, error } = await supabaseAdmin
      .from("jarvis_memory")
      .insert({
        user_id: scope.userId,
        venture,
        memory_type: entry.memory_type,
        content: entry.content,
        embedding,
        source: entry.source,
        source_ref: entry.source_ref ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: inserted.id, action: "created" };
  } catch (err) {
    console.error("Jarvis memory upsert failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

const EXTRACTION_SYSTEM_PROMPT = `Du analysierst einen einzelnen Chat-Austausch zwischen Jose (Founder) und Jarvis,
seinem KI-Assistenten. Extrahiere NUR dauerhaft merkenswerte Fakten — keine einmaligen
Zwischenergebnisse, keine bereits in der Datenbank stehenden Roh-Daten (Leads/Kunden/Aufträge
selbst sind KEINE Erinnerung, die entstehen über strukturierte Tools).

Merkenswert sind z.B.: Vorlieben/Arbeitsweise des Founders, wiederkehrende Entscheidungsregeln,
wichtige Kontext-Fakten zu einem Venture/Kunden/Projekt, und recherchiertes Fachwissen
(Preise, Best Practices, Tool-Vergleiche) das Jarvis über Websuche gefunden hat.

Antworte AUSSCHLIESSLICH mit einem JSON-Array (kann leer sein), jedes Element:
{"memory_type": "personal"|"venture"|"knowledge", "content": "kurzer, in sich verständlicher Satz", "venture": "online_first"|null}
Kein Fließtext, keine Markdown-Codeblöcke, nur das rohe JSON-Array.`;

function extractJsonArray(text: string): unknown[] {
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function extractAndStoreMemories(
  scope: JarvisScope,
  exchange: { userText: string; assistantText: string; usedWebSearch: boolean },
  conversationId: string
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY || !process.env.VOYAGE_API_KEY) return;
  if (!exchange.userText.trim() && !exchange.assistantText.trim()) return;

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Founder: ${exchange.userText}\n\nJarvis: ${exchange.assistantText}`,
        },
      ],
    });
    const text = message.content.find((b) => b.type === "text")?.text ?? "";
    const items = extractJsonArray(text) as { memory_type?: string; content?: string; venture?: string | null }[];

    for (const item of items.slice(0, 5)) {
      const memoryType = item.memory_type as MemoryType;
      if (!["personal", "venture", "knowledge"].includes(memoryType)) continue;
      const content = (item.content ?? "").trim();
      if (!content) continue;
      await upsertMemory(scope, {
        memory_type: memoryType,
        content,
        venture: item.venture ?? null,
        source: memoryType === "knowledge" && exchange.usedWebSearch ? "research" : "extracted",
        source_ref: conversationId,
      });
    }
  } catch (err) {
    console.error("Jarvis memory extraction failed:", err instanceof Error ? err.message : err);
  }
}

export function formatMemoryContext(hits: MemoryHit[]): string {
  if (hits.length === 0) return "";
  const lines = hits.map((h) => `- [${h.memory_type}${h.venture ? `/${h.venture}` : ""}] ${h.content}`);
  return `\n\nBekanntes aus deinem Gedächtnis (nutze es, aber verifiziere Datenpunkte bei Bedarf über die Tools):\n${lines.join("\n")}`;
}
