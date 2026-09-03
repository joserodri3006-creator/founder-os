type InboxEntityType = "lead" | "customer" | "supplier";

export function normalizeEmail(value: unknown): string;
export function splitName(value: unknown, fallbackEmail?: string): { first_name: string; last_name: string };
export function linkUpdateForEntity(entityType: InboxEntityType, entityId: string): {
  lead_id: string | null;
  customer_id: string | null;
  supplier_id: string | null;
  match_status: "matched_lead" | "matched_customer" | "matched_supplier";
};
export function parseIgnoredIds(value: unknown): string[];
export function addIgnoredId(existingValue: unknown, id: string): string;
export function payloadFromInboxMessage(
  entityType: InboxEntityType,
  message: {
    venture?: string;
    from_name?: string | null;
    from_email?: string | null;
    subject?: string | null;
    body_preview?: string | null;
  },
  overrides?: { company_name?: string; first_name?: string; last_name?: string; notes?: string },
): Record<string, unknown>;
export function leadPayloadFromInboxMessage(message: Parameters<typeof payloadFromInboxMessage>[1]): Record<string, unknown>;
