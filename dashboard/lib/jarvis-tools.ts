import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Sicherheitsgrenze: venture kommt IMMER vom eingeloggten User (JarvisScope),
// niemals aus dem von Claude gelieferten Tool-Input. Ein Tool-Input-Feld "venture"
// wird nur genutzt, wenn der User keine feste Venture-Bindung hat (Founder).
export interface JarvisScope {
  userId: string;
  role: "founder" | "manager" | "employee";
  venture: string | null; // null = Founder, sieht alle Ventures
}

function resolveVenture(scope: JarvisScope, requested?: string): string | undefined {
  if (scope.venture) return scope.venture; // fest gebundener User: eigene Venture erzwingen
  return requested || undefined; // Founder: darf Venture wählen (oder leer = alle)
}

export const JARVIS_TOOLS: Anthropic.Tool[] = [
  {
    name: "search_leads",
    description: "Sucht Leads nach Venture, Status und/oder Freitext (Name, Firma, E-Mail). Gibt max. 25 Treffer zurück.",
    input_schema: {
      type: "object",
      properties: {
        venture: { type: "string", description: "z.B. online_first, blazed_outfitters, droplane, brandary, worknest, itaba. Leer lassen für alle Ventures." },
        status: { type: "string", description: "Lead-Status, z.B. neu, kontaktiert, qualifiziert, gewonnen, verloren" },
        query: { type: "string", description: "Freitext-Suche über Name, Firma, E-Mail" },
        limit: { type: "integer", description: "Max. Anzahl Ergebnisse, Standard 25" },
      },
    },
  },
  {
    name: "search_customers",
    description: "Sucht Kunden nach Venture und/oder Freitext (Name, Firma, E-Mail). Gibt max. 25 Treffer zurück.",
    input_schema: {
      type: "object",
      properties: {
        venture: { type: "string", description: "Venture-Filter, leer für alle Ventures" },
        query: { type: "string", description: "Freitext-Suche über Name, Firma, E-Mail" },
        limit: { type: "integer", description: "Max. Anzahl Ergebnisse, Standard 25" },
      },
    },
  },
  {
    name: "search_orders",
    description: "Sucht Aufträge nach Venture, Status und/oder Freitext (Titel). Gibt max. 25 Treffer zurück, inkl. Kundenname und Wert.",
    input_schema: {
      type: "object",
      properties: {
        venture: { type: "string", description: "Venture-Filter, leer für alle Ventures" },
        status: { type: "string", description: "Auftragsstatus, z.B. neu, in_produktion, versendet, abgeschlossen, storniert" },
        query: { type: "string", description: "Freitext-Suche über Auftragstitel" },
        limit: { type: "integer", description: "Max. Anzahl Ergebnisse, Standard 25" },
      },
    },
  },
  {
    name: "get_kpis",
    description: "Liefert aktuelle Kennzahlen: Lead-Anzahl pro Status, offene Aufträge, Auftragswert-Summe (letzte 90 Tage) für ein Venture oder alle Ventures.",
    input_schema: {
      type: "object",
      properties: {
        venture: { type: "string", description: "Venture-Filter, leer für alle Ventures" },
      },
    },
  },
  {
    name: "add_note",
    description: "Fügt einem Kunden oder Auftrag eine Notiz hinzu. Die Notiz wird mit Zeitstempel an bestehende Notizen angehängt, nicht überschrieben.",
    input_schema: {
      type: "object",
      properties: {
        entity_type: { type: "string", enum: ["customer", "order"] },
        entity_id: { type: "string", description: "UUID des Kunden oder Auftrags" },
        note: { type: "string", description: "Notiztext" },
      },
      required: ["entity_type", "entity_id", "note"],
    },
  },
  {
    name: "update_lead_status",
    description: "Ändert den Status eines Leads (z.B. auf 'kontaktiert', 'qualifiziert', 'gewonnen', 'verloren'). Löst ggf. automatisierte Follow-up-Workflows aus.",
    input_schema: {
      type: "object",
      properties: {
        lead_id: { type: "string", description: "UUID des Leads" },
        status: { type: "string", description: "Neuer Status" },
      },
      required: ["lead_id", "status"],
    },
  },
];

