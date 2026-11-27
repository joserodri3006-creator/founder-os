import { createMcpHandler, McpServer } from "npm:@modelcontextprotocol/server@2.0.0";
import { pipeline } from "npm:@supabase/middleware@1.0.0";
import { withOAuthProtectedResource, withSupabase } from "npm:@supabase/server@1.0.0";
import { createClient } from "npm:@supabase/supabase-js@2.100.1";
import { z } from "npm:zod@4.3.6";

const VENTURE = "blazed_outfitters";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const directResources = {
  products: { table: "products", search: "name", order: "updated_at", venture: true, status: true },
  product_types: { table: "product_types", search: "name", order: "created_at", venture: true },
  product_brands: { table: "product_brands", search: "name", order: "created_at", venture: true },
  product_categories: { table: "product_categories", search: "name", order: "sort_order", venture: true },
  product_tags: { table: "product_tags", search: "name", order: "name", venture: true },
  product_locations: { table: "product_locations", search: "name", order: "created_at", venture: true },
  suppliers: { table: "suppliers", search: "name", order: "created_at", venture: true },
  tax_classes: { table: "tax_classes", search: "name", order: "created_at", venture: true },
  customers: { table: "customers", search: "company_name", order: "updated_at", venture: true, status: true },
  customer_tags: { table: "customer_tags", search: "name", order: "name", venture: true },
  leads: { table: "leads", search: "company_name", order: "updated_at", venture: true, status: true },
  lead_tags: { table: "lead_tags", search: "name", order: "name", venture: true },
  orders: { table: "orders", search: "title", order: "updated_at", venture: true, status: true },
  payment_models: { table: "payment_models", search: "name", order: "created_at", venture: true },
  tasks: { table: "tasks", search: "title", order: "updated_at", venture: true, status: true },
  finance_entries: { table: "finance_entries", search: "description", order: "entry_date", venture: true, status: true },
  inventory_movements: { table: "inventory_movements", search: "note", order: "created_at", venture: true },
  returns: { table: "returns", search: "customer_name", order: "requested_at", venture: true, status: true },
  return_classes: { table: "return_classes", search: "name", order: "created_at", venture: true },
  reviews: { table: "reviews", search: "title", order: "submitted_at", venture: true, status: true },
  review_invitations: { table: "review_invitations", search: "email", order: "created_at", venture: true, status: true },
  vouchers: { table: "vouchers", search: "code", order: "created_at", venture: true, status: true },
  mail_templates: { table: "mail_templates", search: "name", order: "created_at", venture: true },
  outreach_templates: { table: "outreach_templates", search: "name", order: "created_at", venture: true },
  portfolio_projects: { table: "portfolio_projects", search: "name", order: "updated_at", venture: true, status: true },
  attachments: { table: "attachments", search: "filename", order: "created_at", venture: true },
  inbox_messages: { table: "inbox_messages", search: "subject", order: "created_at", venture: true },
  b2b_category_discounts: { table: "b2b_category_discounts", search: null, order: "created_at", venture: true },
  b2b_product_discounts: { table: "b2b_product_discounts", search: null, order: "created_at", venture: true },
  affiliates: { table: "affiliates", search: "display_name", order: "created_at", venture: false, status: true },
  affiliate_links: { table: "affiliate_links", search: "campaign_name", order: "created_at", venture: false },
  affiliate_coupons: { table: "affiliate_coupons", search: "code", order: "created_at", venture: false, status: true },
  affiliate_visits: { table: "affiliate_visits", search: "landing_url", order: "created_at", venture: false },
  affiliate_orders: { table: "affiliate_orders", search: null, order: "created_at", venture: false, status: true },
  affiliate_commissions: { table: "affiliate_commissions", search: null, order: "created_at", venture: false, status: true },
  affiliate_payouts: { table: "affiliate_payouts", search: "payout_reference", order: "created_at", venture: false, status: true },
  affiliate_assets: { table: "affiliate_assets", search: "title", order: "created_at", venture: false, status: true },
  affiliate_settings: { table: "affiliate_settings", search: "key", order: "key", venture: false, keyField: "key" },
} as const;

