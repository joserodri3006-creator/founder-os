import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { data, error } = await supabaseAdmin
    .from("mcp_oauth_clients")
    .select("client_id, client_name, redirect_uris, created_at")
    .eq("client_id", clientId)
    .single();

  if (error || !data) return NextResponse.json({ error: "invalid_client" }, { status: 404 });
  return NextResponse.json({
    client_id: data.client_id,
    client_name: data.client_name,
    redirect_uris: data.redirect_uris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
}
