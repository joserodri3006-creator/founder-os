const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeEmail,
  linkUpdateForEntity,
  parseIgnoredIds,
  addIgnoredId,
  leadPayloadFromInboxMessage,
} = require("../lib/inbox-actions.js");

test("normalizes email addresses before matching or lead creation", () => {
  assert.equal(normalizeEmail("  Max@Example.COM "), "max@example.com");
});

test("builds a safe polymorphic inbox link update", () => {
  assert.deepEqual(linkUpdateForEntity("lead", "lead-123"), {
    lead_id: "lead-123",
    customer_id: null,
    supplier_id: null,
    match_status: "matched_lead",
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
  const payload = leadPayloadFromInboxMessage({
    venture: "brandary",
    from_name: "Mia Schneider",
    from_email: " Mia@Example.COM ",
    subject: "Anfrage Shirts",
    body_preview: "Wir brauchen Teamshirts",
  });
  assert.equal(payload.venture, "brandary");
  assert.equal(payload.first_name, "Mia");
  assert.equal(payload.last_name, "Schneider");
  assert.equal(payload.email, "mia@example.com");
  assert.equal(payload.contact_channel, "email");
  assert.match(payload.notes, /Anfrage Shirts/);
});
