import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: string | null;
}

interface Order {
  id: string;
  venture: string;
  title: string;
  status: string;
  value: number | null;
  anzahlung_betrag: number | null;
  restzahlung_erhalten: boolean;
  briefing_url: string | null;
  customer_id: string | null;
  customer: Customer | null;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Order;
  old_record: Order;
}

const VENTURE_SENDERS: Record<string, { name: string; email: string }> = {
  online_first:      { name: "Jose | Online First",       email: "info@onlinefirst.eu" },
  brandary:          { name: "Brandary Print Studio",     email: "info@brandary.de" },
  droplane:          { name: "Droplane",                  email: "info@droplane.de" },
  blazed_outfitters: { name: "Blazed Outfitters",         email: "info@blazedoutfitters.com" },
  worknest:          { name: "Worknest",                  email: "info@worknest.de" },
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getConfig(key: string, fallback = ""): Promise<string> {
  const { data } = await supabase.from("system_config").select("value").eq("key", key).single();
  return data?.value ?? fallback;
}

async function logActivity(
  order_id: string,
  activity_type: string,
  description: string,
  from_status?: string,
  to_status?: string
) {
  await supabase.from("order_activities").insert({
    order_id,
    activity_type,
    description,
    from_status: from_status ?? null,
    to_status: to_status ?? null,
  });
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

async function sendEmail(
  venture: string,
  to: { name: string; email: string },
  subject: string,
  text: string
): Promise<boolean> {
  const sender = VENTURE_SENDERS[venture] ?? VENTURE_SENDERS.online_first;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${sender.name} <${sender.email}>`,
      to: [`${to.name} <${to.email}>`],
      subject,
      text,
    }),
  });

  if (!res.ok) {
    console.error(`E-Mail Fehler (${res.status}):`, await res.text());
    return false;
  }
  return true;
}

async function handleStatusChange(order: Order, oldStatus: string) {
  const newStatus = order.status;
  const customer = order.customer;

  if (!customer) {
    console.log(`Kein Kunde für Auftrag ${order.id} — überspringe Mail`);
    return;
  }

  const vars: Record<string, string> = {
    Vorname: customer.first_name,
    Nachname: customer.last_name,
    Anrede: "r",
    Auftragstitel: order.title,
    Anzahlung: order.anzahlung_betrag != null ? String(order.anzahlung_betrag) : "—",
    Venture: order.venture,
    BriefingUrl: order.briefing_url ?? "",
  };

  const update: Record<string, unknown> = {};

  switch (newStatus) {
    case "neu": {
      const templateKey = `${order.venture}_onboarding_vorlage`;
      const template = await getConfig(templateKey);
      if (!template) {
        console.log(`Keine Onboarding-Vorlage für ${order.venture}`);
        break;
      }
      const body = fillTemplate(template, vars);
      const subject = `Willkommen bei ${VENTURE_SENDERS[order.venture]?.name ?? order.venture} — ${order.title}`;
      const sent = await sendEmail(order.venture, { name: `${customer.first_name} ${customer.last_name}`, email: customer.email }, subject, body);
      if (sent) {
        await logActivity(order.id, "email_sent", `Onboarding-Mail gesendet an ${customer.email}`);
      }
      break;
    }

    case "briefing": {
      const briefingText = order.briefing_url
        ? `Bitte füllen Sie den Briefing-Bogen aus: ${order.briefing_url}`
        : "Wir senden Ihnen den Briefing-Bogen in Kürze zu.";
      const subject = `Briefing-Unterlagen — ${order.title}`;
      const body = `${vars.Anrede} ${customer.first_name} ${customer.last_name},\n\nIhr Projekt "${order.title}" startet mit dem Briefing-Prozess.\n\n${briefingText}\n\nViele Grüße\n${VENTURE_SENDERS[order.venture]?.name ?? order.venture}`;
      const sent = await sendEmail(order.venture, { name: `${customer.first_name} ${customer.last_name}`, email: customer.email }, subject, body);
      if (sent) {
        await logActivity(order.id, "email_sent", `Briefing-Reminder gesendet an ${customer.email}`);
      }
      break;
    }

    case "in_produktion": {
      await logActivity(order.id, "note", `Produktion gestartet für "${order.title}"`);
      break;
    }

    case "review": {
      const templateKey = `${order.venture}_abnahme_vorlage`;
      const template = await getConfig(templateKey);
      if (!template) break;
      const body = fillTemplate(template, vars);
      const subject = `Ihr Projekt ist fertig — Abnahme erforderlich: ${order.title}`;
      const sent = await sendEmail(order.venture, { name: `${customer.first_name} ${customer.last_name}`, email: customer.email }, subject, body);
      if (sent) {
        await logActivity(order.id, "email_sent", `Abnahme-Mail gesendet an ${customer.email}`);
      }
      break;
    }

    case "abgeschlossen": {
      // Restzahlung prüfen
      if (!order.restzahlung_erhalten) {
        const subject = `Zahlungserinnerung — ${order.title}`;
        const body = `${vars.Anrede} ${customer.first_name} ${customer.last_name},\n\nIhr Projekt "${order.title}" ist abgeschlossen. Wir bitten Sie, die ausstehende Restzahlung zu überweisen.\n\nVielen Dank!\n${VENTURE_SENDERS[order.venture]?.name ?? order.venture}`;
        const sent = await sendEmail(order.venture, { name: `${customer.first_name} ${customer.last_name}`, email: customer.email }, subject, body);
        if (sent) {
          await logActivity(order.id, "email_sent", `Zahlungserinnerung gesendet (Restzahlung ausstehend)`);
        }
      }

      // Abschluss-Mail
      const abschlussBody = `${vars.Anrede} ${customer.first_name} ${customer.last_name},\n\nvielen Dank für Ihr Vertrauen! Ihr Projekt "${order.title}" ist erfolgreich abgeschlossen.\n\nWir freuen uns auf eine weitere Zusammenarbeit.\n\nViele Grüße\n${VENTURE_SENDERS[order.venture]?.name ?? order.venture}`;
      await sendEmail(order.venture, { name: `${customer.first_name} ${customer.last_name}`, email: customer.email }, `Ihr Projekt ist abgeschlossen — ${order.title}`, abschlussBody);
      await logActivity(order.id, "email_sent", `Abschluss-Mail gesendet`);

      // Nachbetreuungs-Follow-up in 3 Tagen notieren
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 3);
      await logActivity(order.id, "follow_up", `Nachbetreuung geplant für ${followUpDate.toLocaleDateString("de-DE")}`);
      break;
    }

    case "nachbetreuung": {
      const templateKey = `${order.venture}_nachbetreuung_vorlage`;
      const template = await getConfig(templateKey);
      if (!template) break;
      const body = fillTemplate(template, vars);
      const subject = `Nachbetreuung — ${order.title}`;
      const sent = await sendEmail(order.venture, { name: `${customer.first_name} ${customer.last_name}`, email: customer.email }, subject, body);
      if (sent) {
        await logActivity(order.id, "email_sent", `Nachbetreuungs-Mail gesendet an ${customer.email}`);
      }
      break;
    }
  }

  // Status-Wechsel immer loggen
  await logActivity(order.id, "status_change", `Status: ${oldStatus} → ${newStatus}`, oldStatus, newStatus);

  // Geplante Updates ausführen
  if (Object.keys(update).length > 0) {
    await supabase.from("orders").update(update).eq("id", order.id);
  }
}

async function applyDefaultPaymentModel(order: Order) {
  // Skip if already has payment steps
  if (order.payment_model_id) return;

  const { data: model } = await supabase
    .from("payment_models")
    .select("*")
    .eq("venture", order.venture)
    .eq("is_default", true)
    .single();

  if (!model) {
    console.log(`Kein Standard-Zahlungsmodell für ${order.venture}`);
    return;
  }

  const totalValue = order.value ?? 0;
  const createdAt = new Date(order.id ? (await supabase.from("orders").select("created_at").eq("id", order.id).single()).data?.created_at ?? Date.now() : Date.now());

  const steps = (model.steps as any[]).map((s: any) => {
    const amount = Math.round((s.percentage / 100) * totalValue * 100) / 100;
    const dueDate = new Date(createdAt);
    dueDate.setDate(dueDate.getDate() + (s.due_days ?? 0));
    return {
      ...s,
      amount,
      due_date: dueDate.toISOString().split("T")[0],
      paid: false,
      paid_at: null,
    };
  });

  await supabase
    .from("orders")
    .update({ payment_model_id: model.id, payment_steps: steps })
    .eq("id", order.id);

  await logActivity(
    order.id,
    "note",
    `Zahlungsmodell "${model.name}" automatisch zugewiesen`
  );
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  const { type, table, record: order, old_record } = payload;

  if (table !== "orders") {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  // --- INSERT: auto-assign default payment model ---
  if (type === "INSERT") {
    try {
      await applyDefaultPaymentModel(order);
    } catch (err) {
      console.error("Fehler beim Zahlungsmodell zuweisen:", err);
    }
    return new Response(JSON.stringify({ success: true, event: "insert" }), { status: 200 });
  }

  if (type !== "UPDATE") {
    return new Response(JSON.stringify({ skipped: true }), { status: 200 });
  }

  if (old_record?.status === order.status) {
    return new Response(JSON.stringify({ skipped: "no status change" }), { status: 200 });
  }

  // Kunden-Daten nachladen (Webhook enthält keine Joins)
  const { data: fullOrder } = await supabase
    .from("orders")
    .select("*, customer:customers(id, first_name, last_name, email, company_name)")
    .eq("id", order.id)
    .single();

  if (!fullOrder) {
    return new Response(JSON.stringify({ error: "Auftrag nicht gefunden" }), { status: 404 });
  }

  try {
    await handleStatusChange(fullOrder as Order, old_record.status);
    return new Response(
      JSON.stringify({ success: true, order_id: order.id, new_status: order.status }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unerwarteter Fehler:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
