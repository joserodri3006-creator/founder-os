import { NextRequest, NextResponse } from "next/server";

const SCOPES = [
  { type: "portfolio", id: "portfolio", label: "Portfolio" },
  { type: "personal", id: "personal", label: "Persönlich" },
  { type: "shared_service", id: "shared_infrastructure", label: "Gemeinsame Services" },
  { type: "venture", id: "online_first", label: "Online First" },
  { type: "venture", id: "blazed_outfitters", label: "Blazed Outfitters" },
  { type: "venture", id: "brandary", label: "Brandary" },
];

const KEYWORDS: Record<string, string[]> = {
  blazed_outfitters: ["blazed", "b2b", "b2c", "shop", "pinterest", "newsletter", "funding", "outfitters"],
  online_first: ["online first", "webdesign", "website", "coach-lead", "lokale dienstleister"],
  brandary: ["brandary", "textildruck", "dtf", "verein", "firmenkunden"],
  portfolio: ["portfolio", "alle ventures", "übergreifend", "gesamt", "prioritäten", "morning briefing"],
  personal: ["persönlich", "finanzcoach", "finanzen", "second brain", "meine woche"],
  shared_infrastructure: ["inbox", "drive", "system", "automation", "agentenübersicht", "gemeinsam"],
};

function inferScope(text: string) {
  const normalized = text.toLowerCase();
  const matches = Object.entries(KEYWORDS)
    .map(([scopeId, words]) => ({ scopeId, score: words.reduce((score, word) => score + (normalized.includes(word) ? 1 : 0), 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!matches.length) return null;
  const top = matches[0];
  const tied = matches.filter((item) => item.score === top.score);
  const scope = SCOPES.find((item) => item.id === top.scopeId);
  if (!scope) return null;
  return { ...scope, confidence: tied.length > 1 ? "low" : top.score > 1 ? "high" : "medium" };
}

async function getDb() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin");
  return supabaseAdmin;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const includeCompleted = searchParams.get("include_completed") === "true";
  const db = await getDb();
  let query = db
    .from("agent_dispatch_requests")
    .select("*, manager:selected_manager_agent_id(id, name, status)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (!includeCompleted) query = query.not("status", "in", "(completed,cancelled)");
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const requestText = typeof body?.request_text === "string" ? body.request_text.trim() : "";
  if (!requestText) return NextResponse.json({ error: "Bitte eine Aufgabe eingeben." }, { status: 400 });

  const requestedType = typeof body?.scope_type === "string" ? body.scope_type : "";
  const requestedId = typeof body?.scope_id === "string" ? body.scope_id : "";
  const actionMode = ["analysis", "draft", "prepare", "execute"].includes(body?.action_mode) ? body.action_mode : "analysis";
  const manuallySelected = Boolean(requestedType && requestedId);
  const inferred = manuallySelected ? { type: requestedType, id: requestedId, label: requestedId, confidence: "manual" } : inferScope(requestText);
  const db = await getDb();

  if (inferred?.type === "client_project") {
    return NextResponse.json({ error: "Kundenprojekte werden in diesem Founder-OS-Dispatcher vorerst separat gehalten." }, { status: 400 });
  }

  let manager: { id: string; name: string; status: string } | null = null;
  if (inferred) {
    const managerQuery = await db
      .from("agent_registry")
      .select("id,name,status")
      .eq("scope_type", inferred.type)
      .eq("scope_id", inferred.id)
      .eq("agent_type", "manager_agent")
      .order("status", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (managerQuery.error) return NextResponse.json({ error: managerQuery.error.message }, { status: 500 });
    manager = managerQuery.data;
  }

  const ready = Boolean(manager && ["active", "pilot"].includes(manager.status));
  const status = ready ? "queued" : "waiting_user";
  const nextAction = manager
    ? ready ? "Der zuständige Manager kann den Auftrag übernehmen." : `Der zuständige Manager „${manager.name}“ ist noch ${manager.status}.`
    : "Bitte Scope oder zuständigen Manager festlegen.";

  const { data, error } = await db
    .from("agent_dispatch_requests")
    .insert({
      request_text: requestText,
      source: "founder_os",
      requested_scope_type: requestedType || null,
      requested_scope_id: requestedId || null,
      inferred_scope_type: inferred?.type ?? null,
      inferred_scope_id: inferred?.id ?? null,
      scope_confidence: inferred?.confidence ?? "low",
      selected_manager_agent_id: manager?.id ?? null,
      status,
      action_mode: actionMode,
      approval_required: actionMode !== "analysis",
      next_action: nextAction,
      metadata: { dispatcher_version: "mvp-1", dispatch_ready: ready, manager_status: manager?.status ?? null },
    })
    .select("*, manager:selected_manager_agent_id(id, name, status)")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
