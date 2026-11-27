const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = path.resolve(__dirname, '..');
const repo = path.resolve(dashboard, '..');
const readDashboard = (file) => fs.readFileSync(path.join(dashboard, file), 'utf8');
const readRepo = (file) => fs.readFileSync(path.join(repo, file), 'utf8');

test('Supabase OAuth consent uses the existing Founder OS session', () => {
  const page = readDashboard('app/oauth/consent/page.tsx');
  const decision = readDashboard('app/api/oauth/decision/route.ts');
  assert.match(page, /getAuthorizationDetails/);
  assert.match(decision, /approveAuthorization/);
  assert.match(decision, /denyAuthorization/);
  assert.match(decision, /blazed_outfitters/);
});

test('login preserves the OAuth return path safely', () => {
  const login = readDashboard('app/login/page.tsx');
  const callback = readDashboard('app/auth/callback/route.ts');
  assert.match(login, /requestedNext\?\.startsWith\("\/"\)/);
  assert.match(login, /!requestedNext\.startsWith\("\/\/"\)/);
  assert.match(login, /router\.push\(nextPath \|\|/);
  assert.match(callback, /requestedNext\?\.startsWith\("\/"\)/);
  assert.match(callback, /!requestedNext\.startsWith\("\/\/"\)/);
});

test('Blazed Edge Function authenticates users and hard-codes the venture boundary', () => {
  const source = readRepo('supabase/functions/blazed-ai/index.ts');
  assert.match(source, /withOAuthProtectedResource\(\)/);
  assert.match(source, /withSupabase\(\{ auth: "user" \}\)/);
  assert.match(source, /const VENTURE = "blazed_outfitters"/);
  assert.match(source, /user_venture_roles/);
  assert.doesNotMatch(source, /service_role.*NEXT_PUBLIC/i);
  assert.doesNotMatch(source, /execute_sql/i);
});

test('Blazed Edge Function exposes business tools without arbitrary table access', () => {
  const source = readRepo('supabase/functions/blazed-ai/index.ts');
  assert.match(source, /get_blazed_overview/);
  assert.match(source, /list_blazed_records/);
  assert.match(source, /create_blazed_record/);
  assert.match(source, /update_blazed_record/);
  assert.match(source, /list_blazed_child_records/);
  assert.doesNotMatch(source, /resource:\s*z\.string\(\)/);
  assert.doesNotMatch(source, /table:\s*z\.string\(\)/);
});
