import { NextResponse } from "next/server";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os-theta.vercel.app").trim().replace(/\/+$/, "");

export async function GET() {
  const manifest = {
    schema_version: "v1",
    name_for_model: "founder_os_crm",
    name_for_human: "Founder OS CRM",
    description_for_model:
      "Erstelle, lese und aktualisiere Leads im Founder OS CRM. " +
      "Verwende createLead für einzelne Leads und createLeadsBatch wenn du mehrere auf einmal speichern willst (bis 50 Stück). " +
      "Gib immer das venture-Feld an (online_first, blazed_outfitters, brandary, droplane, worknest). " +
      "Für recherchierte Leads: source='ki_suche', automation_enabled=true. " +
      "notes-Feld nutzen für: warum ist dieser Lead interessant, Quelllink, Recherche-Kontext.",
    description_for_human:
      "Speichere recherchierte Leads direkt in Founder OS — kein Excel mehr nötig.",
    auth: {
      type: "user_http",
      authorization_type: "bearer",
    },
    api: {
      type: "openapi",
      url: `${SITE_URL}/api/mcp/openapi.json`,
    },
    logo_url: `${SITE_URL}/favicon.ico`,
    contact_email: "info@onlinefirst.eu",
    legal_info_url: `${SITE_URL}/impressum`,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
    },
  });
}
