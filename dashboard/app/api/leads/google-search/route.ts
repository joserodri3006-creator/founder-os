import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

type SerperSearchItem = {
  title?: string;
  link?: string;
  snippet?: string;
};

type SearchResult = {
  title: string;
  company_name: string;
  website: string;
  display_link: string;
  snippet: string;
};

function cleanText(value: unknown, maxLength = 200) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function companyNameFromTitle(title: string) {
  return title.split(/\s[|–-]\s/)[0]?.trim().slice(0, 200) || title.slice(0, 200);
}

function normalizeWebsite(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    const path = url.pathname.replace(/\/+$/, "");
    return `${host}${path === "/" ? "" : path}`;
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}

function websiteHost(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./i, "")
      .split("/")[0]
      .toLowerCase();
  }
}

function normalizedResult(item: GoogleSearchItem): SearchResult | null {
  const title = cleanText(item.title, 250);
  const website = cleanText(item.link, 1000);
  if (!title || !website) return null;
  let displayLink = cleanText(item.displayLink, 250);
  if (!displayLink) {
    try {
      displayLink = new URL(website).hostname;
    } catch {
      displayLink = website;
    }
  }
  return {
    title,
    company_name: companyNameFromTitle(title),
    website,
    display_link: displayLink,
    snippet: cleanText(item.snippet, 600),
  };
}

async function existingLeadWebsiteKeys() {
  const { data, error } = await supabaseAdmin
    .from("leads")
    .select("website")
    .eq("venture", "online_first")
    .not("website", "is", null);

  if (error) {
    console.error("Google lead search duplicate filter failed:", error.message);
    return { urls: new Set<string>(), hosts: new Set<string>() };
  }

  return (data ?? []).reduce(
    (acc, lead) => {
      if (typeof lead.website === "string" && lead.website.trim()) {
        acc.urls.add(normalizeWebsite(lead.website));
        acc.hosts.add(websiteHost(lead.website));
      }
      return acc;
    },
    { urls: new Set<string>(), hosts: new Set<string>() }
  );
}

function filterAlreadyImported(results: SearchResult[], existing: { urls: Set<string>; hosts: Set<string> }) {
  const seenUrls = new Set<string>();
  const seenHosts = new Set<string>();

  return results.filter((result) => {
    const urlKey = normalizeWebsite(result.website);
    const hostKey = websiteHost(result.website);
    const isExisting = existing.urls.has(urlKey) || existing.hosts.has(hostKey);
    const isRepeatedResult = seenUrls.has(urlKey) || seenHosts.has(hostKey);

    seenUrls.add(urlKey);
    seenHosts.add(hostKey);

    return !isExisting && !isRepeatedResult;
  });
}

async function searchWithSerper(apiKey: string, query: string, limit: number) {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ q: query, num: limit, gl: "de", hl: "de" }),
    cache: "no-store",
  });
  const data = await response.json() as { organic?: SerperSearchItem[]; message?: string };
  if (!response.ok) {
    return {
      error: data.message || "Die Google-Suche über Serper konnte nicht ausgefuehrt werden.",
      status: response.status >= 500 ? 502 : 400,
    };
  }
  return {
    results: (data.organic ?? [])
      .map((item) => normalizedResult(item))
      .filter((item): item is SearchResult => Boolean(item)),
    provider: "serper",
  };
}

async function searchWithGoogleCustom(apiKey: string, engineId: string, query: string, limit: number) {
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
    if (data.error?.message?.includes("does not have the access to Custom Search JSON API")) {
      return {
        error: "Google Custom Search ist für neue Projekte nicht mehr verfügbar. Bitte SERPER_API_KEY in Vercel hinterlegen und neu deployen.",
        status: 503,
      };
    }
    return {
      error: data.error?.message || "Die Google-Suche konnte nicht ausgefuehrt werden.",
      status: response.status >= 500 ? 502 : 400,
    };
  }

  return {
    results: (data.items ?? [])
      .map((item) => normalizedResult(item))
      .filter((item): item is SearchResult => Boolean(item)),
    provider: "google_custom_search",
  };
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

  const serperApiKey = process.env.SERPER_API_KEY;
  const googleApiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const googleEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  if (!serperApiKey && (!googleApiKey || !googleEngineId)) {
    return NextResponse.json(
      {
        error: "Google Search ist noch nicht konfiguriert. Bitte SERPER_API_KEY serverseitig in Vercel hinterlegen.",
        configurationRequired: true,
      },
      { status: 503 }
    );
  }

  const queryParts = [segmentTerm, specialization, region, "-jobs", "-stellenangebote"].filter(Boolean);
  const query = queryParts.join(" ");
  const search = serperApiKey
    ? await searchWithSerper(serperApiKey, query, limit)
    : await searchWithGoogleCustom(googleApiKey!, googleEngineId!, query, limit);

  if ("error" in search) {
    return NextResponse.json({ error: search.error }, { status: search.status });
  }

  const existingWebsites = await existingLeadWebsiteKeys();
  const filteredResults = filterAlreadyImported(search.results, existingWebsites);

  return NextResponse.json({
    query,
    region,
    segment,
    provider: search.provider,
    results: filteredResults,
    filtered_count: search.results.length - filteredResults.length,
  });
}
