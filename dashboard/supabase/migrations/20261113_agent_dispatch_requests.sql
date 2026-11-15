-- Founder OS Dispatcher MVP
-- Stores human requests as transparent task cards before an agent run exists.

create table if not exists public.agent_dispatch_requests (
  id uuid primary key default gen_random_uuid(),
  request_text text not null check (length(trim(request_text)) > 0),
  source text not null default 'founder_os'
    check (source in ('founder_os', 'telegram', 'manual', 'system')),
  requested_scope_type text,
  requested_scope_id text,
  inferred_scope_type text,
  inferred_scope_id text,
  scope_confidence text not null default 'medium'
    check (scope_confidence in ('high', 'medium', 'low', 'manual')),
  selected_manager_agent_id uuid references public.agent_registry(id) on delete set null,
  status text not null default 'queued'
    check (status in ('queued', 'dispatching', 'waiting_user', 'approval_required', 'completed', 'failed', 'cancelled')),
  action_mode text not null default 'analysis'
    check (action_mode in ('analysis', 'draft', 'prepare', 'execute')),
  result_summary text,
  next_action text,
  approval_required boolean not null default false,
  error_summary text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_dispatch_requests_status_idx
  on public.agent_dispatch_requests (status, created_at desc);
create index if not exists agent_dispatch_requests_scope_idx
  on public.agent_dispatch_requests (inferred_scope_type, inferred_scope_id, created_at desc);
create index if not exists agent_dispatch_requests_manager_idx
  on public.agent_dispatch_requests (selected_manager_agent_id, created_at desc);

create or replace function public.touch_agent_dispatch_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agent_dispatch_requests_touch_updated_at on public.agent_dispatch_requests;
create trigger agent_dispatch_requests_touch_updated_at
before update on public.agent_dispatch_requests
for each row execute function public.touch_agent_dispatch_requests_updated_at();

comment on table public.agent_dispatch_requests is 'Founder OS dispatcher task cards. A card is not an agent run until a runner claims and executes it.';
comment on column public.agent_dispatch_requests.scope_confidence is 'Confidence of automatic scope inference; manual means explicitly selected by the founder.';
comment on column public.agent_dispatch_requests.action_mode is 'Requested autonomy boundary: analysis, draft, prepare or execute.';
