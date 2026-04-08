import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Params = { params: Promise<{ token: string }> };

// GET — Einladung laden (für /invite/[token] Seite)
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const { data, error } = await supabaseAdmin
    .from("user_invites")
    .select("id, email, venture, role, permissions, accepted_at, expires_at")
    .eq("token", token)
    .single();

  if (error || !data) return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });
  if (data.accepted_at) return NextResponse.json({ error: "Einladung bereits angenommen" }, { status: 410 });
  if (data.expires_at && new Date(data.expires_at) < new Date())
    return NextResponse.json({ error: "Einladung abgelaufen" }, { status: 410 });

  return NextResponse.json(data);
}

// POST — Einladung annehmen (nach Login)
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const { user_id } = await req.json();

  if (!user_id) return NextResponse.json({ error: "user_id fehlt" }, { status: 400 });

  const { data: invite, error } = await supabaseAdmin
    .from("user_invites")
    .select("*")
    .eq("token", token)
    .is("accepted_at", null)
    .single();

  if (error || !invite) return NextResponse.json({ error: "Ungültige Einladung" }, { status: 404 });
  if (invite.expires_at && new Date(invite.expires_at) < new Date())
    return NextResponse.json({ error: "Einladung abgelaufen" }, { status: 410 });

  // Rolle zuweisen
  const { error: roleError } = await supabaseAdmin
    .from("user_venture_roles")
    .upsert({
      user_id,
      venture: invite.venture ?? null,
      role: invite.role,
      permissions: invite.permissions,
      invited_by: invite.invited_by,
    }, { onConflict: "user_id,venture" });

  if (roleError) return NextResponse.json({ error: roleError.message }, { status: 500 });

  // Einladung als angenommen markieren
  await supabaseAdmin
    .from("user_invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  return NextResponse.json({ success: true, redirect: "/dashboard" });
}
