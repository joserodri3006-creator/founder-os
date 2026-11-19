import { NextResponse } from "next/server";
import { ISSUER, SUPPORTED_SCOPES } from "@/lib/mcp-oauth";

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
    resource_parameter_supported: true,
    scopes_supported: SUPPORTED_SCOPES,
  });
}
