import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { timingSafeEqual } from "node:crypto";
import { verifyAccessToken } from "@/lib/mcp-oauth";

const ventures = ["online_first", "blazed_outfitters", "brandary", "droplane", "worknest", "sentinel"] as const;
const statuses = ["neu", "in_bearbeitung", "kontaktiert", "follow_up", "nachgefasst", "erstgespraech", "qualifiziert", "sales_gespraech", "angebot_gesendet", "gewonnen", "verloren", "nachfassen_zukunft"] as const;
const taskStatuses = ["open", "in_progress", "done"] as const;
const taskPriorities = ["low", "medium", "high"] as const;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown) {
  return JSON.stringify(data, null, 2);
}

function createFounderServer(userId: string, scope: string) {
  const scopes = new Set(scope.split(/\s+/));
  const requireScope = (required: string) => scopes.has(required);
  const server = new McpServer(
    { name: "founder-os", version: "1.0.0" },
    { instructions: "Founder OS CRM. Nutze batch_create_leads für recherchierte Lead-Listen. Aufgaben können direkt gelesen, angelegt, geändert und gelöscht werden; diese Task-Tools haben sofortige Schreibwirkung." },
  );

  server.registerTool("list_leads", {
    description: "Leads eines Ventures auflisten. Venture immer angeben. Optional nach Status, Branche oder Freitext filtern.",
    inputSchema: {
      venture: z.enum(ventures), status: z.enum(statuses).optional(), industry: z.string().optional(), search: z.string().optional(), limit: z.number().int().min(1).max(200).optional(),
    },
  }, async ({ venture, status, industry, search, limit }) => {
    if (!requireScope("leads:read")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "leads:read" }) }] };
    let query = supabaseAdmin.from("leads").select("id,venture,first_name,last_name,email,company_name,phone,website,city,region,industry,notes,source,status,last_contacted_at,follow_up_date,automation_enabled,is_duplicate,created_at").eq("venture", venture).is("archived_at", null).order("created_at", { ascending: false }).limit(limit ?? 50);
    if (status) query = query.eq("status", status);
    if (industry) query = query.eq("industry", industry);
    if (search) query = query.or(["first_name", "last_name", "email", "company_name", "city", "industry", "notes"].map(c => `${c}.ilike.%${search.replace(/[%,]/g, "")}%`).join(","));
    const { data, error } = await query;
    return { content: [{ type: "text", text: json(error ? { error: error.message } : data ?? []) }] };
  });

  server.registerTool("create_lead", {
    description: "Einen einzelnen Lead anlegen. Für Recherche source=ki_suche setzen und Recherchequelle sowie Begründung in notes dokumentieren.",
    inputSchema: {
      venture: z.enum(ventures), first_name: z.string(), last_name: z.string(), email: z.string().email(), company_name: z.string().optional(), phone: z.string().optional(), website: z.string().optional(), city: z.string().optional(), region: z.string().optional(), industry: z.string().optional(), notes: z.string().optional(), contact_reason: z.string().optional(), source: z.enum(["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"]).default("ki_suche"), automation_enabled: z.boolean().default(true),
    },
  }, async (args) => {
    if (!requireScope("leads:write")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "leads:write" }) }] };
    const { data: existing } = await supabaseAdmin.from("leads").select("id").eq("email", args.email.toLowerCase()).eq("venture", args.venture).maybeSingle();
    const { data, error } = await supabaseAdmin.from("leads").insert({ ...args, email: args.email.toLowerCase(), status: "neu", is_duplicate: Boolean(existing), region: args.region ?? "Hessen" }).select("id,venture,first_name,last_name,email,company_name,status,source,is_duplicate,created_at").single();
    return { content: [{ type: "text", text: json(error ? { error: error.message } : { success: true, duplicate: Boolean(existing), lead: data }) }] };
  });

  server.registerTool("batch_create_leads", {
    description: "Bis zu 50 recherchierte Leads auf einmal in Founder OS speichern. Jeder Lead braucht venture, first_name, last_name und email. Statt Excel verwenden.",
    inputSchema: { leads: z.array(z.object({ venture: z.enum(ventures), first_name: z.string(), last_name: z.string(), email: z.string().email(), company_name: z.string().optional(), phone: z.string().optional(), website: z.string().optional(), city: z.string().optional(), region: z.string().optional(), industry: z.string().optional(), notes: z.string().optional(), contact_reason: z.string().optional(), source: z.enum(["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"]).default("ki_suche"), automation_enabled: z.boolean().default(true) })).min(1).max(50) },
  }, async ({ leads }) => {
    if (!requireScope("leads:write")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "leads:write" }) }] };
    const results: Array<Record<string, unknown>> = [];
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const { data: existing } = await supabaseAdmin.from("leads").select("id").eq("email", lead.email.toLowerCase()).eq("venture", lead.venture).maybeSingle();
      const { data, error } = await supabaseAdmin.from("leads").insert({ ...lead, email: lead.email.toLowerCase(), status: "neu", is_duplicate: Boolean(existing), region: lead.region ?? "Hessen" }).select("id").single();
      results.push({ index: i, email: lead.email, company_name: lead.company_name ?? null, status: error ? "error" : existing ? "duplicate" : "created", lead_id: data?.id ?? null, error: error?.message ?? null });
    }
    return { content: [{ type: "text", text: json({ total: leads.length, created: results.filter(r => r.status === "created").length, duplicates: results.filter(r => r.status === "duplicate").length, errors: results.filter(r => r.status === "error").length, results }) }] };
  });

  server.registerTool("get_lead", {
    description: "Einen Lead anhand seiner UUID abrufen.",
    inputSchema: { id: z.string().uuid() },
  }, async ({ id }) => {
    if (!requireScope("leads:read")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "leads:read" }) }] };
    const { data, error } = await supabaseAdmin.from("leads").select("*").eq("id", id).single();
    return { content: [{ type: "text", text: json(error ? { error: error.message } : data) }] };
  });

  server.registerTool("update_lead", {
    description: "Notizen, Branche, Kontaktdaten oder Automatisierung eines Leads aktualisieren. Statusänderungen laufen bewusst über Founder OS Prozess/UI.",
    inputSchema: { id: z.string().uuid(), notes: z.string().optional(), industry: z.string().optional(), company_name: z.string().optional(), website: z.string().optional(), city: z.string().optional(), phone: z.string().optional(), contact_reason: z.string().optional(), automation_enabled: z.boolean().optional() },
  }, async ({ id, ...fields }) => {
    if (!requireScope("leads:write")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "leads:write" }) }] };
    const update = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    const { error } = await supabaseAdmin.from("leads").update(update).eq("id", id);
    return { content: [{ type: "text", text: json(error ? { error: error.message } : { success: true, id }) }] };
  });

  server.registerTool("pipeline_stats", {
    description: "Pipeline-Statistiken eines Ventures abrufen.",
    inputSchema: { venture: z.enum(ventures) },
  }, async ({ venture }) => {
    if (!requireScope("stats:read")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "stats:read" }) }] };
    const { data, error } = await supabaseAdmin.from("leads").select("status,source,is_duplicate").eq("venture", venture).is("archived_at", null);
    if (error) return { content: [{ type: "text", text: json({ error: error.message }) }] };
    const byStatus: Record<string, number> = {}; const bySource: Record<string, number> = {};
    for (const row of data ?? []) { byStatus[row.status] = (byStatus[row.status] ?? 0) + 1; bySource[row.source] = (bySource[row.source] ?? 0) + 1; }
    return { content: [{ type: "text", text: json({ total: data?.length ?? 0, by_status: byStatus, by_source: bySource, user_id: userId }) }] };
  });

  server.registerTool("list_tasks", {
    description: "Aufgaben des Founder OS auflisten. Optional nach Venture, Lead/Kunde, Status oder Verantwortlichem filtern.",
    inputSchema: {
      venture: z.enum(ventures).optional(),
      entity_type: z.enum(["lead", "customer"]).optional(),
      entity_id: z.string().uuid().optional(),
      status: z.enum(taskStatuses).optional(),
      assigned_to: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    },
  }, async ({ venture, entity_type, entity_id, status, assigned_to, limit }) => {
    if (!requireScope("tasks:read")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "tasks:read" }) }] };
    let query = supabaseAdmin.from("tasks").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }).limit(limit ?? 100);
    if (venture) query = query.eq("venture", venture);
    if (entity_type) query = query.eq("entity_type", entity_type);
    if (entity_id) query = query.eq("entity_id", entity_id);
    if (status) query = query.eq("status", status);
    if (assigned_to) query = query.eq("assigned_to", assigned_to);
    const { data, error } = await query;
    return { content: [{ type: "text", text: json(error ? { error: error.message } : { tasks: data ?? [], count: data?.length ?? 0 }) }] };
  });

  server.registerTool("create_task", {
    description: "Aufgabe sofort im Founder OS anlegen. Schreibzugriff wird direkt ausgeführt, ohne zusätzliche Bestätigung.",
    inputSchema: {
      venture: z.enum(ventures),
      entity_type: z.enum(["lead", "customer"]),
      entity_id: z.string().uuid(),
      title: z.string().min(1),
      description: z.string().optional(),
      status: z.enum(taskStatuses).optional(),
      priority: z.enum(taskPriorities).optional(),
      due_date: z.string().optional(),
      assigned_to: z.string().uuid().optional(),
      recurrence_rule: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
      recurrence_end_date: z.string().optional(),
      checklist: z.array(z.unknown()).optional(),
    },
  }, async ({ venture, entity_type, entity_id, title, description, status, priority, due_date, assigned_to, recurrence_rule, recurrence_end_date, checklist }) => {
    if (!requireScope("tasks:write")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "tasks:write" }) }] };
    const { data, error } = await supabaseAdmin.from("tasks").insert({
      venture,
      entity_type,
      entity_id,
      title: title.trim(),
      description: description ?? null,
      status: status ?? "open",
      priority: priority ?? "medium",
      due_date: due_date ?? null,
      assigned_to: assigned_to ?? null,
      created_by: userId,
      recurrence_rule: recurrence_rule ?? null,
      recurrence_end_date: recurrence_end_date ?? null,
      checklist: checklist ?? [],
    }).select().single();
    return { content: [{ type: "text", text: json(error ? { error: error.message } : { success: true, task: data }) }] };
  });

  server.registerTool("update_task", {
    description: "Aufgabe sofort aktualisieren. Nur übergebene Felder werden geändert; Status done setzt completed_at.",
    inputSchema: {
      id: z.string().uuid(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      status: z.enum(taskStatuses).optional(),
      priority: z.enum(taskPriorities).optional(),
      due_date: z.string().nullable().optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      recurrence_rule: z.enum(["daily", "weekly", "monthly", "yearly"]).nullable().optional(),
      recurrence_end_date: z.string().nullable().optional(),
      checklist: z.array(z.unknown()).optional(),
    },
  }, async ({ id, title, description, status, priority, due_date, assigned_to, recurrence_rule, recurrence_end_date, checklist }) => {
    if (!requireScope("tasks:write")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "tasks:write" }) }] };
    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title.trim();
    if (description !== undefined) updates.description = description;
    if (status !== undefined) { updates.status = status; updates.completed_at = status === "done" ? new Date().toISOString() : null; }
    if (priority !== undefined) updates.priority = priority;
    if (due_date !== undefined) updates.due_date = due_date;
    if (assigned_to !== undefined) updates.assigned_to = assigned_to;
    if (recurrence_rule !== undefined) updates.recurrence_rule = recurrence_rule;
    if (recurrence_end_date !== undefined) updates.recurrence_end_date = recurrence_end_date;
    if (checklist !== undefined) updates.checklist = checklist;
    if (Object.keys(updates).length === 0) return { content: [{ type: "text", text: json({ error: "Mindestens ein Änderungsfeld erforderlich" }) }] };
    const { data, error } = await supabaseAdmin.from("tasks").update(updates).eq("id", id).select().single();
    return { content: [{ type: "text", text: json(error ? { error: error.message } : { success: true, task: data }) }] };
  });

  server.registerTool("delete_task", {
    description: "Aufgabe sofort und dauerhaft löschen. Diese Aktion hat direkte Schreibwirkung.",
    inputSchema: { id: z.string().uuid() },
  }, async ({ id }) => {
    if (!requireScope("tasks:write")) return { content: [{ type: "text", text: json({ error: "insufficient_scope", required_scope: "tasks:write" }) }] };
    const { error } = await supabaseAdmin.from("tasks").delete().eq("id", id);
    return { content: [{ type: "text", text: json(error ? { error: error.message } : { success: true, id }) }] };
  });

  return server;
}

