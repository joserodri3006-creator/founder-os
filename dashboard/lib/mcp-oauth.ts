import { createHash, randomBytes } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const SUPPORTED_SCOPES = ["tasks:read", "tasks:write", "leads:read", "leads:write", "stats:read"] as const;
export const DEFAULT_SCOPE = "tasks:read tasks:write leads:read leads:write stats:read";
export const RESOURCE = `${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os-theta.vercel.app").trim().replace(/\/+$/, "")}/mcp`;
// Ohne abschliessenden Schrägstrich, egal wie die Variable in Vercel gesetzt ist (sonst entstehen "//oauth/token" und abweichende JWT-Issuer).
export const ISSUER = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os-theta.vercel.app").trim().replace(/\/+$/, "");

export function parseScope(value: string) {
  const scopes = [...new Set(value.split(/\s+/).filter(Boolean))];
  return scopes.length > 0 && scopes.every((scope) => (SUPPORTED_SCOPES as readonly string[]).includes(scope)) ? scopes.join(" ") : null;
}

export function oauthLog(event: string, fields: Record<string, string | number | boolean | undefined> = {}) {
  console.info(`[oauth.${event}]`, fields);
}

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

export async function issueAccessToken(userId: string, clientId: string, scope = DEFAULT_SCOPE, resource = RESOURCE) {
  return new SignJWT({ scope, client_id: clientId, resource })
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
