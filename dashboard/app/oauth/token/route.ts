import { NextRequest, NextResponse } from "next/server";
import { hashValue, issueAccessToken } from "@/lib/mcp-oauth";
import { createHash } from "node:crypto";

function b64url(buffer: Buffer) { return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function formError(error: string, description: string) { return NextResponse.json({ error, error_description: description }, { status: 400 }); }
function normalizeRedirectUri(value: string) { return value.replace(/\/+$/, ""); }

export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const contentType = req.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await req.json().catch(() => ({})) as Record<string, unknown>
    : Object.fromEntries((await req.formData()).entries());
  const grantType = String(body.grant_type ?? "");
  const code = String(body.code ?? "");
  const clientId = String(body.client_id ?? "");
  const redirectUri = String(body.redirect_uri ?? "");
  const verifier = String(body.code_verifier ?? "");
  if (grantType !== "authorization_code" || !code || !clientId || !redirectUri || !verifier) return formError("invalid_request", "OAuth code, client_id, redirect_uri and code_verifier are required");

  const { data: row } = await supabaseAdmin.from("mcp_oauth_codes").select("*").eq("code_hash", hashValue(code)).eq("client_id", clientId).is("used_at", null).single();
  const { data: client } = await supabaseAdmin.from("mcp_oauth_clients").select("redirect_uris").eq("client_id", clientId).single();
  const registeredRedirects = Array.isArray(client?.redirect_uris) ? client.redirect_uris.map(String) : [];
  const redirectMatches = row && registeredRedirects.some((uri) => normalizeRedirectUri(uri) === normalizeRedirectUri(redirectUri));
  if (!row || new Date(row.expires_at).getTime() < Date.now() || !redirectMatches) return formError("invalid_grant", "Authorization code is invalid, expired or already used");

  const challenge = b64url(createHash("sha256").update(verifier).digest());
  if (challenge !== row.code_challenge) return formError("invalid_grant", "PKCE verification failed");

  await supabaseAdmin.from("mcp_oauth_codes").update({ used_at: new Date().toISOString() }).eq("code_hash", row.code_hash);
  const accessToken = await issueAccessToken(row.user_id, clientId, row.scope);
  return NextResponse.json({ access_token: accessToken, token_type: "Bearer", expires_in: 3600, scope: row.scope });
}
