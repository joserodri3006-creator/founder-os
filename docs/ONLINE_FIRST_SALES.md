# Online First Automated Sales Funnel

## Delivered On 2026-05-26

This branch introduces the first automated sales path for Online First without
replacing the existing Founder OS CRM.

Offer configuration:

- Audience: German B2B consultants and coaches.
- Product: five-page lead-generation website with contact/booking funnel.
- Price: `2,490 EUR` net plus applicable VAT.
- Payment: `50%` Stripe deposit (`1,245 EUR` net) at order start.
- Routing: fit projects enter checkout; shop, custom-integration or larger
  website requests are directed to a booking fallback.

## User Flow

1. Visitor opens `/online-first`.
2. `/online-first/fit` collects project fit, attribution and consent information.
3. `POST /api/public/fit-check` creates a CRM lead and `sales_submissions` row.
4. Qualified visitors accept B2B/terms confirmation and call
   `POST /api/public/checkout`.
5. Stripe Checkout takes the deposit after the legal launch gate is enabled.
6. Signed `POST /api/public/stripe/webhook` events create or link the customer,
   create one order with paid deposit state, mark the lead won and start briefing.
7. A tokenized `/online-first/briefing` form writes the structured customer
   input into the paid order and advances it into processing.
8. Founder OS `/dashboard` reports fit checks, checkout starts, deposits and
   net deposit revenue for the month.

Existing functions retained:

- The existing `online_first` 50/50 payment model is reused.
- `status-workflow` remains responsible for ordinary won-lead handling and now
  avoids inserting a second order when a Stripe checkout already produced one.
- Manual dashboard/CSV lead creation continues through `/api/leads`, behind login.

## Database Migration

Apply `supabase/migrations/sales_funnel.sql` before deploying the dashboard code.
It is additive and introduces:

- Extra funnel, consent and attribution columns on `leads`.
- Stripe correlation columns on `orders`.
- `sales_submissions` for fit answers and routing decisions.
- `sales_checkout_sessions` for idempotent payment fulfillment.
- `consent_events` for versioned evidence.
- `project_briefings` for paid-customer implementation input.
- `public_request_limits` for submission throttling.

## Required Configuration

Vercel/dashboard environment:

```text
NEXT_PUBLIC_SITE_URL=https://your-production-domain.example
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
NEXT_PUBLIC_BOOKING_URL=https://your-booking-page.example
TURNSTILE_SECRET_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
ONLINE_FIRST_LEGAL_APPROVED=false
```

Existing Supabase and Resend values remain required. Set
`ONLINE_FIRST_LEGAL_APPROVED=true` only after the published legal documents,
checkout wording, tax treatment and tracking consent have been reviewed for the
German B2B launch.

Supabase Edge Function secret for the legacy `lead-intake` endpoint:

```text
PUBLIC_SITE_ORIGIN=https://your-production-domain.example
TURNSTILE_SECRET_KEY=...
```

The new public funnel uses the Next.js endpoint instead of `lead-intake`; that
Edge Function is retained for controlled external integrations.

### Local Visual Preview

For local UI reviews without a Supabase project or payment account, start the app
with both preview flags set:

```text
ONLINE_FIRST_PREVIEW_MODE=true
NEXT_PUBLIC_ONLINE_FIRST_PREVIEW_MODE=true
```

Preview mode evaluates and displays fit routing but deliberately does not write
lead data, create checkout sessions or accept payment.

## Stripe Setup

1. Configure Stripe automatic tax for the German B2B sale.
2. Register webhook endpoint `/api/public/stripe/webhook`.
3. Subscribe to `checkout.session.completed` and
   `checkout.session.async_payment_succeeded`.
4. Put the signing secret into `STRIPE_WEBHOOK_SECRET`.
5. Test a successful deposit and replay the event; replay must not create a
   second order.

## Launch Checklist

- Complete the credential-rotation actions in `SECURITY.md`.
- Apply the Supabase migration and deploy the changed Edge Functions.
- Publish legally reviewed terms/privacy content in `/online-first/rechtliches`.
- Configure Turnstile, Stripe, booking URL and production site URL.
- Verify anonymous users receive `401` for internal `/api/*` routes.
- Submit a fit lead for each routing result and confirm CRM attribution.
- Complete a Stripe test payment and verify lead, customer, order and paid step.
- Complete the tokenized briefing and verify order status/activity updates.
- Configure consent-compliant analytics/ads events before turning on Meta spend.
