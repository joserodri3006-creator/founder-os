import { supabaseAdmin } from "@/lib/supabase-admin";

export const VENTURE_SENDERS: Record<string, { name: string; email: string }> = {
  online_first:      { name: "Online First",         email: "info@onlinefirst.eu" },
  brandary:          { name: "Brandary Print Studio", email: "info@brandary.de" },
  droplane:          { name: "Droplane",              email: "info@droplane.eu" },
  blazed_outfitters: { name: "Blazed Outfitters",    email: "info@blazedoutfitters.com" },
  itaba:             { name: "ITABA",                 email: "info@onlinefirst.eu" },
  worknest:          { name: "Worknest",              email: "info@onlinefirst.eu" },
};

// Ventures mit verifizierter Resend-Domain → direkt senden
// Alle anderen → Hermes SMTP-Queue (lead_mail_worker.py)
export const RESEND_VERIFIED_VENTURES = new Set(["online_first", "itaba"]);

export function getSender(venture: string) {
  return VENTURE_SENDERS[venture] ?? VENTURE_SENDERS.online_first;
}

export function usesResend(venture: string): boolean {
  return RESEND_VERIFIED_VENTURES.has(venture);
}

export async function sendMail(apiKey: string, payload: {
  from: string;
  to: string[];
  reply_to?: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: { filename: string; content: string; content_type: string }[];
}) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

// Resolve {{variable}} placeholders in a string
export function resolve(text: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), text);
}

// Load an active email template for a venture+key; returns null if not found (use fallback)
export async function getTemplate(venture: string, key: string) {
  const { data } = await supabaseAdmin
    .from("email_templates")
    .select("subject, intro_text, footer_text, from_name, from_email")
    .eq("venture", venture)
    .eq("template_key", key)
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}