export async function executeJarvisTool(
  scope: JarvisScope,
  name: string,
  input: Record<string, unknown>
): Promise<string> {
  switch (name) {
    case "search_leads": {
      const venture = resolveVenture(scope, input.venture as string | undefined);
      const limit = Math.min(Number(input.limit) || 25, 25);
      let q = supabaseAdmin
        .from("leads")
        .select("id,first_name,last_name,company_name,email,status,source,venture,created_at")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (venture) q = q.eq("venture", venture);
      if (input.status) q = q.eq("status", input.status as string);
      if (input.query) {
        const s = (input.query as string).replace(/[%,]/g, "");
        q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data ?? []);
    }

    case "search_customers": {
      const venture = resolveVenture(scope, input.venture as string | undefined);
      const limit = Math.min(Number(input.limit) || 25, 25);
      let q = supabaseAdmin
        .from("customers")
        .select("id,first_name,last_name,company_name,email,phone,venture,status,created_at")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (venture) q = q.eq("venture", venture);
      if (input.query) {
        const s = (input.query as string).replace(/[%,]/g, "");
        q = q.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,company_name.ilike.%${s}%,email.ilike.%${s}%`);
      }
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data ?? []);
    }

    case "search_orders": {
      const venture = resolveVenture(scope, input.venture as string | undefined);
      const limit = Math.min(Number(input.limit) || 25, 25);
      let q = supabaseAdmin
        .from("orders")
        .select("id,title,value,status,venture,created_at,customer:customers(first_name,last_name,company_name)")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (venture) q = q.eq("venture", venture);
      if (input.status) q = q.eq("status", input.status as string);
      if (input.query) {
        const s = (input.query as string).replace(/[%,]/g, "");
        q = q.ilike("title", `%${s}%`);
      }
      const { data, error } = await q;
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify(data ?? []);
    }

    case "get_kpis": {
      const venture = resolveVenture(scope, input.venture as string | undefined);
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

      let leadsQ = supabaseAdmin.from("leads").select("status").is("archived_at", null);
      if (venture) leadsQ = leadsQ.eq("venture", venture);
      const { data: leads } = await leadsQ;
      const leadsByStatus: Record<string, number> = {};
      for (const l of leads ?? []) {
        const s = (l as { status: string }).status;
        leadsByStatus[s] = (leadsByStatus[s] ?? 0) + 1;
      }

      let ordersQ = supabaseAdmin
        .from("orders")
        .select("status,value")
        .is("archived_at", null)
        .gte("created_at", ninetyDaysAgo);
      if (venture) ordersQ = ordersQ.eq("venture", venture);
      const { data: orders } = await ordersQ;
      const ordersByStatus: Record<string, number> = {};
      let totalValue = 0;
      for (const o of orders ?? []) {
        const row = o as { status: string; value: number | null };
        ordersByStatus[row.status] = (ordersByStatus[row.status] ?? 0) + 1;
        totalValue += row.value ?? 0;
      }

      return JSON.stringify({
        venture: venture ?? "alle",
        leads_by_status: leadsByStatus,
        orders_by_status: ordersByStatus,
        order_value_last_90_days: totalValue,
      });
    }

    case "add_note": {
      const entityType = input.entity_type as string;
      const entityId = input.entity_id as string;
      const note = (input.note as string ?? "").trim();
      if (!note) return JSON.stringify({ error: "note ist leer" });
      if (entityType !== "customer" && entityType !== "order") {
        return JSON.stringify({ error: "entity_type muss 'customer' oder 'order' sein" });
      }
      const table = entityType === "customer" ? "customers" : "orders";

      let existingQ = supabaseAdmin.from(table).select("notes,venture").eq("id", entityId).single();
      const { data: existing, error: fetchError } = await existingQ;
      if (fetchError || !existing) return JSON.stringify({ error: "Eintrag nicht gefunden" });
      if (scope.venture && (existing as { venture: string }).venture !== scope.venture) {
        return JSON.stringify({ error: "Kein Zugriff auf diese Venture" });
      }

      const timestamp = new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
      const prevNotes = (existing as { notes: string | null }).notes ?? "";
      const appended = prevNotes ? `${prevNotes}\n\n[${timestamp} · Jarvis] ${note}` : `[${timestamp} · Jarvis] ${note}`;

      const { error } = await supabaseAdmin.from(table).update({ notes: appended }).eq("id", entityId);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true });
    }

    case "update_lead_status": {
      const leadId = input.lead_id as string;
      const status = input.status as string;
      if (!leadId || !status) return JSON.stringify({ error: "lead_id und status erforderlich" });

      const { data: existing, error: fetchError } = await supabaseAdmin
        .from("leads")
        .select("venture")
        .eq("id", leadId)
        .single();
      if (fetchError || !existing) return JSON.stringify({ error: "Lead nicht gefunden" });
      if (scope.venture && (existing as { venture: string }).venture !== scope.venture) {
        return JSON.stringify({ error: "Kein Zugriff auf diese Venture" });
      }

      const { error } = await supabaseAdmin.from("leads").update({ status }).eq("id", leadId);
      if (error) return JSON.stringify({ error: error.message });
      return JSON.stringify({ success: true });
    }

    default:
      return JSON.stringify({ error: `Unbekanntes Tool: ${name}` });
  }
}
