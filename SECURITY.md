# Security Operations

## Immediate Action Required

On 2026-05-26 a database credential was found in repository documentation. It has
been removed from the current branch, but removal in a new commit does not revoke
the credential or remove it from earlier Git history.

Before deploying the automated sales work:

1. Rotate the Supabase database password in the Supabase project dashboard.
2. Review and rotate `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and AI provider
   keys if they may have been stored outside approved secret stores.
3. Move the GitHub repository to private visibility unless public source access is
   intentional.
4. Purge the leaked credential from Git history after rotation, following GitHub's
   sensitive-data-removal process.
5. Store all replacement values only in Supabase/Vercel environment secrets and
   local ignored `.env.local` files.

Never put live credentials into `CLAUDE.md`, documentation, issues, commits or
application logs.

## New Protection In This Branch

- `dashboard/proxy.ts` rejects unauthenticated dashboard and internal API requests.
- Existing section permissions are checked for mapped internal APIs before
  service-role queries run.
- New public sales endpoints are isolated under `/api/public/*`.
- Public Fit-Check submission is rate-limited, honeypot protected and supports
  mandatory Cloudflare Turnstile in production.
- Stripe fulfillment accepts only signed webhook payloads and is idempotent by
  Stripe Checkout Session ID.
- Online checkout requires `ONLINE_FIRST_LEGAL_APPROVED=true`, so it cannot accept
  payments until approved B2B/legal documents are published.
- Manual Google lead research keeps `GOOGLE_CUSTOM_SEARCH_API_KEY` and
  `GOOGLE_CUSTOM_SEARCH_ENGINE_ID` server-side; imported candidates require
  reviewed contact details and start with outreach automation disabled.

## Remaining Hardening

Server-side section checks protect normal internal API entry points. Before
granting non-founder team accounts broad production access, add entity-level
venture checks to dynamic resources such as `/api/auftraege/[id]`,
`/api/kunden/[id]` and attachments so a guessed ID cannot cross venture boundaries.
