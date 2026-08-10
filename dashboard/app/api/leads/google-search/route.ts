import { NextRequest, NextResponse } from "next/server";
import { searchGoogleLeads } from "@/lib/google-lead-search";

export async function POST(req: NextRequest) {
  let input: { region?: string; segment?: string; specialization?: string; limit?: number };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 });
  }

  const result = await searchGoogleLeads({
    region: input.region ?? "",
    segment: input.segment,
    specialization: input.specialization,
    limit: input.limit,
  });

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error, ...(result.status === 503 ? { configurationRequired: true } : {}) },
      { status: result.status }
    );
  }

  return NextResponse.json(result);
}
