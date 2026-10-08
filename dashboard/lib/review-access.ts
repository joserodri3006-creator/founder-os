import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const FOUNDER_EMAIL = "jose.rodri3006@gmail.com";

export type Actor = { id: string; email: string; isFounder: boolean; venture: string | null };

export async function getActor(req: NextRequest): Promise<Actor | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: role } = await supabase
    .from("user_venture_roles")
    .select("role,venture")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return {
    id: user.id,
    email: user.email ?? "",
    isFounder: role?.role === "founder" || user.email === FOUNDER_EMAIL,
    venture: role?.venture ?? null,
  };
}

/** Gibt eine 403/401-Antwort zurück, wenn der Nutzer das Venture nicht bearbeiten darf, sonst null. */
export async function denyUnlessVenture(req: NextRequest, venture: string): Promise<NextResponse | null> {
  const actor = await getActor(req);
  if (!actor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (actor.isFounder || actor.venture === venture) return null;
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
