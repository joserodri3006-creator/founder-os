import { NextResponse } from "next/server";
import { RESOURCE, SUPPORTED_SCOPES, ISSUER } from "@/lib/mcp-oauth";

export async function GET() {
  return NextResponse.json({
    resource: RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: SUPPORTED_SCOPES,
    bearer_methods_supported: ["header"],
  });
}
