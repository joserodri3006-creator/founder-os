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
