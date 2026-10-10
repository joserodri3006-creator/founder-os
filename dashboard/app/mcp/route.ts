import { NextRequest, NextResponse } from "next/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyAccessToken } from "@/lib/mcp-oauth";

const ventures = ["online_first", "blazed_outfitters", "brandary", "droplane", "worknest"] as const;
const statuses = ["neu", "in_bearbeitung", "kontaktiert", "follow_up", "nachgefasst", "erstgespraech", "qualifiziert", "sales_gespraech", "angebot_gesendet", "gewonnen", "verloren", "nachfassen_zukunft"] as const;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
};

function json(data: unknown) {
  return JSON.stringify(data, null, 2);
}

function createFounderServer(userId: string) {
  const server = new McpServer(
    { name: "founder-os", version: "1.0.0" },
    { instructions: "Founder OS CRM. Nutze batch_create_leads für recherchierte Lead-Listen statt Excel." },
  );

  server.registerTool("list_leads", {
    description: "Leads eines Ventures auflisten. Venture immer angeben. Optional nach Status, Branche oder Freitext filtern.",
    inputSchema: {
      venture: z.enum(ventures), status: z.enum(statuses).optional(), industry: z.string().optional(), search: z.string().optional(), limit: z.number().int().min(1).max(200).optional(),
    },
  }, async ({ venture, status, industry, search, limit }) => {
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
    const { data: existing } = await supabaseAdmin.from("leads").select("id").eq("email", args.email.toLowerCase()).eq("venture", args.venture).maybeSingle();
    const { data, error } = await supabaseAdmin.from("leads").insert({ ...args, email: args.email.toLowerCase(), status: "neu", is_duplicate: Boolean(existing), region: args.region ?? "Hessen" }).select("id,venture,first_name,last_name,email,company_name,status,source,is_duplicate,created_at").single();
    return { content: [{ type: "text", text: json(error ? { error: error.message } : { success: true, duplicate: Boolean(existing), lead: data }) }] };
  });

  server.registerTool("batch_create_leads", {
    description: "Bis zu 50 recherchierte Leads auf einmal in Founder OS speichern. Jeder Lead braucht venture, first_name, last_name und email. Statt Excel verwenden.",
    inputSchema: { leads: z.array(z.object({ venture: z.enum(ventures), first_name: z.string(), last_name: z.string(), email: z.string().email(), company_name: z.string().optional(), phone: z.string().optional(), website: z.string().optional(), city: z.string().optional(), region: z.string().optional(), industry: z.string().optional(), notes: z.string().optional(), contact_reason: z.string().optional(), source: z.enum(["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"]).default("ki_suche"), automation_enabled: z.boolean().default(true) })).min(1).max(50) },
  }, async ({ leads }) => {
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
    const { data, error } = await supabaseAdmin.from("leads").select("*").eq("id", id).single();
    return { content: [{ type: "text", text: json(error ? { error: error.message } : data) }] };
  });

  server.registerTool("update_lead", {
    description: "Notizen, Branche, Kontaktdaten oder Automatisierung eines Leads aktualisieren. Statusänderungen laufen bewusst über Founder OS Prozess/UI.",
    inputSchema: { id: z.string().uuid(), notes: z.string().optional(), industry: z.string().optional(), company_name: z.string().optional(), website: z.string().optional(), city: z.string().optional(), phone: z.string().optional(), contact_reason: z.string().optional(), automation_enabled: z.boolean().optional() },
  }, async ({ id, ...fields }) => {
    const update = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    const { error } = await supabaseAdmin.from("leads").update(update).eq("id", id);
    return { content: [{ type: "text", text: json(error ? { error: error.message } : { success: true, id }) }] };
  });

  server.registerTool("pipeline_stats", {
    description: "Pipeline-Statistiken eines Ventures abrufen.",
    inputSchema: { venture: z.enum(ventures) },
  }, async ({ venture }) => {
    const { data, error } = await supabaseAdmin.from("leads").select("status,source,is_duplicate").eq("venture", venture).is("archived_at", null);
    if (error) return { content: [{ type: "text", text: json({ error: error.message }) }] };
    const byStatus: Record<string, number> = {}; const bySource: Record<string, number> = {};
    for (const row of data ?? []) { byStatus[row.status] = (byStatus[row.status] ?? 0) + 1; bySource[row.source] = (bySource[row.source] ?? 0) + 1; }
    return { content: [{ type: "text", text: json({ total: data?.length ?? 0, by_status: byStatus, by_source: bySource, user_id: userId }) }] };
  });

  return server;
}

async function handle(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized", error_description: "Bearer token required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json", "WWW-Authenticate": `Bearer resource_metadata="${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os.vercel.app")}/.well-known/oauth-protected-resource/mcp"` } });
  try {
    await verifyAccessToken(auth.slice(7));
  } catch {
    return new Response(JSON.stringify({ error: "invalid_token" }), { status: 401, headers: { ...cors, "Content-Type": "application/json", "WWW-Authenticate": `Bearer resource_metadata="${(process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os.vercel.app")}/.well-known/oauth-protected-resource/mcp"` } });
  }

  const token = auth.slice(7);
  const verified = await verifyAccessToken(token);
  const server = createFounderServer(verified.userId);
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
