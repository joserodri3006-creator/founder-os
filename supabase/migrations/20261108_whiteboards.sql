-- Founder OS Whiteboards
-- Persistente Boards fuer Founder, mit optionalem Venture-Bezug.

create table if not exists public.whiteboards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venture venture,
  name text not null,
  template_id text not null,
  content jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists whiteboards_user_updated_idx
  on public.whiteboards (user_id, updated_at desc)
  where archived_at is null;

create index if not exists whiteboards_venture_idx
  on public.whiteboards (venture)
  where archived_at is null;

alter table public.whiteboards enable row level security;

drop policy if exists "whiteboards_founder_own" on public.whiteboards;
create policy "whiteboards_founder_own"
  on public.whiteboards for all
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_venture_roles
      where user_id = auth.uid() and role = 'founder'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.user_venture_roles
      where user_id = auth.uid() and role = 'founder'
    )
  );

create or replace function public.whiteboards_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_whiteboards_touch_updated_at on public.whiteboards;
create trigger trg_whiteboards_touch_updated_at
  before update on public.whiteboards
  for each row execute function public.whiteboards_touch_updated_at();
