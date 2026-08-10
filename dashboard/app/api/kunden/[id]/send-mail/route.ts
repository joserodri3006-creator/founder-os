import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSender, sendMail } from "@/lib/mail-helpers";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { subject, body } = await req.json();

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "subject und body erforderlich" }, { status: 400 });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: "RESEND_API_KEY nicht konfiguriert" }, { status: 500 });
  }

  const { data: customer, error } = await supabaseAdmin
    .from("customers")
    .select("first_name, last_name, email, venture")
    .eq("id", id)
    .single();

  if (error || !customer) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  if (!customer.email) return NextResponse.json({ error: "Kunde hat keine E-Mail-Adresse" }, { status: 400 });

  const sender = getSender(customer.venture ?? "online_first");
  const recipientName = `${customer.first_name} ${customer.last_name}`.trim();

  const resendRes = await sendMail(RESEND_API_KEY, {
    from: `${sender.name} <${sender.email}>`,
    to: [recipientName ? `${recipientName} <${customer.email}>` : customer.email],
    subject,
    text: body,
  });

  if (!resendRes.ok) {
    const detail = await resendRes.text();
    return NextResponse.json({ error: "E-Mail-Versand fehlgeschlagen", detail }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
