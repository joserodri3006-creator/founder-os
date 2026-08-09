// Shared email helpers used by order action endpoints

export const VENTURE_SENDERS: Record<string, { name: string; email: string }> = {
  online_first:     { name: "Online First",        email: "info@onlinefirst.eu" },
  brandary:         { name: "Brandary Print Studio", email: "info@onlinefirst.eu" },
  droplane:         { name: "Droplane",             email: "info@onlinefirst.eu" },
  blazed_outfitters:{ name: "Blazed Outfitters",   email: "info@onlinefirst.eu" },
  itaba:            { name: "ITABA",                email: "info@onlinefirst.eu" },
  worknest:         { name: "Worknest",             email: "info@onlinefirst.eu" },
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
}) {
  return fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
