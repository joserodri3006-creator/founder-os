const test = require("node:test");
const assert = require("node:assert/strict");
const {
  statusAfterSuccessfulEmailSend,
  canSetStatusWithoutEmailSend,
  mailKind,
} = require("../lib/lead-mail-state.js");

test("first successfully sent email marks a lead as contacted", () => {
  assert.equal(statusAfterSuccessfulEmailSend("neu"), "kontaktiert");
  assert.equal(statusAfterSuccessfulEmailSend("in_bearbeitung"), "kontaktiert");
});

test("successful follow-up sends advance the lead exactly one stage", () => {
  assert.equal(statusAfterSuccessfulEmailSend("kontaktiert"), "follow_up");
  assert.equal(statusAfterSuccessfulEmailSend("follow_up"), "nachgefasst");
});

test("sending mail does not move later sales stages backwards", () => {
  assert.equal(statusAfterSuccessfulEmailSend("erstgespraech"), "erstgespraech");
  assert.equal(statusAfterSuccessfulEmailSend("gewonnen"), "gewonnen");
});

test("follow-up statuses cannot be set without a successful email send", () => {
  assert.equal(canSetStatusWithoutEmailSend("follow_up"), false);
  assert.equal(canSetStatusWithoutEmailSend("nachgefasst"), false);
  assert.equal(canSetStatusWithoutEmailSend("kontaktiert"), true);
  assert.equal(canSetStatusWithoutEmailSend("gewonnen"), true);
});

test("mail folders map to explicit timeline kinds", () => {
  assert.equal(mailKind("INBOX"), "received");
  assert.equal(mailKind("sent"), "sent");
  assert.equal(mailKind("drafts"), "draft");
  assert.equal(mailKind("Gesendet"), "sent");
  assert.equal(mailKind("Entwürfe"), "draft");
});
