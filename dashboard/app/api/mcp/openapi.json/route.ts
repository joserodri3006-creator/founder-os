import { NextResponse } from "next/server";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://founder-os-theta.vercel.app").trim().replace(/\/+$/, "");

export async function GET() {
  const schema = {
    openapi: "3.1.0",
    info: {
      title: "Founder OS — Lead & CRM API",
      description:
        "Legt Leads an, liest und aktualisiert sie im Founder OS CRM. " +
        "Unterstützt alle 5 Ventures: online_first, blazed_outfitters, brandary, droplane, worknest. " +
        "Authentifizierung: Authorization: Bearer <API_KEY>.",
      version: "1.0.0",
    },
    servers: [{ url: `${SITE_URL}/api/mcp` }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "MCP_API_KEY — wird von Jose vergeben",
        },
      },
      schemas: {
        Venture: {
          type: "string",
          enum: ["online_first", "blazed_outfitters", "brandary", "droplane", "worknest"],
          description: "Das Venture dem dieser Lead zugeordnet ist",
        },
        LeadStatus: {
          type: "string",
          enum: [
            "neu", "in_bearbeitung", "kontaktiert", "follow_up", "nachgefasst",
            "erstgespraech", "qualifiziert", "sales_gespraech", "angebot_gesendet",
            "gewonnen", "verloren", "nachfassen_zukunft",
          ],
        },
        LeadInput: {
          type: "object",
          required: ["first_name", "last_name", "email", "venture"],
          properties: {
            venture:        { $ref: "#/components/schemas/Venture" },
            first_name:     { type: "string", description: "Vorname des Ansprechpartners" },
            last_name:      { type: "string", description: "Nachname des Ansprechpartners" },
            email:          { type: "string", format: "email" },
            phone:          { type: "string", nullable: true },
            company_name:   { type: "string", nullable: true, description: "Firmenname" },
            website:        { type: "string", nullable: true },
            city:           { type: "string", nullable: true },
            region:         { type: "string", nullable: true, default: "Hessen" },
            industry:       { type: "string", nullable: true, description: "Branche (z.B. Headshop, Growshop, Einzelhandel)" },
            notes:          { type: "string", nullable: true, description: "Interne Notizen — warum ist dieser Lead interessant?" },
            contact_reason: { type: "string", nullable: true, description: "Anfragegrund / wie kam der Kontakt zustande" },
            source: {
              type: "string",
              enum: ["website", "linkedin", "empfehlung", "kaltakquise", "csv_import", "ki_suche"],
              default: "ki_suche",
              description: "Für KI-recherchierte Leads immer 'ki_suche' verwenden",
            },
            automation_enabled: {
              type: "boolean",
              default: true,
              description: "true = KI-Agent darf diesen Lead automatisch kontaktieren",
            },
          },
        },
        LeadOut: {
          type: "object",
          properties: {
            id:           { type: "string", format: "uuid" },
            venture:      { $ref: "#/components/schemas/Venture" },
            first_name:   { type: "string" },
            last_name:    { type: "string" },
            email:        { type: "string" },
            company_name: { type: "string", nullable: true },
            website:      { type: "string", nullable: true },
            city:         { type: "string", nullable: true },
            industry:     { type: "string", nullable: true },
            notes:        { type: "string", nullable: true },
            status:       { $ref: "#/components/schemas/LeadStatus" },
            source:       { type: "string" },
            last_contacted_at: { type: "string", format: "date-time", nullable: true },
            follow_up_date:    { type: "string", format: "date", nullable: true },
            ai_draft_subject:  { type: "string", nullable: true },
            is_duplicate:      { type: "boolean" },
            created_at:        { type: "string", format: "date-time" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
            detail: { type: "string", nullable: true },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/leads": {
        get: {
          operationId: "listLeads",
          summary: "Leads auflisten",
          description:
            "Gibt die Lead-Pipeline zurück. Filtere nach venture (Pflicht für sinnvolle Ergebnisse), " +
            "status, industry und last_contacted. Immer venture angeben.",
          parameters: [
            { name: "venture", in: "query", required: true, schema: { $ref: "#/components/schemas/Venture" } },
            { name: "status",  in: "query", schema: { $ref: "#/components/schemas/LeadStatus" } },
            { name: "industry", in: "query", schema: { type: "string" }, description: "Exakter Branchen-Match" },
            { name: "last_contacted", in: "query", schema: { type: "string", enum: ["never", "7d", "30d", "older_30d"] } },
            { name: "search", in: "query", schema: { type: "string" }, description: "Freitextsuche (Name, Firma, E-Mail, Stadt, Notizen)" },
            { name: "limit",  in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          ],
          responses: {
            "200": {
              description: "Liste der Leads",
              content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/LeadOut" } } } },
            },
            "401": { description: "Nicht autorisiert", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
          },
        },
        post: {
          operationId: "createLead",
          summary: "Neuen Lead anlegen",
          description:
            "Legt einen einzelnen Lead im Founder OS CRM an. " +
            "Für KI-recherchierte Leads source='ki_suche' setzen. " +
            "Duplikate (gleiche E-Mail + venture) werden erkannt und mit is_duplicate=true markiert, aber trotzdem angelegt. " +
            "automation_enabled=true erlaubt dem B2B-Agenten, diesen Lead automatisch zu kontaktieren.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/LeadInput" } } },
          },
          responses: {
            "201": {
              description: "Lead angelegt",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      lead: { $ref: "#/components/schemas/LeadOut" },
                      duplicate: { type: "boolean", description: "true wenn E-Mail bereits existiert" },
                    },
                  },
                },
              },
            },
            "400": { description: "Validierungsfehler", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
            "401": { description: "Nicht autorisiert" },
          },
        },
      },
      "/leads/batch": {
        post: {
          operationId: "createLeadsBatch",
          summary: "Mehrere Leads auf einmal anlegen",
          description:
            "Legt bis zu 50 Leads in einem Aufruf an — ideal wenn ChatGPT eine Recherche-Session abschließt. " +
            "Jeder Lead wird einzeln validiert. Fehler in einzelnen Leads stoppen nicht den Rest. " +
            "Gibt eine Zusammenfassung mit created/skipped/errors zurück.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["leads"],
                  properties: {
                    leads: {
                      type: "array",
                      items: { $ref: "#/components/schemas/LeadInput" },
                      maxItems: 50,
                      description: "Liste der anzulegenden Leads",
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Batch-Ergebnis",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      created: { type: "integer" },
                      duplicates: { type: "integer" },
                      errors: { type: "integer" },
                      results: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            index:     { type: "integer" },
                            status:    { type: "string", enum: ["created", "duplicate", "error"] },
                            lead_id:   { type: "string", nullable: true },
                            email:     { type: "string" },
                            error:     { type: "string", nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/leads/{id}": {
        get: {
          operationId: "getLead",
          summary: "Einzelnen Lead abrufen",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: {
            "200": { description: "Lead-Details", content: { "application/json": { schema: { $ref: "#/components/schemas/LeadOut" } } } },
            "404": { description: "Lead nicht gefunden" },
          },
        },
        patch: {
          operationId: "updateLead",
          summary: "Lead aktualisieren",
          description: "Aktualisiert Felder eines bestehenden Leads. Nur übergebene Felder werden geändert.",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    notes:          { type: "string" },
                    industry:       { type: "string" },
                    company_name:   { type: "string" },
                    website:        { type: "string" },
                    city:           { type: "string" },
                    phone:          { type: "string" },
                    contact_reason: { type: "string" },
                    automation_enabled: { type: "boolean" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Aktualisiert" },
            "404": { description: "Lead nicht gefunden" },
          },
        },
      },
      "/stats": {
        get: {
          operationId: "getPipelineStats",
          summary: "Pipeline-Statistik",
          description: "Gibt Kennzahlen zur Lead-Pipeline zurück: Anzahl pro Status, Venture, Quelle.",
          parameters: [
            { name: "venture", in: "query", required: true, schema: { $ref: "#/components/schemas/Venture" } },
          ],
          responses: {
            "200": {
              description: "Statistiken",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      total: { type: "integer" },
                      by_status: { type: "object", additionalProperties: { type: "integer" } },
                      by_source: { type: "object", additionalProperties: { type: "integer" } },
                      won:       { type: "integer" },
                      lost:      { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(schema, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET",
    },
  });
}
