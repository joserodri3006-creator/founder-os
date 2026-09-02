import { test, expect } from '@playwright/test';
import { Category, Order, Product, PREVIEW_TOKEN, supabaseGet } from './helpers';

test.describe('Founder OS / Supabase data for Itaba', () => {
  test('active Founder OS products match the visible B2C shop assortment', async ({ page }) => {
    const products = await supabaseGet<Product>('products?select=id,name,slug,status,channel,price,weight,images,return_class_id&venture=eq.itaba&status=eq.active&order=name.asc');
    expect(products.length).toBe(6);
    for (const p of products) {
      expect(p.slug).toBeTruthy();
      expect(p.price).toBeGreaterThan(0);
      expect(p.weight, `${p.name} should have weight for shipping`).toBeGreaterThan(0);
      expect((p.images ?? []).length, `${p.name} should have product image`).toBeGreaterThan(0);
    }

    await page.goto(`/shop?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
    for (const p of products) {
      await expect(page.getByRole('link', { name: new RegExp(p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible();
    }
  });

  test('categories exist and reveal empty live categories before launch', async () => {
    const categories = await supabaseGet<Category>('product_categories?select=id,name,slug,sort_order&venture=eq.itaba&order=sort_order.asc');
    expect(categories.map(c => c.slug)).toEqual(['kueche', 'tisch', 'wohnen', 'accessoires', 'lebensmittel']);

    const activeProducts = await supabaseGet<Product>('products?select=id,name,slug,status,channel,price,weight,images&venture=eq.itaba&status=eq.active');
    const maps = await supabaseGet<{product_id: string; category_id: string}>('product_category_map?select=product_id,category_id');
    const activeProductIds = new Set(activeProducts.map(p => p.id));
    const categoryCounts = Object.fromEntries(categories.map(c => [c.slug, 0]));
    for (const map of maps) {
      if (!activeProductIds.has(map.product_id)) continue;
      const cat = categories.find(c => c.id === map.category_id);
      if (cat) categoryCounts[cat.slug]++;
    }

    expect(categoryCounts).toMatchObject({ kueche: 0, tisch: 1, wohnen: 2, accessoires: 0, lebensmittel: 3 });
  });

  test('recent Itaba orders have invoice numbers and expose current invoice generation gap', async () => {
    const orders = await supabaseGet<Order>('orders?select=id,invoice_number,title,status,value,channel,invoice_generated_at,invoice_html,invoice_sent,invoice_data,notes,created_at&venture=eq.itaba&order=created_at.desc&limit=10');
    expect(orders.length).toBeGreaterThan(0);
    for (const order of orders.slice(0, 3)) {
      expect(order.invoice_number).toMatch(/^IT-/);
      expect(order.value).toBeGreaterThan(0);
    }

    // Acceptance guard: if invoices are expected automatically, this currently documents the failing behavior.
    const newestNonTest = orders.find(o => !/HERMES/.test(`${o.notes ?? ''} ${o.invoice_data?.customer?.name ?? ''}`));
    expect(newestNonTest, 'Need at least one non-test order to audit invoice fields').toBeTruthy();
    expect(newestNonTest!.invoice_generated_at, 'Invoice generation is not yet set on recent Itaba orders').not.toBeNull();
    expect(Boolean(newestNonTest!.invoice_html), 'Invoice HTML/PDF payload should exist').toBe(true);
  });

  test('returns table contains processable Itaba returns', async () => {
    const returns = await supabaseGet<any>('returns?select=id,order_id,venture,status,reason,items,customer_email,customer_name,requested_at,processed_at,notes&venture=eq.itaba');
    expect(returns.length).toBeGreaterThan(0);
    for (const ret of returns) {
      expect(ret.order_id).toBeTruthy();
      expect(ret.customer_email).toContain('@');
      expect(Array.isArray(ret.items)).toBe(true);
      expect(ret.status).toMatch(/requested|approved|rejected|processed|completed/i);
    }
  });
});
