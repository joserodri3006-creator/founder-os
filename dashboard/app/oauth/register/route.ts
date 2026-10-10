import { NextRequest, NextResponse } from "next/server";
import { randomCode } from "@/lib/mcp-oauth";


export async function POST(req: NextRequest) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const body = await req.json();
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (!redirectUris.length) return NextResponse.json({ error: "redirect_uris required" }, { status: 400 });

  const clientId = `chatgpt_${randomCode()}`;
  const { error } = await supabaseAdmin.from("mcp_oauth_clients").insert({
    client_id: clientId,
    client_name: body.client_name ?? "ChatGPT MCP Client",
    redirect_uris: redirectUris,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const issuer = process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os.vercel.app";
  return NextResponse.json({
    client_id: clientId,
    client_name: body.client_name ?? "ChatGPT MCP Client",
    redirect_uris: redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: "leads:read leads:write stats:read",
    client_id_issued_at: Math.floor(Date.now() / 1000),
    registration_client_uri: `${issuer}/oauth/register/${clientId}`,
  }, { status: 201 });
}