const childResources = {
  product_variants: { table: "product_variants", parentField: "product_id", parent: "products" },
  product_variant_options: { table: "product_variant_options", parentField: "product_id", parent: "products" },
  product_category_map: { table: "product_category_map", parentField: "product_id", parent: "products" },
  product_tag_map: { table: "product_tag_map", parentField: "product_id", parent: "products" },
  product_supplier_map: { table: "product_supplier_map", parentField: "product_id", parent: "products" },
  product_sync_log: { table: "product_sync_log", parentField: "product_id", parent: "products", venture: true },
  variant_stock_locations: { table: "variant_stock_locations", parentField: "variant_id", parent: "product_variants" },
  order_items: { table: "order_items", parentField: "order_id", parent: "orders" },
  order_activities: { table: "order_activities", parentField: "order_id", parent: "orders" },
  finance_entry_occurrences: { table: "finance_entry_occurrences", parentField: "entry_id", parent: "finance_entries" },
  finance_entry_shares: { table: "finance_entry_shares", parentField: "entry_id", parent: "finance_entries" },
  lead_activities: { table: "lead_activities", parentField: "lead_id", parent: "leads" },
  lead_tag_map: { table: "lead_tag_map", parentField: "lead_id", parent: "leads" },
  customer_tag_map: { table: "customer_tag_map", parentField: "customer_id", parent: "customers" },
  voucher_redemptions: { table: "voucher_redemptions", parentField: "voucher_id", parent: "vouchers" },
  return_events: { table: "return_events", parentField: "return_id", parent: "returns", venture: true },
  review_product_ratings: { table: "review_product_ratings", parentField: "review_id", parent: "reviews", venture: true },
} as const;

const directNames = Object.keys(directResources) as [keyof typeof directResources, ...(keyof typeof directResources)[]];
const childNames = Object.keys(childResources) as [keyof typeof childResources, ...(keyof typeof childResources)[]];

const writableDirect = [
  "products", "product_types", "product_brands", "product_categories", "product_tags",
  "product_locations", "suppliers", "tax_classes", "customers", "customer_tags",
  "leads", "lead_tags", "orders", "payment_models", "tasks", "finance_entries",
  "inventory_movements", "returns", "return_classes", "reviews", "review_invitations",
  "vouchers", "mail_templates", "outreach_templates", "portfolio_projects",
  "b2b_category_discounts", "b2b_product_discounts", "affiliates", "affiliate_links",
  "affiliate_coupons", "affiliate_payouts", "affiliate_assets", "affiliate_settings",
] as const;

const updatableChildren = [
  "product_variants", "product_variant_options", "variant_stock_locations", "order_items",
  "order_activities", "finance_entry_occurrences", "finance_entry_shares", "lead_activities",
  "voucher_redemptions", "return_events", "review_product_ratings",
] as const;

const protectedFields = new Set(["id", "venture", "created_at", "updated_at", "user_id"]);

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function cleanPayload(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !protectedFields.has(key)));
}

async function assertDirect(resource: keyof typeof directResources, id: string) {
  const meta = directResources[resource];
  const keyField = "keyField" in meta ? meta.keyField : "id";
  let query = admin.from(meta.table).select(keyField).eq(keyField, id);
  if (meta.venture) query = query.eq("venture", VENTURE);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error(`Kein Blazed-Zugriff auf ${resource}:${id}`);
}

async function assertChild(resource: keyof typeof childResources, id: string) {
  const meta = childResources[resource];
  const { data, error } = await admin
    .from(meta.table)
    .select(meta.parentField)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) throw new Error(`Datensatz nicht gefunden: ${resource}:${id}`);
  const parentId = (data as Record<string, unknown>)[meta.parentField];
  if (typeof parentId !== "string") throw new Error("Übergeordneter Datensatz fehlt");
  if (meta.parent in directResources) {
    await assertDirect(meta.parent as keyof typeof directResources, parentId);
  } else {
    await assertChild(meta.parent as keyof typeof childResources, parentId);
  }
}

