import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getVenture } from "@/lib/ventures";

type Params = { params: Promise<{ id: string }> };

async function isFounderUser(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  if (user.email === "jose.rodri3006@gmail.com") return true;

  const { data: role } = await supabaseAdmin
    .from("user_venture_roles")
    .select("role, venture")
    .eq("user_id", user.id)
    .eq("role", "founder")
    .is("venture", null)
    .maybeSingle();

  return Boolean(role);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isFounderUser())) {
    return NextResponse.json({ error: "Nur Founder dürfen Aufgaben zwischen Ventures verschieben." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null) as { venture?: string } | null;
  const venture = body?.venture;

  if (!venture || !getVenture(venture)) {
    return NextResponse.json({ error: "Gültiges Ziel-Venture erforderlich." }, { status: 400 });
  }

  const { data: maxRow } = await supabaseAdmin
    .from("tasks")
    .select("sort_order")
    .eq("venture", venture)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { data, error } = await supabaseAdmin
    .from("tasks")
    .update({ venture, sort_order: nextSortOrder })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
