import { test, expect } from '@playwright/test';
import { acceptOnlyRequiredCookies, openPreviewShop, PREVIEW_TOKEN } from './helpers';

const expectedProducts = [
  'Teller rund Ø21cm, H3cm',
  'Sencha Tagashira Chao, 12PC Teebeutel',
  'Daruma 12cm',
  'Genmaicha Tagashira Chao, 13PC Teebeutel',
  'Daruma 9cm',
  'Hojicha Tagashira Chao, 13PC Teebeutel',
];

const categoryExpectations = [
  { slug: 'kueche', label: 'Küche', count: 0 },
  { slug: 'tisch', label: 'Tisch', count: 1 },
  { slug: 'wohnen', label: 'Wohnen', count: 2 },
  { slug: 'accessoires', label: 'Accessoires', count: 0 },
  { slug: 'lebensmittel', label: 'Lebensmittel', count: 3 },
];

test.describe('Itaba public shop and content', () => {
  test('preview shop loads, exposes expected active products, and has no JS errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

    await openPreviewShop(page);
    await acceptOnlyRequiredCookies(page);

    await expect(page).toHaveTitle(/Shop \| iTABA/);
    await expect(page.getByText(/6\s*Produkte?/i)).toBeVisible();
    for (const product of expectedProducts) await expect(page.getByRole('link', { name: new RegExp(product.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })).toBeVisible();

    expect(consoleErrors).toEqual([]);
  });

  for (const cat of categoryExpectations) {
    test(`category ${cat.label} exposes expected active product count`, async ({ page }) => {
      await page.goto(`/shop?preview=${PREVIEW_TOKEN}&kategorie=${cat.slug}`, { waitUntil: 'networkidle' });
      await expect(page.getByRole('heading', { name: cat.label })).toBeVisible();
      await expect(page.getByText(new RegExp(`${cat.count}\\s*Produkte?`, 'i'))).toBeVisible();
      if (cat.count === 0) await expect(page.getByText(/Keine Produkte gefunden/i)).toBeVisible();
    });
  }

  test('all active product detail pages expose price, VAT, shipping, weight and add-to-cart', async ({ page }) => {
    await openPreviewShop(page);
    const hrefs = await page.locator('a[href^="/shop/"]').evaluateAll(links =>
      Array.from(new Set(links.map(link => (link as HTMLAnchorElement).getAttribute('href')).filter(Boolean)))
    );
    expect(hrefs.length).toBeGreaterThanOrEqual(6);

    for (const href of hrefs) {
      await page.goto(href!, { waitUntil: 'networkidle' });
      await expect(page.getByText(/inkl\. MwSt\./i)).toBeVisible();
      await expect(page.getByText(/zzgl\. Versand/i)).toBeVisible();
      await expect(page.getByText(/Gewicht:/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /In den Warenkorb/i })).toBeVisible();
    }
  });

  test('service and legal pages are reachable and contain core information', async ({ page }) => {
    const pages = [
      ['/versand', /Versand & Rückgabe|Versand/i],
      ['/sendungsverfolgung', /Bestellnummer.*E-Mail|Sendungsverfolgung/i],
      ['/retoure', /Retoure beantragen|Bestellnummer/i],
      ['/kontakt', /Kontakt|Töngesgasse 42|itabashopffm@gmail\.com/i],
      ['/impressum', /ITABA GmbH|HRB|Chang Hyun Kim/i],
      ['/datenschutz', /Datenschutzerklärung|DSGVO|Supabase/i],
      ['/agb', /Allgemeine Geschäftsbedingungen|PayPal|Barzahlung/i],
      ['/widerruf', /Widerrufsbelehrung|vierzehn Tagen/i],
    ] as const;
    for (const [url, text] of pages) {
      await page.goto(`${url}?preview=${PREVIEW_TOKEN}`, { waitUntil: 'networkidle' });
      await expect(page.locator('body')).toContainText(text);
    }
  });

  test('robots and sitemap contain expected public/private routes', async ({ request }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).toContain('Disallow: /api/');
    expect(robots).toContain('Disallow: /cart');
    expect(robots).toContain('Disallow: /kasse');
    expect(robots).toContain('Disallow: /b2b/');

    const sitemap = await (await request.get('/sitemap.xml')).text();
    expect(sitemap).toContain('<loc>https://itaba.de/shop</loc>');
    expect(sitemap).toContain('/shop/teller-rund-oe21cm-h3cm');
  });
});