function staticTokenMatches(value: string, expected: string) {
  const actual = Buffer.from(value);
  const target = Buffer.from(expected);
  return actual.length === target.length && timingSafeEqual(actual, target);
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "Unauthorized", error_description: "Bearer token required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } });
}

async function handle(req: Request) {
  const publicAccess = process.env.MCP_PUBLIC_ACCESS !== "false";
  let userId: string;
  let scope: string;
  if (publicAccess) {
    userId = "1a996185-21dc-49ad-bbb0-beb246da85d2";
    scope = "tasks:read tasks:write";
  } else {
    const auth = req.headers.get("authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return unauthorized();
    const token = auth.slice(7);
    const staticToken = process.env.MCP_STATIC_TOKEN;
    const staticUserId = process.env.MCP_STATIC_USER_ID ?? "1a996185-21dc-49ad-bbb0-beb246da85d2";
    if (staticToken) {
      if (!staticTokenMatches(token, staticToken)) return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } });
      userId = staticUserId;
      scope = "tasks:read tasks:write";
    } else {
      try {
        const verified = await verifyAccessToken(token);
        userId = verified.userId;
        scope = verified.scope;
      } catch {
        return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json", "WWW-Authenticate": "Bearer" } });
      }
    }
  }

  const server = createFounderServer(userId, scope);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  const response = await transport.handleRequest(req);
  const headers = new Headers(response.headers);
  Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, { status: response.status, headers });
}

export async function OPTIONS() { return new Response(null, { status: 204, headers: cors }); }
export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
export async function DELETE(req: NextRequest) { return handle(req); }
