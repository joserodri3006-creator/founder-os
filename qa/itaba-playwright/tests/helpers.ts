import { Page, expect } from '@playwright/test';
import fs from 'node:fs';

export const PREVIEW_TOKEN = process.env.ITABA_PREVIEW_TOKEN ?? '';
export const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
export const SUPABASE_KEYS_FILE = process.env.SUPABASE_KEYS_FILE ?? '/opt/data/env.brandary_supabase/supabase_keys.txt';

export type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  status: string;
  channel: string | null;
  weight: number | null;
  images: unknown[] | null;
  return_class_id?: string | null;
};

export type Category = { id: string; name: string; slug: string; sort_order: number };
export type Order = {
  id: string;
  invoice_number: string | null;
  title: string;
  status: string;
  value: number;
  invoice_generated_at: string | null;
  invoice_html: string | null;
  invoice_sent: boolean;
  invoice_data: any;
  notes: string | null;
};

export async function openPreviewShop(page: Page) {
  if (!PREVIEW_TOKEN) throw new Error('ITABA_PREVIEW_TOKEN is required for preview-shop tests.');
  await page.goto(`/shop?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
  await expect(page).toHaveURL(/\/shop/);
}

export async function acceptOnlyRequiredCookies(page: Page) {
  const button = page.getByRole('button', { name: /nur notwendige/i });
  if (await button.isVisible().catch(() => false)) await button.click();
}

export function uniqueTestStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

export function readSupabaseServiceKey(): string {
  const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (envKey) return envKey.trim();
  const raw = fs.readFileSync(SUPABASE_KEYS_FILE, 'utf8');
  const candidates = raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => line.includes('=') ? line.split('=').slice(1).join('=').trim() : line);
  candidates.sort((a, b) => b.length - a.length);
  if (!candidates[0]) throw new Error(`No Supabase key found in ${SUPABASE_KEYS_FILE}`);
  return candidates[0];
}

export async function supabaseGet<T>(tableAndQuery: string): Promise<T[]> {
  const key = readSupabaseServiceKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableAndQuery}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${tableAndQuery} failed ${res.status}: ${await res.text()}`);
  return await res.json() as T[];
}

export async function supabasePatch<T>(table: string, filter: string, payload: Record<string, unknown>): Promise<T[]> {
  const key = readSupabaseServiceKey();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${table}?${filter} failed ${res.status}: ${await res.text()}`);
  return await res.json() as T[];
}

export async function createBarPickupOrderViaApi(request: any, stamp = uniqueTestStamp()) {
  const customer = {
    name: `HERMES PLAYWRIGHT TEST ${stamp}`,
    email: `hermes-itaba-playwright-${stamp}@example.com`,
    phone: '+49 000 000000 PLAYWRIGHT TEST',
  };
  const res = await request.post('/api/checkout/bar', {
    headers: { Cookie: `itaba_preview_access=${PREVIEW_TOKEN}` },
    data: {
      items: [{ slug: 'teller-rund-oe21cm-h3cm', quantity: 1 }],
      customer,
    },
  });
  const body = await res.json().catch(() => ({}));
  expect(res.status(), JSON.stringify(body)).toBe(200);
  expect(body.order_id).toBeTruthy();
  await supabasePatch<Order>('orders', `id=eq.${body.order_id}`, {
    notes: 'HERMES PLAYWRIGHT TEST – bitte ignorieren; wird vom Test als storniert markiert.',
  });
  return { ...body, customer, stamp };
}

export async function cancelTestOrder(orderId: string) {
  await supabasePatch<Order>('orders', `id=eq.${orderId}`, {
    status: 'storniert',
    notes: 'HERMES PLAYWRIGHT TEST – nach E2E-Abnahmetest automatisch als storniert markiert.',
  });
}
