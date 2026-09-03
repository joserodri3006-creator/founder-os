const VALID_LINK_TYPES = new Set(["lead", "customer", "supplier"]);

function normalizeEmail(value) {
  return String(value || "").toLowerCase().trim();
}

function splitName(value, fallbackEmail = "") {
  const clean = String(value || "").replace(/<[^>]+>/g, "").trim();
  if (clean) {
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first_name: parts[0], last_name: parts[0] };
    return { first_name: parts.slice(0, -1).join(" "), last_name: parts.at(-1) || parts[0] };
  }
  const local = normalizeEmail(fallbackEmail).split("@")[0] || "Unbekannt";
  return { first_name: local, last_name: local };
}

function senderDisplayName(message) {
  return String(message?.from_name || normalizeEmail(message?.from_email).split("@")[0] || "Unbekannt").trim();
}

function linkUpdateForEntity(entityType, entityId) {
  if (!VALID_LINK_TYPES.has(entityType)) throw new Error("entity_type muss lead, customer oder supplier sein");
  if (!entityId) throw new Error("entity_id ist erforderlich");
  return {
    lead_id: entityType === "lead" ? entityId : null,
    customer_id: entityType === "customer" ? entityId : null,
    supplier_id: entityType === "supplier" ? entityId : null,
    match_status: `matched_${entityType}`,
  };
}

function parseIgnoredIds(value) {
  try {
    const parsed = JSON.parse(String(value || "[]"));
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch (_) {
    return [];
  }
}

function addIgnoredId(existingValue, id) {
  return JSON.stringify([...new Set([...parseIgnoredIds(existingValue), id].filter(Boolean))]);
}

function commonNote(message) {
  return `Aus Founder-OS-Inbox angelegt. Ursprüngliche Mail: ${message?.subject || "(ohne Betreff)"}`;
}

function payloadFromInboxMessage(entityType, message, overrides = {}) {
  if (!VALID_LINK_TYPES.has(entityType)) throw new Error("entity_type muss lead, customer oder supplier sein");
  const names = splitName(message?.from_name, message?.from_email);
  const email = normalizeEmail(message?.from_email);
  const venture = message?.venture || "online_first";
  const company = typeof overrides.company_name === "string" && overrides.company_name.trim() ? overrides.company_name.trim() : null;
  const notes = typeof overrides.notes === "string" && overrides.notes.trim() ? overrides.notes.trim() : commonNote(message);

  if (entityType === "supplier") {
    return {
      venture,
      name: company || senderDisplayName(message),
      contact_name: senderDisplayName(message),
      email,
      phone: null,
      website: null,
      notes,
    };
  }

  const basePerson = {
    venture,
    first_name: typeof overrides.first_name === "string" && overrides.first_name.trim() ? overrides.first_name.trim() : names.first_name,
    last_name: typeof overrides.last_name === "string" && overrides.last_name.trim() ? overrides.last_name.trim() : names.last_name,
    email,
    company_name: company,
    phone: null,
    city: null,
    notes,
  };

  if (entityType === "customer") {
    return {
      ...basePerson,
      customer_type: "b2b",
      status: "active",
      discount_rate: 0,
    };
  }

  return {
    ...basePerson,
    source: "website",
    status: "neu",
    contact_reason: message?.body_preview || message?.subject || null,
    review_status: "unreviewed",
    contact_channel: "email",
    next_action: "antwort_pruefen",
  };
}

module.exports = {
  normalizeEmail,
  splitName,
  linkUpdateForEntity,
  parseIgnoredIds,
  addIgnoredId,
  payloadFromInboxMessage,
  leadPayloadFromInboxMessage: (message) => payloadFromInboxMessage("lead", message),
};
