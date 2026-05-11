import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VENTURE_LABELS: Record<string, string> = {
  online_first: "Online First",
  blazed_outfitters: "Blazed Outfitters",
  brandary: "Brandary",
  droplane: "Droplane",
  worknest: "Worknest",
  itaba: "Itaba",
};

// POST — bestehende Einladung erneut versenden
export async function POST(req: NextRequest) {
  const { invite_id } = await req.json();
  if (!invite_id) return NextResponse.json({ error: "invite_id fehlt" }, { status: 400 });

  const { data: invite, error } = await supabaseAdmin
    .from("user_invites")
    .select("*")
    .eq("id", invite_id)
    .is("accepted_at", null)
    .single();

  if (error || !invite) return NextResponse.json({ error: "Einladung nicht gefunden" }, { status: 404 });

  // Ablaufdatum verlängern falls nötig
  const now = new Date();
  if (invite.expires_at && new Date(invite.expires_at) < now) {
    const newExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("user_invites")
      .update({ expires_at: newExpiry })
      .eq("id", invite_id);
    invite.expires_at = newExpiry;
  }

  // Origin dynamisch ermitteln
  const proto  = req.headers.get("x-forwarded-proto") ?? "https";
  const host   = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
  const inviteUrl = `${origin}/invite/${invite.token}`;

  const ventureName = invite.venture ? (VENTURE_LABELS[invite.venture] ?? invite.venture) : "alle Ventures";

  const mailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Founder OS <info@onlinefirst.eu>",
      to: [invite.email],
      subject: "Einladung zum Founder OS Dashboard",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 0;">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">Du wurdest eingeladen</h2>
          <p style="color:#555;margin-bottom:24px;">
            Du hast Zugriff auf das <strong>Founder OS Dashboard</strong> erhalten
            (Venture: <strong>${ventureName}</strong>, Rolle: <strong>${invite.role ?? "employee"}</strong>).
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

  if (!mailRes.ok) {
    const mailErr = await mailRes.text();
    return NextResponse.json({ error: `Mail fehlgeschlagen: ${mailErr}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, invite_url: inviteUrl });
}
