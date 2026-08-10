import { supabaseAdmin } from "@/lib/supabase-admin";

export const VENTURE_SENDERS: Record<string, { name: string; email: string }> = {
  online_first:      { name: "Online First",         email: "info@onlinefirst.eu" },
  brandary:          { name: "Brandary Print Studio", email: "info@onlinefirst.eu" },
  droplane:          { name: "Droplane",              email: "info@onlinefirst.eu" },
  blazed_outfitters: { name: "Blazed Outfitters",    email: "info@onlinefirst.eu" },
  itaba:             { name: "ITABA",                 email: "info@onlinefirst.eu" },
  worknest:          { name: "Worknest",              email: "info@onlinefirst.eu" },
};

export function getSender(venture: string) {
  return VENTURE_SENDERS[venture] ?? VENTURE_SENDERS.online_first;
}

export async function sendMail(apiKey: string, payload: {
  from: string;
  to: string[];
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
