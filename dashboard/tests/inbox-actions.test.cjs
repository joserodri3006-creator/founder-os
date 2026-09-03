const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeEmail,
  linkUpdateForEntity,
  normalizeFolder,
  bulkCandidateCount,
  parseIgnoredIds,
  addIgnoredId,
  payloadFromInboxMessage,
} = require("../lib/inbox-actions.js");

const message = {
  venture: "brandary",
  from_name: "Mia Schneider",
  from_email: " Mia@Example.COM ",
  subject: "Anfrage Shirts",
  body_preview: "Wir brauchen Teamshirts",
};

test("normalizes email addresses before matching or entity creation", () => {
  assert.equal(normalizeEmail("  Max@Example.COM "), "max@example.com");
});

test("builds safe polymorphic inbox link updates for leads customers and partners", () => {
  assert.deepEqual(linkUpdateForEntity("lead", "lead-123"), {
    lead_id: "lead-123",
    customer_id: null,
    supplier_id: null,
    match_status: "matched_lead",
  });
  assert.deepEqual(linkUpdateForEntity("customer", "customer-123"), {
    lead_id: null,
    customer_id: "customer-123",
    supplier_id: null,
    match_status: "matched_customer",
  });
  assert.deepEqual(linkUpdateForEntity("supplier", "supplier-123"), {
    lead_id: null,
    customer_id: null,
    supplier_id: "supplier-123",
    match_status: "matched_supplier",
  });
  assert.throws(() => linkUpdateForEntity("order", "x"), /entity_type/);
});

test("adds ignored message ids without breaking inbox sync idempotency", () => {
  assert.deepEqual(parseIgnoredIds('["a","b"]'), ["a", "b"]);
  assert.equal(addIgnoredId('["a"]', "b"), '["a","b"]');
  assert.equal(addIgnoredId('["a"]', "a"), '["a"]');
  assert.deepEqual(parseIgnoredIds('not-json'), []);
});

test("derives a lead payload from an inbox message", () => {
  const payload = payloadFromInboxMessage("lead", message);
  assert.equal(payload.venture, "brandary");
  assert.equal(payload.first_name, "Mia");
  assert.equal(payload.last_name, "Schneider");
  assert.equal(payload.email, "mia@example.com");
  assert.equal(payload.contact_channel, "email");
  assert.match(payload.notes, /Anfrage Shirts/);
});

test("derives customer and partner payloads from an inbox message", () => {
  const customer = payloadFromInboxMessage("customer", message, { company_name: "Mia GmbH" });
  assert.equal(customer.company_name, "Mia GmbH");
  assert.equal(customer.customer_type, "b2b");
  assert.equal(customer.status, "active");
  assert.equal(customer.email, "mia@example.com");

  const partner = payloadFromInboxMessage("supplier", message, { company_name: "Textil Partner" });
  assert.equal(partner.name, "Textil Partner");
  assert.equal(partner.contact_name, "Mia Schneider");
  assert.equal(partner.email, "mia@example.com");
});

test("normalizes inbox folders for inbound sent and drafts views", () => {
  assert.equal(normalizeFolder("INBOX"), "INBOX");
  assert.equal(normalizeFolder("[Gmail]/Sent Mail"), "sent");
  assert.equal(normalizeFolder("Entwürfe"), "drafts");
});

test("counts bulk candidates by same sender and venture", () => {
  const selected = { from_email: "a@example.com", venture: "brandary" };
  assert.equal(bulkCandidateCount([
    selected,
    { from_email: " A@Example.com ", venture: "brandary" },
    { from_email: "a@example.com", venture: "online_first" },
    { from_email: "b@example.com", venture: "brandary" },
  ], selected), 2);
});
