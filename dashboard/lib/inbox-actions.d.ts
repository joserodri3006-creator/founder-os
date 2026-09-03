export function normalizeEmail(value: unknown): string;
export function splitName(value: unknown, fallbackEmail?: string): { first_name: string; last_name: string };
export function linkUpdateForEntity(entityType: "lead" | "customer" | "supplier", entityId: string): {
  lead_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  match_status: "matched_lead" | "matched_customer" | "matched_supplier";
};
export function parseIgnoredIds(value: unknown): string[];
export function addIgnoredId(existingValue: unknown, id: string): string;
export function leadPayloadFromInboxMessage(message: {
  venture?: string;
  from_name?: string | null;
  from_email?: string | null;
  subject?: string | null;
  body_preview?: string | null;
}): {
  venture: string;
  first_name: string;
  last_name: string;
  email: string;
  company_name: null;
  source: "website";
  status: "neu";
  notes: string;
  contact_reason: string | null;
  review_status: "unreviewed";
  contact_channel: "email";
  next_action: "antwort_pruefen";
};
