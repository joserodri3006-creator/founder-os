import { test, expect } from '@playwright/test';
import { cancelTestOrder, createBarPickupOrderViaApi, supabaseGet, uniqueTestStamp } from './helpers';

const expectedCategories = ['Tisch', 'Wohnen', 'Accessoires', 'Küche', 'Lebensmittel'];

test.describe('Itaba approved change round', () => {
  test('desktop header has Home, Shop submenu, Story, Kontakt and cart in approved structure', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/shop', { waitUntil: 'networkidle' });
    const nav = page.getByRole('navigation', { name: /Hauptnavigation/i });
    await expect(nav.getByRole('link', { name: 'Home', exact: true })).toBeVisible();
    const shop = nav.getByRole('link', { name: 'Shop', exact: true });
    await expect(shop).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Story', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Kontakt', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Warenkorb/i })).toBeVisible();
    await shop.hover();
    const submenu = page.locator('header').getByRole('link').filter({ hasText: /Tisch|Wohnen|Accessoires|Küche|Lebensmittel/ });
    await expect(submenu).toHaveCount(5);
    expect(await submenu.allInnerTexts()).toEqual(expectedCategories);
  });

  test('mobile header exposes expandable Shop submenu in approved order', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/shop', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Menü öffnen/i }).click();
    const shopButton = page.getByRole('button', { name: 'Shop', exact: true });
    await shopButton.click();
    for (const category of expectedCategories) await expect(page.getByRole('link', { name: category, exact: true })).toBeVisible();
    const categoryTexts = await page.locator('header a[href*="kategorie="]').allInnerTexts();
    expect(categoryTexts).toEqual(expectedCategories);
  });

  test('checkout uses the same numbered contact and payment steps for shipping and pickup', async ({ page }) => {
    await page.goto('/shop/teller-rund-oe21cm-h3cm', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /In den Warenkorb/i }).click();
    await page.goto('/kasse', { waitUntil: 'networkidle' });
    await expect(page.getByText(/1 · Lieferart/i)).toBeVisible();
    await expect(page.getByText(/2 · Kontaktdaten/i)).toBeVisible();
    await expect(page.getByText(/3 · Zahlung & Lieferadresse/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Vor- und Nachname/i)).toBeVisible();
    await page.getByText(/Abholung/).first().click();
    await expect(page.getByText(/2 · Kontaktdaten/i)).toBeVisible();
    await expect(page.getByText(/^3 · Zahlung$/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Vor- und Nachname/i)).toBeVisible();
  });

  test('invalid voucher stays invalid and active voucher is calculated server-side', async ({ request }) => {
    const invalid = await request.post('/api/voucher/redeem', { data: { code: 'NOT-A-VOUCHER', order_value: 100, venture: 'itaba' } });
    expect((await invalid.json()).valid).toBe(false);
    const valid = await request.post('/api/voucher/redeem', { data: { code: 'WILLKOMMEN10', order_value: 100, venture: 'itaba', customer_email: 'voucher-check@example.com' } });
    expect(valid.status()).toBe(200);
    const body = await valid.json();
    expect(body.valid).toBe(true);
    expect(body.discount).toBe(10);
    expect(body.voucherId).toBeTruthy();
  });

  test('new order uses IT plus six digits, reserves stock, and cancellation restores it', async ({ request }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 for stock lifecycle test.');
    const before = await supabaseGet<any>('products?select=id,slug,product_variants(id,stock_quantity,is_active)&venture=eq.itaba&slug=eq.teller-rund-oe21cm-h3cm');
    const beforeStock = before[0].product_variants.find((v: any) => v.is_active).stock_quantity;
    const order = await createBarPickupOrderViaApi(request, uniqueTestStamp());
    try {
      const lookup = await (await request.get(`/api/sendungsverfolgung?order_id=${order.order_id}&email=${encodeURIComponent(order.customer.email)}`)).json();
      expect(lookup.order_number).toMatch(/^IT\d{6}$/);
      const reserved = await supabaseGet<any>('products?select=product_variants(id,stock_quantity,is_active)&venture=eq.itaba&slug=eq.teller-rund-oe21cm-h3cm');
      expect(reserved[0].product_variants.find((v: any) => v.is_active).stock_quantity).toBe(beforeStock - 1);
    } finally {
      await cancelTestOrder(order.order_id);
    }
    const restored = await supabaseGet<any>('products?select=product_variants(id,stock_quantity,is_active)&venture=eq.itaba&slug=eq.teller-rund-oe21cm-h3cm');
    expect(restored[0].product_variants.find((v: any) => v.is_active).stock_quantity).toBe(beforeStock);
  });
});
