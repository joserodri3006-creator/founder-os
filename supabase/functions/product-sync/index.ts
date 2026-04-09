/**
 * product-sync
 * DB Webhook: trigger on products UPDATE WHERE sync_status = 'pending'
 * Syncs the product to WooCommerce REST API for the corresponding venture.
 *
 * Webhook payload (from Supabase DB Webhooks):
 * { type: "UPDATE", table: "products", record: {...}, old_record: {...} }
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

interface WCProduct {
  id?: number;
  name: string;
  slug?: string;
  status: "publish" | "draft" | "private";
  description?: string;
  short_description?: string;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  date_on_sale_from?: string | null;
  date_on_sale_to?: string | null;
  manage_stock?: boolean;
  stock_quantity?: number;
  weight?: string;
  meta_data?: { key: string; value: string }[];
}

function toWCStatus(status: string): "publish" | "draft" | "private" {
  if (status === "active") return "publish";
  if (status === "archived") return "private";
  return "draft";
}

async function getVentureConfig(venture: string) {
  const keys = ["shop_url", "wc_consumer_key", "wc_consumer_secret"];
  const { data } = await supabase
    .from("system_config")
    .select("key, value")
    .eq("venture", venture)
    .in("key", keys);

  const config: Record<string, string> = {};
  for (const row of data ?? []) config[row.key] = row.value;
  return config;
}

async function syncToWooCommerce(
  product: any,
  config: { shop_url: string; wc_consumer_key: string; wc_consumer_secret: string }
): Promise<{ wc_id: number | null; action: "created" | "updated"; response: any }> {
  const { shop_url, wc_consumer_key, wc_consumer_secret } = config;
  const auth = btoa(`${wc_consumer_key}:${wc_consumer_secret}`);
  const baseUrl = `${shop_url.replace(/\/$/, "")}/wp-json/wc/v3/products`;

  const wcPayload: WCProduct = {
    name: product.name,
    slug: product.slug ?? undefined,
    status: toWCStatus(product.status),
    description: product.description ?? "",
    short_description: product.short_description ?? "",
    sku: product.sku ?? "",
    regular_price: product.price != null ? String(product.price) : "",
    sale_price: product.sale_price != null ? String(product.sale_price) : "",
    date_on_sale_from: product.sale_from ?? null,
    date_on_sale_to: product.sale_until ?? null,
    manage_stock: product.track_inventory ?? false,
    stock_quantity: product.stock_quantity ?? 0,
    weight: product.weight != null ? String(product.weight) : undefined,
    meta_data: [
      ...(product.meta_title ? [{ key: "_yoast_wpseo_title", value: product.meta_title }] : []),
      ...(product.meta_description ? [{ key: "_yoast_wpseo_metadesc", value: product.meta_description }] : []),
    ],
  };

  // If we have a WC product ID, update; otherwise create
  const isUpdate = product.wc_product_id != null;
  const url = isUpdate ? `${baseUrl}/${product.wc_product_id}` : baseUrl;
  const method = isUpdate ? "PUT" : "POST";

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Basic ${auth}`,
    },
    body: JSON.stringify(wcPayload),
  });

  const responseData = await res.json();

  if (!res.ok) {
    throw new Error(`WC API error ${res.status}: ${JSON.stringify(responseData)}`);
  }

  return {
    wc_id: responseData.id ?? null,
    action: isUpdate ? "updated" : "created",
    response: responseData,
  };
}

Deno.serve(async (req) => {
  const body = await req.json();

  // Support both DB webhook format and manual trigger
  const product = body.record ?? body.product;
  if (!product) {
    return new Response(JSON.stringify({ error: "No product in payload" }), { status: 400 });
  }

  // Only process pending products
  if (product.sync_status !== "pending") {
    return new Response(JSON.stringify({ skipped: true, reason: "Not pending" }), { status: 200 });
  }

  const venture = product.venture;
  const productId = product.id;

  // Create a sync log entry
  const { data: logEntry } = await supabase
    .from("product_sync_log")
    .insert({
      product_id: productId,
      venture,
      action: product.wc_product_id ? "update" : "create",
      status: "processing",
    })
    .select()
    .single();

  const logId = logEntry?.id;

  try {
    // Get venture config
    const config = await getVentureConfig(venture);

    if (!config.shop_url || !config.wc_consumer_key || !config.wc_consumer_secret) {
      throw new Error(`Missing WooCommerce config for venture ${venture}. Configure shop_url, wc_consumer_key, wc_consumer_secret in Einstellungen.`);
    }

    // Sync to WooCommerce
    const { wc_id, action, response } = await syncToWooCommerce(product, config as any);

    // Update product: set sync_status = 'synced', last_synced_at, wc_product_id
    await supabase
      .from("products")
      .update({
        sync_status: "synced",
        last_synced_at: new Date().toISOString(),
        wc_product_id: wc_id,
      })
      .eq("id", productId);

    // Update log entry
    if (logId) {
      await supabase
        .from("product_sync_log")
        .update({
          status: "success",
          wc_product_id: wc_id,
          response,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    console.log(`✅ Synced product ${productId} to WC (${action}, wc_id: ${wc_id})`);
    return new Response(JSON.stringify({ success: true, action, wc_id }), { status: 200 });

  } catch (err: any) {
    const message = err.message ?? "Unknown error";
    console.error(`❌ Sync failed for product ${productId}:`, message);

    // Mark product as sync_error
    await supabase
      .from("products")
      .update({ sync_status: "error" })
      .eq("id", productId);

    // Update log
    if (logId) {
      await supabase
        .from("product_sync_log")
        .update({
          status: "error",
          error_message: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
