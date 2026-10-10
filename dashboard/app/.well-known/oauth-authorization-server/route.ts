import { NextResponse } from "next/server";

const ISSUER = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os-theta.vercel.app").trim().replace(/\/+$/, "");

export async function GET() {
  return NextResponse.json({
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/oauth/authorize`,
    token_endpoint: `${ISSUER}/oauth/token`,
    registration_endpoint: `${ISSUER}/oauth/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["leads:read", "leads:write", "stats:read"],
  });
}
