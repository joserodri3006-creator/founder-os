-- Migration: Activities und Tasks Tabellen
-- Erstellt am: 2026-06-21
-- Ohne Foreign Key Constraints (können später hinzugefügt werden)

-- ──────────────────────────────────────────────────────
-- ACTIVITIES Tabelle
-- ──────────────────────────────────────────────────────
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null,
  type text not null default 'note',
  description text not null,
  data jsonb default null,
  created_by uuid default null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Indexes für Performance
create index if not exists idx_activities_contact_id on public.activities(contact_id);
create index if not exists idx_activities_created_at on public.activities(created_at desc);
create index if not exists idx_activities_type on public.activities(type);

-- ──────────────────────────────────────────────────────
-- TASKS Tabelle
-- ──────────────────────────────────────────────────────
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null,
  title text not null,
  description text default null,
  status text not null default 'open',
  priority text not null default 'medium',
  due_date date default null,
  assigned_user_id uuid default null,
  created_by uuid default null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  completed_at timestamp with time zone default null
);

-- Indexes für Performance
create index if not exists idx_tasks_contact_id on public.tasks(contact_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_assigned_user_id on public.tasks(assigned_user_id);
create index if not exists idx_tasks_priority on public.tasks(priority);

-- ──────────────────────────────────────────────────────
-- Trigger für updated_at
-- ──────────────────────────────────────────────────────
create or replace function public.update_activities_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function public.update_tasks_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists activities_update_timestamp on public.activities;
create trigger activities_update_timestamp
  before update on public.activities
  for each row
  execute function public.update_activities_timestamp();

drop trigger if exists tasks_update_timestamp on public.tasks;
create trigger tasks_update_timestamp
  before update on public.tasks
  for each row
  execute function public.update_tasks_timestamp();
