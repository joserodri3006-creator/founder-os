import { NextRequest, NextResponse } from "next/server";

const SEGMENT_TERMS: Record<string, string> = {
  coaches: "Coach Coaching",
  consultants: "Berater Beratung",
  experts: "Experte Spezialist Dienstleistung",
  all: "(Coach OR Berater OR Experte)",
};

type GoogleSearchItem = {
  title?: string;
  link?: string;
  displayLink?: string;
  snippet?: string;
};

function cleanText(value: unknown, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function companyNameFromTitle(title: string) {
  return title.split(/\s[|–-]\s/)[0]?.trim().slice(0, 200) || title.slice(0, 200);
}

export async function POST(req: NextRequest) {
  let input: { region?: string; segment?: string; specialization?: string; limit?: number };
  try {
    input = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 });
  }

  const region = cleanText(input.region, 100);
  const segment = cleanText(input.segment, 30) || "all";
  const specialization = cleanText(input.specialization, 100);
  const segmentTerm = SEGMENT_TERMS[segment];
  const limit = Math.min(Math.max(Number(input.limit) || 10, 1), 10);

  if (!region) {
    return NextResponse.json({ error: "Bitte eine Region angeben." }, { status: 400 });
  }
  if (!segmentTerm) {
    return NextResponse.json({ error: "Ungueltige Zielgruppe." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const engineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  if (!apiKey || !engineId) {
    return NextResponse.json(
      {
        error: "Google Search ist noch nicht konfiguriert. Bitte GOOGLE_CUSTOM_SEARCH_API_KEY und GOOGLE_CUSTOM_SEARCH_ENGINE_ID hinterlegen.",
        configurationRequired: true,
      },
      { status: 503 }
    );
  }

  const queryParts = [segmentTerm, specialization, region, "-jobs", "-stellenangebote"].filter(Boolean);
  const query = queryParts.join(" ");
  const params = new URLSearchParams({
    key: apiKey,
    cx: engineId,
    q: query,
    num: String(limit),
    hl: "de",
    gl: "de",
    safe: "active",
  });

  const response = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const data = await response.json() as { items?: GoogleSearchItem[]; error?: { message?: string } };

  if (!response.ok) {
    return NextResponse.json(
      { error: data.error?.message || "Die Google-Suche konnte nicht ausgefuehrt werden." },
      { status: response.status >= 500 ? 502 : 400 }
    );
  }

  const results = (data.items ?? [])
    .filter((item) => item.link && item.title)
    .map((item) => ({
      title: cleanText(item.title, 250),
      company_name: companyNameFromTitle(cleanText(item.title, 250)),
      website: cleanText(item.link, 1000),
      display_link: cleanText(item.displayLink, 250),
      snippet: cleanText(item.snippet, 600),
    }));

  return NextResponse.json({ query, region, segment, results });
}
