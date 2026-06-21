import { NextResponse } from "next/server";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  type CheckResult = { ok: boolean; detail: string };
  const checks: Record<string, CheckResult> = {};
  const issues: string[] = [];

  // --- 1. Env Vars ---
  checks.supabase_url = url
    ? { ok: true, detail: url }
    : { ok: false, detail: "NEXT_PUBLIC_SUPABASE_URL nicht gesetzt" };
  if (!url) issues.push("NEXT_PUBLIC_SUPABASE_URL fehlt in Vercel Environment Variables");

  if (anonKey) {
    // Decode JWT payload (without verification) to confirm it's an anon key
    try {
      const payload = JSON.parse(
        Buffer.from(anonKey.split(".")[1] + "==", "base64url").toString("utf-8")
      );
      if (payload.role === "anon") {
        checks.supabase_anon_key = { ok: true, detail: `JWT gültig — role: anon, erstes 12 Zeichen: ${anonKey.substring(0, 12)}...` };
      } else {
        checks.supabase_anon_key = { ok: false, detail: `JWT-Rolle ist "${payload.role}", erwartet "anon"` };
        issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY hat falsche Rolle — Service-Role-Key statt Anon-Key?");
      }
    } catch {
      checks.supabase_anon_key = { ok: false, detail: "Kein gültiges JWT-Format" };
      issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY ist kein gültiges JWT");
    }
  } else {
    checks.supabase_anon_key = { ok: false, detail: "NEXT_PUBLIC_SUPABASE_ANON_KEY nicht gesetzt" };
    issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY fehlt in Vercel Environment Variables");
  }

  // --- 2. Supabase Auth Erreichbarkeit ---
  if (url) {
    try {
      const res = await fetch(`${url}/auth/v1/health`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        checks.supabase_reachable = { ok: true, detail: `Status: ${JSON.stringify(body)}` };
      } else {
        checks.supabase_reachable = { ok: false, detail: `HTTP ${res.status} — Supabase möglicherweise pausiert` };
        issues.push(`Supabase antwortet mit ${res.status} — Projekt möglicherweise pausiert (Supabase Dashboard prüfen)`);
      }
    } catch (e: unknown) {
      checks.supabase_reachable = { ok: false, detail: `Verbindungsfehler: ${String(e)}` };
      issues.push("Supabase Auth ist nicht erreichbar — DNS/Netzwerk prüfen");
    }
  }

  // --- 3. Anon Key Validität gegen Supabase ---
  if (url && anonKey) {
    try {
      // /auth/v1/settings requires a valid apikey header
      const res = await fetch(`${url}/auth/v1/settings`, {
        headers: { apikey: anonKey },
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const settings = await res.json();
        checks.anon_key_valid = { ok: true, detail: "Key von Supabase akzeptiert" };
        checks.google_oauth = settings.external?.google?.enabled
          ? { ok: true, detail: "Google OAuth aktiviert in Supabase" }
          : { ok: false, detail: "Google OAuth deaktiviert — in Supabase Auth → Providers aktivieren" };
        if (!settings.external?.google?.enabled) {
          issues.push("Google OAuth ist in Supabase deaktiviert");
        }
      } else if (res.status === 401) {
        checks.anon_key_valid = { ok: false, detail: "Key abgelehnt (401) — falscher Key oder für falsches Projekt" };
        issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY wird von Supabase abgelehnt — Key im Supabase Dashboard neu erstellen und in Vercel aktualisieren");
      } else {
        checks.anon_key_valid = { ok: false, detail: `Unerwarteter Status: ${res.status}` };
      }
    } catch (e: unknown) {
      checks.anon_key_valid = { ok: false, detail: `Fehler: ${String(e)}` };
    }
  }

  // --- 4. Site URL ---
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  checks.site_url = siteUrl
    ? { ok: true, detail: siteUrl }
    : { ok: true, detail: "Nicht gesetzt — Request-Origin wird genutzt (in Ordnung)" };

  // --- Summary ---
  const projectId = url.replace("https://", "").replace(".supabase.co", "");
  const configUrl = projectId
    ? `https://app.supabase.com/project/${projectId}/auth/url-configuration`
    : null;

  return NextResponse.json({
    ok: issues.length === 0,
    issues,
    checks,
    fix_guide: issues.length > 0 ? {
      step1: "Vercel: https://vercel.com/joserodri3006-creators-projects/founder-os/settings/environment-variables",
      step2: configUrl ? `Supabase URL-Config: ${configUrl}` : "Supabase URL-Config (Projekt-ID aus URL ableiten)",
      supabase_site_url_soll: "https://founder-os-theta.vercel.app",
      supabase_redirect_urls_soll: ["https://founder-os-theta.vercel.app/**", "http://localhost:3000/**"],
    } : null,
    timestamp: new Date().toISOString(),
  });
}
