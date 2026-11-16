-- Allow voucher redemptions from external shop orders (e.g. Blazed Stripe/WooCommerce).
-- Existing Founder OS order_id remains supported; external_order_id is used when no
-- internal orders row exists.

alter table public.voucher_redemptions
  alter column order_id drop not null;

alter table public.voucher_redemptions
  add column if not exists external_order_id text;

create unique index if not exists voucher_redemptions_voucher_external_order_idx
  on public.voucher_redemptions (voucher_id, external_order_id)
  where external_order_id is not null;

comment on column public.voucher_redemptions.external_order_id is 'External shop order reference, such as WooCommerce order ID or Stripe payment intent.';
