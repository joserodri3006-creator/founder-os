import { test, expect } from '@playwright/test';
import { cancelTestOrder, createBarPickupOrderViaApi, PREVIEW_TOKEN, uniqueTestStamp } from './helpers';

const previewCookie = { Cookie: `itaba_preview_access=${PREVIEW_TOKEN}` };

test.describe('Itaba service flows', () => {
  test('tracking and return lookup reject unknown orders cleanly', async ({ request }) => {
    const endpoints = ['/api/sendungsverfolgung', '/api/retoure'];
    for (const endpoint of endpoints) {
      const res = await request.get(`${endpoint}?order_id=HERMES-NOT-FOUND&email=test@example.com`, { headers: previewCookie });
      const body = await res.json();
      expect(res.status()).toBe(404);
      expect(body.error).toMatch(/nicht gefunden/i);
    }
  });

  test('tracking and return lookup find a real marked pickup order', async ({ request }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order.');
    const order = await createBarPickupOrderViaApi(request);
    try {
      const byId = await (await request.get(`/api/sendungsverfolgung?order_id=${order.order_id}&email=${encodeURIComponent(order.customer.email)}`, { headers: previewCookie })).json();
      expect(byId.order_number).toMatch(/^IT-/);
      expect(byId.delivery_method).toBe('abholung');
      expect(byId.total).toBe(29.9);

      const retoure = await request.get(`/api/retoure?order_id=${byId.order_number}&email=${encodeURIComponent(order.customer.email)}`, { headers: previewCookie });
      expect(retoure.status()).toBe(200);
      const retBody = await retoure.json();
      expect(retBody.items[0].name).toContain('Teller rund');
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });

  test('return request can be created for a real marked order', async ({ request }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to create a real marked test order and return.');
    const order = await createBarPickupOrderViaApi(request);
    try {
      const res = await request.post('/api/retoure', {
        headers: previewCookie,
        data: {
          order_id: order.order_id,
          email: order.customer.email,
          items: [{ name: 'Teller rund Ø21cm, H3cm', qty: 1 }],
          reason: 'HERMES PLAYWRIGHT TESTRETOURE – bitte ignorieren',
        },
      });
      expect(res.status(), await res.text()).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      // Marking the return itself is handled via the reason string; return API only exposes ok=true.
    } finally {
      await cancelTestOrder(order.order_id);
    }
  });

  test('contact form validates invalid input', async ({ page }) => {
    await page.goto(`/kontakt?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /Nachricht senden/i }).click();
    await expect(page.locator('input[name="name"]')).toBeFocused();
  });

  test('contact form can send marked test message', async ({ page }) => {
    test.skip(process.env.RUN_SIDE_EFFECTS !== '1', 'Set RUN_SIDE_EFFECTS=1 to send a real marked test contact message.');
    await page.goto(`/kontakt?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
    const stamp = uniqueTestStamp();
    await page.locator('input[name="name"]').fill(`HERMES KONTAKT TEST ${stamp}`);
    await page.locator('input[name="email"]').fill(`hermes-contact-${stamp}@example.com`);
    await page.locator('select[name="betreff"]').selectOption({ label: 'Sonstiges' });
    await page.locator('textarea[name="nachricht"]').fill(`HERMES PLAYWRIGHT TEST ${stamp}: Bitte ignorieren.`);
    await page.getByRole('button', { name: /Nachricht senden/i }).click();
    await expect(page.locator('body')).toContainText(/Nachricht erhalten|Bestätigung wurde an Ihre E-Mail gesendet/i);
  });
});