async function assertResource(resource: string, id: string) {
  if (resource in directResources) {
    return assertDirect(resource as keyof typeof directResources, id);
  }
  if (resource in childResources) {
    return assertChild(resource as keyof typeof childResources, id);
  }
  throw new Error(`Unbekannte Referenz: ${resource}`);
}

const referenceMap: Record<string, string> = {
  customer_id: "customers",
  lead_id: "leads",
  order_id: "orders",
  product_id: "products",
  variant_id: "product_variants",
  brand_id: "product_brands",
  product_type_id: "product_types",
  tax_class_id: "tax_classes",
  location_id: "product_locations",
  payment_model_id: "payment_models",
  invitation_id: "review_invitations",
  voucher_id: "vouchers",
  return_id: "returns",
  review_id: "reviews",
  occurrence_id: "finance_entry_occurrences",
  supplier_id: "suppliers",
  category_id: "product_categories",
  affiliate_id: "affiliates",
};

async function validateReferences(payload: Record<string, unknown>) {
  for (const [field, resource] of Object.entries(referenceMap)) {
    const value = payload[field];
    if (typeof value === "string" && value) await assertResource(resource, value);
  }
}

async function detailFor(resource: keyof typeof directResources, id: string) {
  const children: Record<string, unknown> = {};
  const fetch = async (key: string, table: string, field: string) => {
    const { data, error } = await admin.from(table).select("*").eq(field, id);
    if (error) throw new Error(error.message);
    children[key] = data;
  };

  if (resource === "products") {
    await Promise.all([
      fetch("variants", "product_variants", "product_id"),
      fetch("variant_options", "product_variant_options", "product_id"),
      fetch("categories", "product_category_map", "product_id"),
      fetch("tags", "product_tag_map", "product_id"),
      fetch("suppliers", "product_supplier_map", "product_id"),
      fetch("inventory", "inventory_movements", "product_id"),
      fetch("sync_log", "product_sync_log", "product_id"),
    ]);
  } else if (resource === "orders") {
    await Promise.all([
      fetch("items", "order_items", "order_id"),
      fetch("activities", "order_activities", "order_id"),
      fetch("returns", "returns", "order_id"),
      fetch("finance_entries", "finance_entries", "order_id"),
      fetch("voucher_redemptions", "voucher_redemptions", "order_id"),
    ]);
  } else if (resource === "customers") {
    await Promise.all([
      fetch("orders", "orders", "customer_id"),
      fetch("reviews", "reviews", "customer_id"),
      fetch("vouchers", "vouchers", "customer_id"),
      fetch("tags", "customer_tag_map", "customer_id"),
    ]);
  } else if (resource === "leads") {
    await Promise.all([
      fetch("activities", "lead_activities", "lead_id"),
      fetch("tags", "lead_tag_map", "lead_id"),
    ]);
  } else if (resource === "finance_entries") {
    await Promise.all([
      fetch("occurrences", "finance_entry_occurrences", "entry_id"),
      fetch("shares", "finance_entry_shares", "entry_id"),
    ]);
  } else if (resource === "returns") {
    await fetch("events", "return_events", "return_id");
  } else if (resource === "reviews") {
    await fetch("product_ratings", "review_product_ratings", "review_id");
  } else if (resource === "vouchers") {
    await fetch("redemptions", "voucher_redemptions", "voucher_id");
  } else if (resource === "affiliates") {
    await Promise.all([
      fetch("links", "affiliate_links", "affiliate_id"),
      fetch("coupons", "affiliate_coupons", "affiliate_id"),
      fetch("orders", "affiliate_orders", "affiliate_id"),
      fetch("commissions", "affiliate_commissions", "affiliate_id"),
      fetch("payouts", "affiliate_payouts", "affiliate_id"),
    ]);
  }
  return children;
}

