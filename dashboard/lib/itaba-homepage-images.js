const HOMEPAGE_IMAGE_SLOTS = [
  { id: "hero", label: "Hero-Bild", recommendedDimensions: "1920 × 1080 px", fallbackUrl: "https://itaba.de/photos/store-ceramics.jpg" },
  { id: "strip_left", label: "Bildleiste links", recommendedDimensions: "800 × 1000 px", fallbackUrl: "https://itaba.de/photos/store-interior.jpg" },
  { id: "strip_center", label: "Bildleiste Mitte", recommendedDimensions: "800 × 1000 px", fallbackUrl: "https://itaba.de/photos/store-bowls.jpg" },
  { id: "strip_right", label: "Bildleiste rechts", recommendedDimensions: "800 × 1000 px", fallbackUrl: "https://itaba.de/photos/store-shelves.jpg" },
  { id: "store", label: "Store-Bild", recommendedDimensions: "1600 × 1000 px", fallbackUrl: "https://itaba.de/photos/store-interior.jpg" },
];

function parseImages(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function mergeHomepageImages(value) {
  const images = parseImages(value);
  return HOMEPAGE_IMAGE_SLOTS.map((slot) => {
    const saved = images[slot.id];
    const url = typeof saved === "string" ? saved : saved?.url;
    const storagePath = typeof saved === "object" ? saved?.storage_path : undefined;
    return {
      ...slot,
      url: typeof url === "string" && url ? url : slot.fallbackUrl,
      storagePath: typeof storagePath === "string" ? storagePath : null,
      isFallback: !(typeof url === "string" && url),
    };
  });
}

function canManageHomepageImages(role, venture, permissions) {
  return role === "founder" || (venture === "itaba" && permissions?.settings === "edit");
}

function safeImageExtension(mimeType) {
  return ({
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  })[mimeType] ?? null;
}

module.exports = {
  HOMEPAGE_IMAGE_SLOTS,
  canManageHomepageImages,
  mergeHomepageImages,
  parseImages,
  safeImageExtension,
};
