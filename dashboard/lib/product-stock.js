function activeVariantStocks(variants) {
  if (!Array.isArray(variants)) return [];
  return variants
    .filter((variant) => variant && variant.is_active === true)
    .map((variant) => ({ stock_quantity: Number(variant.stock_quantity) || 0 }));
}

function stockPresentation(trackInventory, variants) {
  if (!trackInventory) return { label: "—", tone: "untracked" };
  const total = (Array.isArray(variants) ? variants : []).reduce(
    (sum, variant) => sum + (Number(variant?.stock_quantity) || 0),
    0,
  );
  if (total <= 0) return { label: String(total), tone: "out" };
  if (total <= 4) return { label: String(total), tone: "low" };
  return { label: String(total), tone: "ok" };
}

module.exports = { activeVariantStocks, stockPresentation };