Deno.serve(
  pipeline(
    [withOAuthProtectedResource(), withSupabase({ auth: "user" })],
    async (request, { supabase }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return new Response("Unauthorized", { status: 401 });

      const { data: roles, error: roleError } = await supabase
        .from("user_venture_roles")
        .select("role,venture,permissions")
        .eq("user_id", user.id);

      const authorized = !roleError && (roles ?? []).some((role) =>
        role.role === "founder" ||
        (role.venture === VENTURE && ["manager", "admin"].includes(role.role))
      );
      if (!authorized) return new Response("Forbidden", { status: 403 });

      const handler = createMcpHandler(() => {
        const server = new McpServer({
          name: "Founder OS – Blazed Outfitters",
          version: "1.0.0",
        });

        server.registerTool(
          "get_blazed_overview",
          {
            description: "Liefert aktuelle Blazed-Kennzahlen zu Produkten, Bestellungen, Kunden, Leads, Aufgaben und Finanzen.",
            inputSchema: z.object({}),
            annotations: { readOnlyHint: true },
          },
          async () => {
            const count = (table: string) => admin.from(table).select("id", { count: "exact", head: true }).eq("venture", VENTURE);
            const [products, orders, customers, leads, tasks, finance] = await Promise.all([
              count("products"), count("orders"), count("customers"), count("leads"), count("tasks"),
              admin.from("finance_entries").select("type,amount,status").eq("venture", VENTURE),
            ]);
            const financeRows = finance.data ?? [];
            const overview = {
              products: products.count ?? 0,
              orders: orders.count ?? 0,
              customers: customers.count ?? 0,
              leads: leads.count ?? 0,
              tasks: tasks.count ?? 0,
              income: financeRows.filter((row) => row.type === "income").reduce((sum, row) => sum + Number(row.amount), 0),
              expenses: financeRows.filter((row) => row.type === "expense").reduce((sum, row) => sum + Number(row.amount), 0),
            };
            return { content: [{ type: "text", text: json(overview) }] };
          },
        );

        server.registerTool(
          "list_blazed_records",
          {
            description: "Listet Datensätze aus einem freigegebenen Blazed-Geschäftsbereich. Andere Ventures sind technisch ausgeschlossen.",
            inputSchema: z.object({
              resource: z.enum(directNames),
              search: z.string().max(200).optional(),
              status: z.string().max(100).optional(),
              limit: z.number().int().min(1).max(100).default(25),
              offset: z.number().int().min(0).default(0),
            }),
            annotations: { readOnlyHint: true },
          },
          async ({ resource, search, status, limit, offset }) => {
            const meta = directResources[resource];
            let query = admin.from(meta.table).select("*", { count: "exact" });
            if (meta.venture) query = query.eq("venture", VENTURE);
            if (search && meta.search) query = query.ilike(meta.search, `%${search}%`);
            if (status && "status" in meta && meta.status) query = query.eq("status", status);
            if (meta.order) query = query.order(meta.order, { ascending: false });
            const { data, error, count } = await query.range(offset, offset + limit - 1);
            if (error) throw new Error(error.message);
            return { content: [{ type: "text", text: json({ resource, count, data }) }] };
          },
        );

        server.registerTool(
          "get_blazed_record",
          {
            description: "Lädt einen Blazed-Datensatz mit seinen wichtigsten verknüpften Detaildaten.",
            inputSchema: z.object({ resource: z.enum(directNames), id: z.string().min(1).max(200) }),
            annotations: { readOnlyHint: true },
          },
          async ({ resource, id }) => {
            const meta = directResources[resource];
            const keyField = "keyField" in meta ? meta.keyField : "id";
            let query = admin.from(meta.table).select("*").eq(keyField, id);
            if (meta.venture) query = query.eq("venture", VENTURE);
            const { data, error } = await query.maybeSingle();
            if (error) throw new Error(error.message);
            if (!data) throw new Error("Blazed-Datensatz nicht gefunden");
            const related = await detailFor(resource, id);
            return { content: [{ type: "text", text: json({ ...data, related }) }] };
          },
        );

        server.registerTool(
          "create_blazed_record",
          {
            description: "Erstellt einen Datensatz in einem freigegebenen Blazed-Geschäftsbereich. Das Venture wird immer serverseitig auf Blazed gesetzt.",
            inputSchema: z.object({
              resource: z.enum(writableDirect),
              data: z.record(z.string(), z.unknown()),
            }),
          },
          async ({ resource, data }) => {
            const meta = directResources[resource];
            const payload = cleanPayload(data);
            await validateReferences(payload);
            if (meta.venture) payload.venture = VENTURE;
            if ((resource === "tasks" || resource === "finance_entries") && !payload.created_by) {
              payload.created_by = user.id;
            }
            const { data: created, error } = await admin.from(meta.table).insert(payload).select("*").single();
            if (error) throw new Error(error.message);
            return { content: [{ type: "text", text: json(created) }] };
          },
        );

        server.registerTool(
          "update_blazed_record",
          {
            description: "Ändert einen bestehenden Blazed-Datensatz. Venture und Systemfelder können nicht überschrieben werden.",
            inputSchema: z.object({
              resource: z.enum(writableDirect),
              id: z.string().min(1).max(200),
              changes: z.record(z.string(), z.unknown()),
            }),
          },
          async ({ resource, id, changes }) => {
            await assertDirect(resource, id);
            const payload = cleanPayload(changes);
            await validateReferences(payload);
            const meta = directResources[resource];
            const keyField = "keyField" in meta ? meta.keyField : "id";
            const { data, error } = await admin.from(meta.table).update(payload).eq(keyField, id).select("*").single();
            if (error) throw new Error(error.message);
            return { content: [{ type: "text", text: json(data) }] };
          },
        );

        server.registerTool(
          "list_blazed_child_records",
          {
            description: "Listet verknüpfte Blazed-Daten wie Varianten, Bestellpositionen, Aktivitäten oder Finanzvorkommen.",
            inputSchema: z.object({
              resource: z.enum(childNames),
              parent_id: z.string().uuid(),
              limit: z.number().int().min(1).max(200).default(50),
            }),
            annotations: { readOnlyHint: true },
          },
          async ({ resource, parent_id, limit }) => {
            const meta = childResources[resource];
            await assertResource(meta.parent, parent_id);
            const { data, error } = await admin.from(meta.table).select("*").eq(meta.parentField, parent_id).limit(limit);
            if (error) throw new Error(error.message);
            return { content: [{ type: "text", text: json(data) }] };
          },
        );

        server.registerTool(
          "create_blazed_child_record",
          {
            description: "Erstellt einen verknüpften Blazed-Datensatz nach Prüfung seines übergeordneten Datensatzes.",
            inputSchema: z.object({
              resource: z.enum(childNames),
              parent_id: z.string().uuid(),
              data: z.record(z.string(), z.unknown()),
            }),
          },
          async ({ resource, parent_id, data }) => {
            const meta = childResources[resource];
            await assertResource(meta.parent, parent_id);
            const payload = cleanPayload(data);
            payload[meta.parentField] = parent_id;
            if ("venture" in meta && meta.venture) payload.venture = VENTURE;
            await validateReferences(payload);
            const { data: created, error } = await admin.from(meta.table).insert(payload).select("*").single();
            if (error) throw new Error(error.message);
            return { content: [{ type: "text", text: json(created) }] };
          },
        );

        server.registerTool(
          "update_blazed_child_record",
          {
            description: "Ändert einen verknüpften Blazed-Datensatz, nachdem seine Venture-Zugehörigkeit geprüft wurde.",
            inputSchema: z.object({
              resource: z.enum(updatableChildren),
              id: z.string().uuid(),
              changes: z.record(z.string(), z.unknown()),
            }),
          },
          async ({ resource, id, changes }) => {
            await assertChild(resource, id);
            const meta = childResources[resource];
            const payload = cleanPayload(changes);
            delete payload[meta.parentField];
            await validateReferences(payload);
            const { data, error } = await admin.from(meta.table).update(payload).eq("id", id).select("*").single();
            if (error) throw new Error(error.message);
            return { content: [{ type: "text", text: json(data) }] };
          },
        );

        return server;
      });

      return handler.fetch(request);
    },
  ),
);
