import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function requireFounder() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  if (user.email === "jose.rodri3006@gmail.com") {
    return { user } as const;
  }

  const { data: roleRow, error } = await supabaseAdmin
    .from("user_venture_roles")
    .select("role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }) } as const;
  }
  if (roleRow?.role !== "founder") {
    return { error: NextResponse.json({ error: "Private OS ist nur für den Founder verfügbar." }, { status: 403 }) } as const;
  }
  return { user } as const;
}
