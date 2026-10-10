import { NextRequest } from "next/server";

/**
 * Prüft den MCP-API-Key aus dem Authorization-Header.
 * Erwartet: Authorization: Bearer <MCP_API_KEY>
 * Key liegt in der Vercel-Umgebungsvariable MCP_API_KEY.
 */
export function validateMcpKey(req: NextRequest): boolean {
  const key = process.env.MCP_API_KEY;
  if (!key) return false; // Kein Key konfiguriert → alles ablehnen

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : auth.trim();
  return token === key;
}

export function unauthorizedResponse() {
  return Response.json(
    { error: "Unauthorized", hint: "Authorization: Bearer <MCP_API_KEY> Header erforderlich" },
    { status: 401, headers: { "WWW-Authenticate": "Bearer" } }
  );
}
