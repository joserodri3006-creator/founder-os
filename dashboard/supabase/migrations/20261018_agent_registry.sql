-- Founder OS Agent Registry
-- Central catalog for agents, scripts, workers and automations.
-- A venture is optional: system, portfolio, personal, shared-service and client scopes are first-class.

create table if not exists public.agent_registry (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  agent_type text not null default 'ai_agent'
    check (agent_type in ('ai_agent', 'manager_agent', 'script', 'worker', 'automation')),
  owner_type text not null default 'founder'
    check (owner_type in ('founder', 'system', 'client')),
  scope_type text not null default 'venture'
    check (scope_type in ('founder_os', 'portfolio', 'venture', 'personal', 'shared_service', 'client_project')),
  scope_id text not null,
  venture text,
  project_id text,
  role text not null,
  purpose text,
  manager_agent_id uuid references public.agent_registry(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'testing', 'active', 'pilot', 'paused', 'retired')),
  blueprint_ref text,
  prompt_ref text,
  source_ref text,
  cron_job_id text,
  trigger_type text
    check (trigger_type is null or trigger_type in ('cron', 'event', 'manual', 'polling', 'on_demand')),
  provider text,
  model text,
  schedule text,
  deliver_target text,
  budget_monthly_cents integer check (budget_monthly_cents is null or budget_monthly_cents >= 0),
  last_run_at timestamptz,
  last_status text check (last_status is null or last_status in ('ok', 'partial', 'blocked', 'error', 'conflict')),
  last_error text,
  success_criteria jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_registry_scope_consistency check (
    (scope_type = 'venture' and venture is not null and project_id is null)
    or (scope_type = 'client_project' and project_id is not null and venture is null)
    or (scope_type <> 'venture' and scope_type <> 'client_project' and venture is null and project_id is null)
  )
);

create table if not exists public.agent_capabilities (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_registry(id) on delete cascade,
  capability text not null,
  scope_type text not null check (scope_type in ('founder_os', 'portfolio', 'venture', 'personal', 'shared_service', 'client_project', 'entity', 'tool', 'global')),
  scope_value text not null,
  mode text not null check (mode in ('read', 'draft', 'write', 'execute')),
  approval_required boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (agent_id, capability, scope_type, scope_value, mode)
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references public.agent_registry(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('cron', 'event', 'manual', 'manager', 'polling')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'ok', 'partial', 'blocked', 'error', 'conflict')),
  input_summary text,
  source_refs jsonb not null default '[]'::jsonb,
  actions_count integer not null default 0 check (actions_count >= 0),
  verified_count integer not null default 0 check (verified_count >= 0),
  error_summary text,
  cost_cents integer check (cost_cents is null or cost_cents >= 0),
  output_ref text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists agent_registry_scope_status_idx
  on public.agent_registry (scope_type, scope_id, status);
create index if not exists agent_registry_venture_status_idx
  on public.agent_registry (venture, status);
create index if not exists agent_registry_manager_idx
  on public.agent_registry (manager_agent_id);
create index if not exists agent_registry_type_idx
  on public.agent_registry (agent_type, status);
create index if not exists agent_capabilities_agent_active_idx
  on public.agent_capabilities (agent_id, active);
create index if not exists agent_runs_agent_started_idx
  on public.agent_runs (agent_id, started_at desc);
create index if not exists agent_runs_status_idx
  on public.agent_runs (status, started_at desc);

create or replace function public.touch_agent_registry_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_registry_touch_updated_at on public.agent_registry;
create trigger agent_registry_touch_updated_at
before update on public.agent_registry
for each row execute function public.touch_agent_registry_updated_at();

comment on table public.agent_registry is 'Founder OS catalog for agents, manager agents, scripts, workers and automations. Scope is independent from venture.';
comment on column public.agent_registry.scope_type is 'Where the unit belongs: Founder OS, portfolio, venture, personal, shared service or client project.';
comment on column public.agent_registry.venture is 'Optional venture identifier. Must remain null for system-wide, portfolio, personal, shared-service and client-project entries.';
comment on table public.agent_capabilities is 'Scoped read/draft/write/execute capabilities and approval requirements per agent.';
comment on table public.agent_runs is 'Run-level input, source, action, verification, status and cost metadata.';
