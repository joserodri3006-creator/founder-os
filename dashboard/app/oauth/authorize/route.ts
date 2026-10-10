import { NextRequest, NextResponse } from "next/server";
import { hashValue, isFounder, randomCode, DEFAULT_SCOPE } from "@/lib/mcp-oauth";


function esc(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function page(title: string, body: string, status = 200) {
  return new Response(`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title><style>body{font-family:system-ui;max-width:480px;margin:10vh auto;padding:24px;color:#14193a}label{display:block;margin:14px 0 6px;font-size:14px}input{width:100%;box-sizing:border-box;padding:11px;border:1px solid #ccd;border-radius:8px;font-size:16px}button{margin-top:20px;width:100%;padding:12px;border:0;border-radius:8px;background:#1b2a5e;color:white;font-size:16px}p{color:#667}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function invalid(message: string) {
  return page("OAuth-Fehler", `<p>${esc(message)}</p>`, 400);
}

export async function GET(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const p = new URL(req.url).searchParams;
  const clientId = p.get("client_id") ?? "";
  const redirectUri = p.get("redirect_uri") ?? "";
  const responseType = p.get("response_type") ?? "";
  const codeChallenge = p.get("code_challenge") ?? "";
  const state = p.get("state") ?? "";
  const scope = p.get("scope") || DEFAULT_SCOPE;

  if (responseType !== "code" || !clientId || !redirectUri || !codeChallenge) return invalid("OAuth-Parameter fehlen.");
  const { data: client } = await supabaseAdmin.from("mcp_oauth_clients").select("redirect_uris").eq("client_id", clientId).single();
  const allowed = Array.isArray(client?.redirect_uris) && client.redirect_uris.includes(redirectUri);
  if (!allowed) return invalid("Client oder redirect_uri nicht registriert.");

  const hidden = ["client_id", "redirect_uri", "code_challenge", "code_challenge_method", "state", "scope"]
    .map(k => `<input type="hidden" name="${k}" value="${esc(p.get(k) ?? (k === "code_challenge_method" ? "S256" : k === "scope" ? scope : ""))}">`).join("");
  return page("Founder OS verbinden", `<p>ChatGPT möchte auf deinen Founder-OS-Leadbereich zugreifen.</p><form method="post">${hidden}<label>E-Mail</label><input type="email" name="email" autocomplete="username" required><label>Passwort</label><input type="password" name="password" autocomplete="current-password" required><button type="submit">Founder OS autorisieren</button></form>`);
}

export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const form = await req.formData();
  const clientId = String(form.get("client_id") ?? "");
  const redirectUri = String(form.get("redirect_uri") ?? "");
  const codeChallenge = String(form.get("code_challenge") ?? "");
  const state = String(form.get("state") ?? "");
  const scope = String(form.get("scope") ?? DEFAULT_SCOPE);
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");

  const { data: client } = await supabaseAdmin.from("mcp_oauth_clients").select("redirect_uris").eq("client_id", clientId).single();
  if (!Array.isArray(client?.redirect_uris) || !client.redirect_uris.includes(redirectUri)) return invalid("Client oder redirect_uri nicht registriert.");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return invalid("Supabase Auth ist nicht konfiguriert.");

  const authRes = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  if (!authRes.ok) return invalid("Anmeldung fehlgeschlagen.");
  const auth = await authRes.json();
  if (!(await isFounder(auth.user?.id))) return invalid("Nur Founder dürfen den externen MCP-Zugriff autorisieren.");

  const code = randomCode();
  const { error } = await supabaseAdmin.from("mcp_oauth_codes").insert({
    code_hash: hashValue(code), client_id: clientId, redirect_uri: redirectUri,
    code_challenge: codeChallenge, user_id: auth.user.id,
    scope, expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  });
  if (error) return invalid("OAuth-Code konnte nicht erstellt werden.");

  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  return NextResponse.redirect(target);
}
