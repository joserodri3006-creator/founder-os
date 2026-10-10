import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const DEFAULT_SCOPE = "leads:read leads:write stats:read";
export const ISSUER = process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os.vercel.app";

function secret() {
  const value = process.env.MCP_OAUTH_SECRET;
  if (!value) throw new Error("MCP_OAUTH_SECRET is not configured");
  return new TextEncoder().encode(value);
}

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function randomCode() {
  return randomBytes(32).toString("base64url");
}

export async function issueAccessToken(userId: string, clientId: string, scope = DEFAULT_SCOPE) {
  return new SignJWT({ scope, client_id: clientId })
    .setProtectedHeader({ alg: "HS256", typ: "at+jwt" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(`${ISSUER}/mcp`)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret());
}

export async function verifyAccessToken(token: string) {
  const result = await jwtVerify(token, secret(), {
    issuer: ISSUER,
    audience: `${ISSUER}/mcp`,
  });
  return {
    userId: result.payload.sub as string,
    scope: String(result.payload.scope ?? ""),
  };
}

export async function isFounder(userId: string) {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  const { data } = await supabaseAdmin
    .from("user_venture_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "founder")
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}
