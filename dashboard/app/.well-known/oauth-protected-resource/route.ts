import { NextResponse } from "next/server";

const ISSUER = process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os.vercel.app";

export async function GET() {
  return NextResponse.json({
    resource: `${ISSUER}/mcp`,
    authorization_servers: [ISSUER],
    scopes_supported: ["leads:read", "leads:write", "stats:read"],
    bearer_methods_supported: ["header"],
  });
}
