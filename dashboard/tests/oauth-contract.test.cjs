const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('OAuth contract publishes task scopes and resource metadata', () => {
  const oauth = read('lib/mcp-oauth.ts');
  const authorization = read('app/.well-known/oauth-authorization-server/route.ts');
  const protectedResource = read('app/.well-known/oauth-protected-resource/mcp/route.ts');
  assert.match(oauth, /tasks:read/);
  assert.match(oauth, /tasks:write/);
  assert.match(authorization, /SUPPORTED_SCOPES/);
  assert.match(protectedResource, /SUPPORTED_SCOPES/);
});

test('authorization enforces S256 and binds resource and exact redirect URI', () => {
  const source = read('app/oauth/authorize/route.ts');
  assert.match(source, /code_challenge_method/);
  assert.match(source, /S256/);
  assert.match(source, /resource/);
  assert.match(source, /redirect_uris\.includes\(redirectUri\)/);
});

test('token exchange requires exact redirect, resource, PKCE, and logs safe events', () => {
  const source = read('app/oauth/token/route.ts');
  assert.match(source, /resource/);
  assert.match(source, /row\.redirect_uri === effectiveRedirectUri/);
  assert.match(source, /oauthLog/);
  assert.doesNotMatch(source, /normalizeRedirectUri/);
});

test('MCP tools enforce task scopes from the access token', () => {
  const source = read('app/mcp/route.ts');
  assert.match(source, /tasks:read/);
  assert.match(source, /tasks:write/);
  assert.match(source, /scope/);
});

test('MCP rejects anonymous access and has no hard-coded user identity', () => {
  const source = read('app/mcp/route.ts');
  assert.doesNotMatch(source, /MCP_PUBLIC_ACCESS/);
  assert.doesNotMatch(source, /1a996185-21dc-49ad-bbb0-beb246da85d2/);
  assert.match(source, /if \(!auth\.startsWith\("Bearer "\)\) return unauthorized\(\)/);
});

test('MCP resolves venture roles and checks section permissions before data access', () => {
  const source = read('app/mcp/route.ts');
  const access = read('lib/mcp-access.ts');
  assert.match(source, /getMcpAccess\(userId\)/);
  assert.match(source, /canUseSection\(access, venture, "leads", "view"\)/);
  assert.match(source, /loadTaskAccess\(id, "edit"\)/);
  assert.match(access, /user_venture_roles/);
  assert.match(access, /row\.venture === venture/);
});

test('OAuth authorization accepts assigned app users instead of founder-only access', () => {
  const source = read('app/oauth/authorize/route.ts');
  assert.match(source, /getMcpAccess\(userId\)/);
  assert.doesNotMatch(source, /isFounder/);
  assert.doesNotMatch(source, /Nur Founder/);
});
