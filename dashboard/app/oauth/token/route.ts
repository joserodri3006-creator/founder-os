import { NextRequest, NextResponse } from "next/server";
import { hashValue, issueAccessToken, RESOURCE, oauthLog } from "@/lib/mcp-oauth";
import { createHash } from "node:crypto";

function b64url(buffer: Buffer) { return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function formError(error: string, description: string, client = "") {
  oauthLog("token_error", { error, client: client.slice(0, 18) });
  return NextResponse.json({ error, error_description: description }, { status: 400 });
}
function basicClientId(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  if (!header.toLowerCase().startsWith("basic ")) return "";
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    return decoded.split(":", 1)[0] ?? "";
  } catch { return ""; }
}

export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const contentType = req.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await req.json().catch(() => ({})) as Record<string, unknown>
    : Object.fromEntries((await req.formData()).entries());
  const grantType = String(body.grant_type ?? "");
  const code = String(body.code ?? "");
  const clientId = String(body.client_id || basicClientId(req));
  const redirectUri = body.redirect_uri === undefined || body.redirect_uri === "" ? "" : String(body.redirect_uri);
  const resource = body.resource === undefined || body.resource === "" ? "" : String(body.resource);
  const verifier = String(body.code_verifier ?? "");
  if (grantType !== "authorization_code" || !code || !clientId || !verifier || (resource && resource !== RESOURCE)) return formError("invalid_request", "OAuth code, client_id and code_verifier are required", clientId);

  oauthLog("token_received", { client: clientId.slice(0, 18), has_redirect_uri: Boolean(redirectUri), has_resource: Boolean(resource), has_verifier: Boolean(verifier), grant_type: grantType });
  const { data: row } = await supabaseAdmin.from("mcp_oauth_codes").select("*").eq("code_hash", hashValue(code)).eq("client_id", clientId).is("used_at", null).single();
  const { data: client } = await supabaseAdmin.from("mcp_oauth_clients").select("redirect_uris").eq("client_id", clientId).single();
  const registeredRedirects = Array.isArray(client?.redirect_uris) ? client.redirect_uris.map(String) : [];
  const effectiveRedirectUri = redirectUri || String(row?.redirect_uri ?? "");
  const effectiveResource = resource || String(row?.resource ?? RESOURCE);
  const redirectMatches = Boolean(row && row.redirect_uri === effectiveRedirectUri && row.resource === effectiveResource && registeredRedirects.includes(effectiveRedirectUri));
  if (!row || new Date(row.expires_at).getTime() < Date.now() || !redirectMatches) return formError("invalid_grant", "Authorization code is invalid, expired or already used", clientId);

  const challenge = b64url(createHash("sha256").update(verifier).digest());
  if (challenge !== row.code_challenge || row.code_challenge_method !== "S256") return formError("invalid_grant", "PKCE verification failed", clientId);

  await supabaseAdmin.from("mcp_oauth_codes").update({ used_at: new Date().toISOString() }).eq("code_hash", row.code_hash).is("used_at", null);
  const accessToken = await issueAccessToken(row.user_id, clientId, row.scope, row.resource);
  oauthLog("token_success", { client: clientId.slice(0, 18), scope: row.scope, resource: row.resource });
  return NextResponse.json({ access_token: accessToken, token_type: "Bearer", expires_in: 3600, scope: row.scope });
}
