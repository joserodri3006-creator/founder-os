// Anthropic bietet keine eigene Embeddings-API — fuer Jarvis' semantisches Gedaechtnis
// nutzen wir Voyage AI (von Anthropic selbst fuer diesen Zweck empfohlen).
const VOYAGE_MODEL = "voyage-3.5";
const VOYAGE_DIMENSIONS = 1024;

type VoyageInputType = "query" | "document";

interface VoyageEmbeddingResponse {
  data?: { embedding: number[] }[];
  detail?: string;
}

export async function embedText(text: string, inputType: VoyageInputType): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) throw new Error("VOYAGE_API_KEY fehlt");

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: text.slice(0, 8000),
      model: VOYAGE_MODEL,
      input_type: inputType,
      output_dimension: VOYAGE_DIMENSIONS,
    }),
  });

  const data = (await response.json()) as VoyageEmbeddingResponse;
  if (!response.ok || !data.data?.[0]?.embedding) {
    throw new Error(data.detail || `Voyage Embeddings Fehler (${response.status})`);
  }
  return data.data[0].embedding;
}
