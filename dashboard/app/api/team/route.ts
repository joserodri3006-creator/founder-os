import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// GET — alle Team-Mitglieder + offene Einladungen
export async function GET() {
  const [rolesRes, invitesRes] = await Promise.all([
    supabaseAdmin
      .from("user_venture_roles")
      .select("id, user_id, venture, role, permissions, created_at")
      .order("created_at"),
    supabaseAdmin
      .from("user_invites")
      .select("id, email, venture, role, permissions, token, accepted_at, expires_at, created_at")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
  ]);

  // Fetch user emails via admin auth API
  const userIds = (rolesRes.data ?? []).map(r => r.user_id);
  const users: Record<string, { email: string; name: string; avatar_url: string | null }> = {};
  for (const uid of userIds) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(uid);
    if (data?.user) {
      users[uid] = {
        email: data.user.email ?? "",
        name: data.user.user_metadata?.full_name ?? data.user.email ?? "",
        avatar_url: data.user.user_metadata?.avatar_url ?? null,
      };
    }
  }

  const members = (rolesRes.data ?? []).map(r => ({
    ...r,
    ...users[r.user_id],
  }));

  return NextResponse.json({
    members,
    invites: invitesRes.data ?? [],
  });
}

// POST — neue Einladung versenden
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { email, venture, role, permissions } = body;

  if (!email) return NextResponse.json({ error: "E-Mail fehlt" }, { status: 400 });

  // Einladung anlegen
  const { data: invite, error } = await supabaseAdmin
    .from("user_invites")
    .insert({ email, venture: venture || null, role: role ?? "employee", permissions: permissions ?? {} })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Einladungsmail via Resend
  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os.vercel.app"}/invite/${invite.token}`;

  const VENTURE_LABELS: Record<string, string> = {
    online_first: "Online First",
    blazed_outfitters: "Blazed Outfitters",
    brandary: "Brandary",
    droplane: "Droplane",
    worknest: "Worknest",
  };
  const ventureName = venture ? (VENTURE_LABELS[venture] ?? venture) : "alle Ventures";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Founder OS <info@onlinefirst.eu>",
      to: [email],
      subject: "Einladung zum Founder OS Dashboard",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 0;">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Du wurdest eingeladen</h2>
          <p style="color:#555;margin-bottom:24px;">
            Du hast Zugriff auf das <strong>Founder OS Dashboard</strong> erhalten
            (Venture: <strong>${ventureName}</strong>, Rolle: <strong>${role ?? "employee"}</strong>).
          </p>
          <a href="${inviteUrl}"
             style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                    padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">
            Einladung annehmen
          </a>
          <p style="color:#aaa;font-size:12px;margin-top:24px;">
            Dieser Link ist 7 Tage gültig.
          </p>
        </div>
      `,
    }),
  });

  return NextResponse.json({ success: true, token: invite.token }, { status: 201 });
}
