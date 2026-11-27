import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

const AGENT_TYPES = ["ai_agent", "manager_agent", "script", "worker", "automation"] as const;
const SCOPE_TYPES = ["founder_os", "portfolio", "venture", "personal", "shared_service", "client_project"] as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const scopeType = searchParams.get("scope_type");
  const scopeId = searchParams.get("scope_id");
  const agentType = searchParams.get("agent_type");
  const status = searchParams.get("status");
  const search = searchParams.get("search");

  if (scopeType && !SCOPE_TYPES.includes(scopeType as (typeof SCOPE_TYPES)[number])) {
    return NextResponse.json({ error: "Ungültiger Scope-Typ" }, { status: 400 });
  }
  if (agentType && !AGENT_TYPES.includes(agentType as (typeof AGENT_TYPES)[number])) {
    return NextResponse.json({ error: "Ungültiger Agententyp" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  let query = supabase
    .from("agent_registry")
    .select("*, manager:manager_agent_id(id, name, status)")
    .order("scope_type", { ascending: true })
    .order("name", { ascending: true });

  if (scopeType) query = query.eq("scope_type", scopeType);
  if (scopeId) query = query.eq("scope_id", scopeId);
  if (agentType) query = query.eq("agent_type", agentType);
  if (status) query = query.eq("status", status);
  const safeSearch = search?.replace(/[,().%]/g, " ").trim();
  if (safeSearch) query = query.or(`name.ilike.%${safeSearch}%,role.ilike.%${safeSearch}%,purpose.ilike.%${safeSearch}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
