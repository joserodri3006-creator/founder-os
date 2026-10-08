const test = require('node:test');
const assert = require('node:assert/strict');

const {
  hashReviewToken,
  publicReviewName,
  validateReviewSubmission,
  shouldCreateReviewInvitation,
} = require('../lib/review-domain');

test('hashes review tokens deterministically without storing the raw token', () => {
  const raw = 'review-token-secret-123';
  const hash = hashReviewToken(raw);
  assert.equal(hash, hashReviewToken(raw));
  assert.notEqual(hash, raw);
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('anonymizes a customer name by default', () => {
  assert.equal(publicReviewName('Anna Müller'), 'Anna M.');
  assert.equal(publicReviewName('Chris'), 'Chris');
  assert.equal(publicReviewName(''), 'Verifizierter Kunde');
});

test('accepts a valid review submission', () => {
  const result = validateReviewSubmission({
    rating: 5,
    title: 'Sehr gute Erfahrung',
    body: 'Die Bestellung und Kommunikation waren zuverlässig.',
    public_consent: true,
    author_name: 'Anna Müller',
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.rating, 5);
  assert.equal(result.value.author_display_name, 'Anna M.');
});

test('rejects ratings outside one to five', () => {
  assert.deepEqual(validateReviewSubmission({ rating: 0, body: 'Text' }), {
    ok: false,
    error: 'Bewertung muss zwischen 1 und 5 Sternen liegen.',
  });
});

test('rejects empty review text', () => {
  assert.deepEqual(validateReviewSubmission({ rating: 4, body: '  ' }), {
    ok: false,
    error: 'Bitte beschreiben Sie Ihre Erfahrung.',
  });
});

test('creates an invitation only for a newly completed Blazed order with customer email', () => {
  assert.equal(shouldCreateReviewInvitation({
    venture: 'blazed_outfitters', previousStatus: 'in_bearbeitung', nextStatus: 'abgeschlossen', customerEmail: 'kunde@example.com',
  }), true);
  assert.equal(shouldCreateReviewInvitation({
    venture: 'brandary', previousStatus: 'in_bearbeitung', nextStatus: 'abgeschlossen', customerEmail: 'kunde@example.com',
  }), false);
  assert.equal(shouldCreateReviewInvitation({
    venture: 'blazed_outfitters', previousStatus: 'abgeschlossen', nextStatus: 'abgeschlossen', customerEmail: 'kunde@example.com',
  }), false);
  assert.equal(shouldCreateReviewInvitation({
    venture: 'blazed_outfitters', previousStatus: 'in_bearbeitung', nextStatus: 'abgeschlossen', customerEmail: '',
  }), false);
});
