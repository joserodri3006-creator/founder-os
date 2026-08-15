-- Jarvis Gedächtnis: persistentes, durchsuchbares Wissen ueber Konversationen hinweg.
-- Drei Typen im selben Speicher: personal (Founder-Praeferenzen), venture (Kunden-/
-- Projektwissen pro Venture), knowledge (recherchiertes Fachwissen, ventureuebergreifend).

create extension if not exists vector;

create table if not exists jarvis_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  venture venture,  -- NULL bei memory_type = 'personal' oder 'knowledge'
  memory_type text not null check (memory_type in ('personal', 'venture', 'knowledge')),
  content text not null,
  embedding vector(1024),  -- Voyage voyage-3.5, output_dimension=1024
  source text not null check (source in ('explicit', 'extracted', 'research')),
  source_ref text,  -- z.B. URL bei research, conversation_id bei extracted
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_jarvis_memory_user on jarvis_memory(user_id, memory_type, venture);

-- HNSW statt IVFFlat: funktioniert auch auf einer (anfangs) leeren/kleinen Tabelle
-- ohne vorheriges Training, im Gegensatz zu IVFFlat-Listen.
create index if not exists idx_jarvis_memory_embedding
  on jarvis_memory using hnsw (embedding vector_cosine_ops);

alter table jarvis_memory enable row level security;

create policy "jarvis_memory_founder_own"
  on jarvis_memory for all
  using (
    user_id = auth.uid()
    and exists (
      select 1 from user_venture_roles
      where user_id = auth.uid() and role = 'founder'
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from user_venture_roles
      where user_id = auth.uid() and role = 'founder'
    )
  );

create or replace function jarvis_touch_memory()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_jarvis_touch_memory on jarvis_memory;
create trigger trg_jarvis_touch_memory
  before update on jarvis_memory
  for each row execute function jarvis_touch_memory();

-- Semantische Suche fuer die Service-Role (Dashboard-API und ggf. Edge Functions).
-- match_venture = NULL bedeutet: keine Venture-Einschraenkung (Founder-Kontext sieht
-- personal + knowledge + alle venture-Eintraege).
create or replace function match_jarvis_memory(
  query_embedding vector(1024),
  match_user uuid,
  match_venture text default null,
  match_count int default 8,
  match_types text[] default array['personal', 'venture', 'knowledge']
)
returns table (
  id uuid,
  venture venture,
  memory_type text,
  content text,
  source text,
  source_ref text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    m.id, m.venture, m.memory_type, m.content, m.source, m.source_ref, m.created_at,
    1 - (m.embedding <=> query_embedding) as similarity
  from jarvis_memory m
  where m.user_id = match_user
    and m.memory_type = any(match_types)
    and (
      match_venture is null
      or m.venture is null
      or m.venture::text = match_venture
    )
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- Naechster-Nachbar-Suche fuer Dedup beim Schreiben (ein Treffer reicht).
create or replace function find_similar_jarvis_memory(
  query_embedding vector(1024),
  match_user uuid,
  match_memory_type text,
  match_venture text default null,
  max_distance float default 0.15
)
returns table (id uuid, content text, distance float)
language sql stable
as $$
  select m.id, m.content, m.embedding <=> query_embedding as distance
  from jarvis_memory m
  where m.user_id = match_user
    and m.memory_type = match_memory_type
    and (
      (match_venture is null and m.venture is null)
      or m.venture::text = match_venture
    )
  order by m.embedding <=> query_embedding
  limit 1;
$$;

-- Anmerkung: max_distance wird bewusst in der Anwendungsschicht (nicht hier) geprueft,
-- damit der Aufrufer entscheiden kann ob der naechste Nachbar nah genug fuer ein Update ist.
