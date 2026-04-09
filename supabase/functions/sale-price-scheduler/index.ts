/**
 * sale-price-scheduler
 * Cron: täglich 00:01 UTC
 * Prüft Produkte, bei denen sale_from oder sale_until heute liegt,
 * und setzt sync_status = 'pending' damit der Storefront-Sync greift.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  const now = new Date();

  // Heute als Datumsbereich (00:00 – 23:59:59 UTC)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setUTCHours(23, 59, 59, 999);

  // Gestern
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
  const yesterdayEnd = new Date(todayEnd);
  yesterdayEnd.setUTCDate(yesterdayEnd.getUTCDate() - 1);

  // 1. Produkte mit sale_from = heute → Aktionspreis startet
  const { data: starting, error: e1 } = await supabase
    .from("products")
    .select("id, name, venture, sale_price, sale_from, sale_until")
    .not("sale_price", "is", null)
    .gte("sale_from", todayStart.toISOString())
    .lte("sale_from", todayEnd.toISOString());

  // 2. Produkte mit sale_until = gestern → Aktionspreis abgelaufen
  const { data: ending, error: e2 } = await supabase
    .from("products")
    .select("id, name, venture, sale_price, sale_from, sale_until")
    .not("sale_until", "is", null)
    .gte("sale_until", yesterdayStart.toISOString())
    .lte("sale_until", yesterdayEnd.toISOString());

  if (e1 || e2) {
    console.error("Query errors:", e1?.message, e2?.message);
    return new Response(JSON.stringify({ error: e1?.message ?? e2?.message }), { status: 500 });
  }

  const toSync = [...(starting ?? []), ...(ending ?? [])];

  if (toSync.length === 0) {
    console.log("Keine Produkte mit Preisänderung heute.");
    return new Response(JSON.stringify({ synced: 0, message: "Nichts zu tun" }), { status: 200 });
  }

  // sync_status = 'pending' setzen → product-sync Edge Function wird durch DB-Webhook getriggert
  const ids = toSync.map((p) => p.id);
  const { error: updateErr } = await supabase
    .from("products")
    .update({ sync_status: "pending" })
    .in("id", ids);

  if (updateErr) {
    console.error("Update error:", updateErr.message);
    return new Response(JSON.stringify({ error: updateErr.message }), { status: 500 });
  }

  const summary = toSync.map((p) => ({
    id: p.id,
    name: p.name,
    venture: p.venture,
    action: (starting ?? []).find((s) => s.id === p.id) ? "sale_started" : "sale_ended",
  }));

  console.log(`✅ ${toSync.length} Produkte auf 'pending' gesetzt:`, summary);
  return new Response(JSON.stringify({ synced: toSync.length, products: summary }), { status: 200 });
});
