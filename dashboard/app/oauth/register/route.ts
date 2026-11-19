import { NextRequest, NextResponse } from "next/server";
import { randomCode, SUPPORTED_SCOPES, DEFAULT_SCOPE, ISSUER, oauthLog } from "@/lib/mcp-oauth";


export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const body = await req.json();
  const requestedScope = typeof body.scope === "string" ? body.scope : DEFAULT_SCOPE;
  const scope = requestedScope.split(/\s+/).filter(Boolean) as string[];
  if (!scope.length || scope.some((item: string) => !(SUPPORTED_SCOPES as readonly string[]).includes(item))) return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (!redirectUris.length || redirectUris.length > 5) return NextResponse.json({ error: "invalid_redirect_uri", error_description: "1 bis 5 redirect_uris erforderlich" }, { status: 400 });
  // Anti-Phishing: ohne Anmeldung registrierbar, daher nur https-Redirects auf bekannte KI-Clients zulassen.
  const ALLOWED_HOSTS = new Set(["chatgpt.com", "chat.openai.com", "platform.openai.com", "claude.ai", "claude.com"]);
  const bad = redirectUris.filter((u: unknown) => {
    try { const url = new URL(String(u)); return url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname); } catch { return true; }
  });
  if (bad.length) return NextResponse.json({ error: "invalid_redirect_uri", error_description: "redirect_uri nicht erlaubt" }, { status: 400 });

  const clientId = `chatgpt_${randomCode()}`;
  const { error } = await supabaseAdmin.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: String(body.client_name ?? "MCP Client").slice(0, 80),
    redirect_uris: redirectUris,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  oauthLog("registration", { client: clientId.slice(0, 18), redirect_count: redirectUris.length });
  return NextResponse.json({
    client_id: clientId,
    client_name: body.client_name ?? "ChatGPT MCP Client",
    redirect_uris: redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: scope.join(" "),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    registration_client_uri: `${ISSUER}/oauth/register/${clientId}`,
  }, { status: 201 });
}
