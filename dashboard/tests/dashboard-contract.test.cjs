const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dashboard = path.resolve(__dirname, '..');
const repo = path.resolve(dashboard, '..');
const readDashboard = (file) => fs.readFileSync(path.join(dashboard, file), 'utf8');
const readRepo = (file) => fs.readFileSync(path.join(repo, file), 'utf8');

test('dashboard supports the deployed RPC field names and a real retry', () => {
  const page = readDashboard('app/dashboard/page.tsx');
  assert.match(page, /period\?\.from/);
  assert.match(page, /period\?\.to_exclusive/);
  assert.match(page, /open_total/);
  assert.match(page, /runs_in_period/);
  assert.match(page, /setReloadKey/);
  assert.doesNotMatch(page, /setAsOf\(asOf\)/);
});

test('dashboard exposes the agreed business and agent metrics', () => {
  const page = readDashboard('app/dashboard/page.tsx');
  for (const label of [
    'Gewonnene Leads',
    'Neue Kunden',
    'Offene Leads',
    'Erstellte Aufgaben',
    'Erledigte Aufgaben',
    'Aktive Produkte',
    'Einnahmen',
    'Ausgaben',
  ]) assert.match(page, new RegExp(label));
  assert.match(page, /agents\.items/);
  assert.match(page, /last_run_at/);
});

test('agent API uses the authenticated Supabase client and RLS', () => {
  const route = readDashboard('app/api/agenten/route.ts');
  assert.match(route, /createClient/);
  assert.match(route, /auth\.getUser/);
  assert.doesNotMatch(route, /supabaseAdmin/);
});

test('dashboard migration adds the full period, trend and agent contract', () => {
  const migration = readRepo('supabase/migrations/20261127234027_align_dashboard_contract.sql');
  assert.match(migration, /'start', v_start/);
  assert.match(migration, /'end', v_end - 1/);
  assert.match(migration, /'items', ai\.items/);
  assert.match(migration, /'trend', tj\.trend/);
  assert.match(migration, /customers_venture_created_idx/);
});
