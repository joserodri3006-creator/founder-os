-- Jarvis Autonomie: SOP-Definitionen (Standard-Fälle, die Jarvis eigenständig ausführen
-- darf) + Warteschlange für vom taeglichen Cron vorgeschlagene/ausgefuehrte Aktionen.
--
-- WICHTIG: `jarvis_autonomous_actions` ist bewusst NICHT `jarvis_pending_actions` genannt —
-- diese Tabelle existiert bereits fuer das Chat-Bestaetigungs-Gate (pausiert einen
-- einzelnen Tool-Call MITTEN in einer laufenden Konversation) und hat ein anderes Schema.
-- Die hier definierte Tabelle ist fuer den Cron-getriebenen, konversationslosen Ablauf.

create table if not exists sop_definitions (
  id uuid primary key default gen_random_uuid(),
  venture venture not null,
  action_type text not null,   -- z.B. 'send_followup_email'
  title text not null,
  description text,
  conditions jsonb not null default '{}'::jsonb,  -- z.B. {"max_discount_pct": 0, "standard_payment_terms": true}
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sop_definitions_venture on sop_definitions(venture, action_type, active);

create table if not exists jarvis_autonomous_actions (
  id uuid primary key default gen_random_uuid(),
  venture venture not null,
  action_type text not null,
  entity_type text,           -- z.B. 'lead', 'order', 'customer'
  entity_id uuid,
  action_payload jsonb not null default '{}'::jsonb,
  reason text not null,
  sop_id uuid references sop_definitions(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'executed', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_jarvis_autonomous_actions_status on jarvis_autonomous_actions(status, venture, created_at desc);

alter table sop_definitions enable row level security;
alter table jarvis_autonomous_actions enable row level security;

create policy "sop_definitions_founder_only"
  on sop_definitions for all
  using (exists (select 1 from user_venture_roles where user_id = auth.uid() and role = 'founder'))
  with check (exists (select 1 from user_venture_roles where user_id = auth.uid() and role = 'founder'));

create policy "jarvis_autonomous_actions_founder_only"
  on jarvis_autonomous_actions for all
  using (exists (select 1 from user_venture_roles where user_id = auth.uid() and role = 'founder'))
  with check (exists (select 1 from user_venture_roles where user_id = auth.uid() and role = 'founder'));

create or replace function jarvis_touch_sop_definitions()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_jarvis_touch_sop_definitions on sop_definitions;
create trigger trg_jarvis_touch_sop_definitions
  before update on sop_definitions
  for each row execute function jarvis_touch_sop_definitions();

-- Hinweis: pg_cron-Schedules werden in diesem Projekt bewusst direkt in der DB angelegt
-- (siehe CLAUDE.md, andere Cron-Funktionen sind ebenfalls nicht als Migration eingecheckt).
-- Nach Deploy der Edge Function 'jarvis-autonomous-check' bitte manuell ausfuehren:
--
-- select cron.schedule(
--   'jarvis-autonomous-check',
--   '0 7 * * *',
--   $$select net.http_post(
--     url := 'https://<PROJECT_REF>.functions.supabase.co/jarvis-autonomous-check',
--     headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>')
--   )$$
-- );
--
-- Autonomie ist standardmaessig AUS (system_config 'jarvis_autonomy_enabled' fehlt = false).
-- Erst nach Pruefung der ersten paar Vorschlaege im Shadow-Mode explizit aktivieren:
--   insert into system_config (key, value) values ('jarvis_autonomy_enabled', 'true')
--   on conflict (key) do update set value = 'true';
