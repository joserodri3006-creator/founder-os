const crypto = require('node:crypto');

function hashReviewToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function clean(value, maxLength) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

function publicReviewName(name) {
  const parts = clean(name, 160).split(' ').filter(Boolean);
  if (!parts.length) return 'Verifizierter Kunde';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts.at(-1)[0].toUpperCase()}.`;
}

function validateReviewSubmission(input) {
  const rating = Number(input?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { ok: false, error: 'Bewertung muss zwischen 1 und 5 Sternen liegen.' };
  }
  const body = clean(input?.body, 4000);
  if (!body) return { ok: false, error: 'Bitte beschreiben Sie Ihre Erfahrung.' };
  const authorName = clean(input?.author_name, 160);
  return {
    ok: true,
    value: {
      rating,
      title: clean(input?.title, 160) || null,
      body,
      author_name: authorName || null,
      author_display_name: publicReviewName(authorName),
      public_consent: input?.public_consent === true,
    },
  };
}

const REVIEW_VENTURES = ['blazed_outfitters'];

function shouldCreateReviewInvitation({ venture, previousStatus, nextStatus, customerEmail, enabledVentures = REVIEW_VENTURES }) {
  return enabledVentures.includes(venture)
    && previousStatus !== 'abgeschlossen'
    && nextStatus === 'abgeschlossen'
    && Boolean(String(customerEmail ?? '').trim());
}

module.exports = { REVIEW_VENTURES, hashReviewToken, publicReviewName, validateReviewSubmission, shouldCreateReviewInvitation };
