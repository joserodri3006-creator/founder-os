import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const ONLINE_FIRST_PACKAGE = {
  code: "leadgen_website_5_page",
  label: "Coach & Berater Website Sprint",
  netPriceCents: 249000,
  depositNetCents: 124500,
  termsVersion: "online-first-b2b-v1-2026-05-26",
  privacyVersion: "privacy-v1-2026-05-26",
} as const;

export interface FitInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  company_name?: string;
  website?: string;
  profession?: string;
  primary_goal?: string;
  timeline?: string;
  pages_required?: string;
  needs_shop?: boolean;
  needs_custom_features?: boolean;
  content_ready?: boolean;
  privacy_consent?: boolean;
  marketing_consent?: boolean;
  turnstile_token?: string;
  website_confirmation?: string;
  attribution?: Record<string, string | undefined>;
}

export function cleanText(value: unknown, maxLength = 250): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

export function validateFitInput(input: FitInput): string | null {
  if (!cleanText(input.first_name, 100) || !cleanText(input.last_name, 100)) {
    return "Vor- und Nachname sind erforderlich.";
  }
  const email = cleanText(input.email, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Bitte geben Sie eine gueltige E-Mail-Adresse ein.";
  }
  if (!cleanText(input.primary_goal) || !cleanText(input.timeline) || !cleanText(input.pages_required)) {
    return "Bitte beantworten Sie die Projektfragen vollstaendig.";
  }
  if (input.privacy_consent !== true) {
    return "Die Datenschutzhinweise muessen akzeptiert werden.";
  }
  return null;
}

export function evaluateFit(input: FitInput) {
  if (input.needs_shop || input.needs_custom_features || input.pages_required === "more_than_5") {
    return {
      score: 35,
      status: "call_recommended" as const,
      reason: "Der benoetigte Umfang geht ueber das standardisierte Paket hinaus.",
    };
  }

  let score = 60;
  if (input.profession === "coach" || input.profession === "consultant") score += 15;
  if (input.timeline === "within_30_days" || input.timeline === "within_60_days") score += 10;
  if (input.content_ready) score += 10;
  if (input.primary_goal === "lead_generation") score += 5;

  return {
    score: Math.min(score, 100),
    status: "checkout_ready" as const,
    reason: "Das Vorhaben passt zum standardisierten Coach & Berater Website Sprint.",
  };
}

export function attributionFrom(input: FitInput, req: NextRequest) {
  const allowed = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing_page"];
  const attribution: Record<string, string> = {};
  for (const key of allowed) {
    const value = cleanText(input.attribution?.[key], 200);
    if (value) attribution[key] = value;
  }
  attribution.referrer = cleanText(req.headers.get("referer"), 500);
  return attribution;
}

async function hashIdentifier(identifier: string) {
  const bytes = new TextEncoder().encode(identifier);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforcePublicRateLimit(req: NextRequest, route: string, maximum = 5) {
  const identifier = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
  const identifierHash = await hashIdentifier(`${route}:${identifier}`);
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("public_request_limits")
    .select("id", { count: "exact", head: true })
    .eq("route", route)
    .eq("identifier_hash", identifierHash)
    .gte("created_at", since);

  if ((count ?? 0) >= maximum) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte versuchen Sie es spaeter erneut." },
      { status: 429 }
    );
  }

  await supabaseAdmin.from("public_request_limits").insert({ route, identifier_hash: identifierHash });
  return null;
}

export async function verifyTurnstile(req: NextRequest, token: string | undefined) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return process.env.NODE_ENV !== "production";
  if (!token) return false;

  const form = new URLSearchParams({ secret, response: token });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (ip) form.set("remoteip", ip);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: form,
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

export function salesError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
