import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const question = body?.question;
  if (!question || typeof question !== "string" || !question.trim()) {
    return NextResponse.json({ error: "question fehlt" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Server nicht konfiguriert" }, { status: 500 });
  }

  const res = await fetch(`${supabaseUrl}/functions/v1/reporting-query`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({ question, venture: body?.venture }),
  });

  const data = await res.json().catch(() => ({ error: "Ungültige Antwort" }));
  return NextResponse.json(data, { status: res.status });
}
