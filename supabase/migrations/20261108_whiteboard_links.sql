-- Founder OS Whiteboards: verknuepfte Aufgaben
alter table public.whiteboards
  add column if not exists links jsonb not null default '{"task_ids":[]}'::jsonb;
