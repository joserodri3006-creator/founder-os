import { test, expect } from '@playwright/test';
import { acceptOnlyRequiredCookies, cancelTestOrder, createBarPickupOrderViaApi, openPreviewShop, uniqueTestStamp } from './helpers';

test.describe('Itaba B2C cart and checkout', () => {
  test('customer can add product to cart and reach checkout with correct totals', async ({ page }) => {
    await openPreviewShop(page);
    await acceptOnlyRequiredCookies(page);
    await page.goto('/shop/teller-rund-oe21cm-h3cm', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /In den Warenkorb/i }).click();
    await expect(page.locator('body')).toContainText(/Teller rund Ø21cm, H3cm/i);

    await page.goto('/cart', { waitUntil: 'networkidle' });
    await expect(page.locator('body')).toContainText(/Teller rund Ø21cm, H3cm/i);
    await expect(page.locator('body')).toContainText(/29,90\s*€/i);
    await page.getByRole('link', { name: /Zur Kasse/i }).click();

    await expect(page).toHaveURL(/\/kasse/);
    await expect(page.locator('body')).toContainText(/Kasse/i);
    await expect(page.locator('body')).toContainText(/Gesamt\s*34,80\s*€/i);
    await expect(page.locator('body')).toContainText(/Zahlung & Adresse|PayPal/i);
  });

  test('pickup/bar checkout form is fillable and shows free pickup total before submit', async ({ page }) => {
    await openPreviewShop(page);
    await page.goto('/shop/teller-rund-oe21cm-h3cm', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /In den Warenkorb/i }).click();
    await page.goto('/kasse', { waitUntil: 'networkidle' });
    await page.getByText(/Abholung/).first().click();

    const stamp = uniqueTestStamp();
    await page.locator('input').nth(0).fill(`HERMES NO-SUBMIT ${stamp}`);
    await page.locator('input').nth(1).fill(`hermes-no-submit-${stamp}@example.com`);
    await expect(page.locator('body')).toContainText(/Versand\s*Kostenlos/i);
    await expect(page.locator('body')).toContainText(/Gesamt\s*29,90\s*€/i);
    await expect(page.getByRole('button', { name: /Bestellung vormerken/i })).toBeVisible();
  });

  test('bar checkout API creates Founder OS order and cleanup can cancel it', async ({ request }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');
    const order = await createBarPickupOrderViaApi(request);
    try {
      expect(order.redirect).toContain('/bestellung/abholung?id=');
      expect(order.total).toBe(29.9);
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });

  test('pickup/bar UI redirects to order success page after creating order', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');
    const stamp = uniqueTestStamp();
    await openPreviewShop(page);
    await page.goto('/shop/teller-rund-oe21cm-h3cm', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /In den Warenkorb/i }).click();
    await page.goto('/kasse', { waitUntil: 'networkidle' });
    await page.getByText(/Abholung/).first().click();
    await page.locator('input').nth(0).fill(`HERMES UI TEST ${stamp}`);
    await page.locator('input').nth(1).fill(`hermes-ui-${stamp}@example.com`);
    await page.locator('input').nth(2).fill('+49 000 000000 PLAYWRIGHT UI TEST');
    await page.getByRole('button', { name: /Bestellung vormerken/i }).click();

    await expect(page).toHaveURL(/\/bestellung\/abholung\?id=/, { timeout: 15_000 });
    await expect(page.locator('body')).toContainText(/Bestellung|Abholung|vorgemerkt|erfolgreich/i);
    const orderId = new URL(page.url()).searchParams.get('id');
    expect(orderId).toBeTruthy();
    await cancelTestOrder(orderId!);
  });
});
