const test = require("node:test");
const assert = require("node:assert/strict");

const {
  activeVariantStocks,
  stockPresentation,
} = require("../lib/product-stock.js");

const {
  HOMEPAGE_IMAGE_SLOTS,
  canManageHomepageImages,
  mergeHomepageImages,
  safeImageExtension,
} = require("../lib/itaba-homepage-images.js");

test("returns only active variant stock quantities", () => {
  const variants = [
    { stock_quantity: 3, is_active: true },
    { stock_quantity: 99, is_active: false },
    { stock_quantity: null, is_active: true },
  ];

  assert.deepEqual(activeVariantStocks(variants), [
    { stock_quantity: 3 },
    { stock_quantity: 0 },
  ]);
});

test("presents untracked, empty, low and healthy stock distinctly", () => {
  assert.deepEqual(stockPresentation(false, []), { label: "—", tone: "untracked" });
  assert.deepEqual(stockPresentation(true, [{ stock_quantity: 0 }]), { label: "0", tone: "out" });
  assert.deepEqual(stockPresentation(true, [{ stock_quantity: 4 }]), { label: "4", tone: "low" });
  assert.deepEqual(stockPresentation(true, [{ stock_quantity: 2 }, { stock_quantity: 5 }]), { label: "7", tone: "ok" });
});

test("defines exactly the five approved homepage image slots with fallbacks", () => {
  assert.deepEqual(HOMEPAGE_IMAGE_SLOTS.map((slot) => slot.id), [
    "hero", "strip_left", "strip_center", "strip_right", "store",
  ]);
  for (const slot of HOMEPAGE_IMAGE_SLOTS) {
    assert.match(slot.recommendedDimensions, /^\d+ × \d+ px$/);
    assert.ok(slot.fallbackUrl.startsWith("https://itaba.de/photos/"));
  }
});

test("merges saved homepage image URLs onto slot fallbacks and ignores unknown slots", () => {
  const slots = mergeHomepageImages(JSON.stringify({
    hero: { url: "https://cdn.example/hero.webp", storage_path: "itaba/homepage/hero.webp" },
    unknown: { url: "https://cdn.example/nope.webp" },
  }));

  assert.equal(slots[0].url, "https://cdn.example/hero.webp");
  assert.equal(slots[0].storagePath, "itaba/homepage/hero.webp");
  assert.equal(slots[1].url, slots[1].fallbackUrl);
  assert.equal(slots.some((slot) => slot.id === "unknown"), false);
});

test("only founders or Itaba users with settings edit permission can manage homepage images", () => {
  assert.equal(canManageHomepageImages("founder", null, {}), true);
  assert.equal(canManageHomepageImages("employee", "itaba", { settings: "edit" }), true);
  assert.equal(canManageHomepageImages("employee", "brandary", { settings: "edit" }), false);
  assert.equal(canManageHomepageImages("employee", "itaba", { settings: "view" }), false);
});

test("accepts only supported image MIME types for safe storage extensions", () => {
  assert.equal(safeImageExtension("image/jpeg"), "jpg");
  assert.equal(safeImageExtension("image/png"), "png");
  assert.equal(safeImageExtension("image/webp"), "webp");
  assert.equal(safeImageExtension("image/svg+xml"), null);
});
