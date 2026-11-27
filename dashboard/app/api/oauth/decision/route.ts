import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function POST(request: Request) {
  const formData = await request.formData();
  const decision = formData.get("decision");
  const authorizationId = formData.get("authorization_id");

  if (typeof authorizationId !== "string" || !authorizationId) {
    return NextResponse.json({ error: "authorization_id fehlt" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const { data: roles, error: roleError } = await supabase
    .from("user_venture_roles")
    .select("role,venture")
    .eq("user_id", user.id);

  const isAllowed = !roleError && (roles ?? []).some((role) =>
    role.role === "founder" ||
    (role.venture === "blazed_outfitters" && ["manager", "admin"].includes(role.role))
  );

  if (!isAllowed || decision !== "approve") {
    const { data, error } = await supabase.auth.oauth.denyAuthorization(authorizationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.redirect(data.redirect_url, 303);
  }

  const { data, error } = await supabase.auth.oauth.approveAuthorization(authorizationId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.redirect(data.redirect_url, 303);
}
