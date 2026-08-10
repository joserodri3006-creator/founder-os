-- Jarvis Chat Interface: Konversationen + Nachrichten (Founder-only)

create table if not exists jarvis_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jarvis_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references jarvis_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_jarvis_conversations_user on jarvis_conversations(user_id, updated_at desc);
create index if not exists idx_jarvis_messages_conversation on jarvis_messages(conversation_id, created_at);

alter table jarvis_conversations enable row level security;
alter table jarvis_messages enable row level security;

-- Nur Founder duerfen ueberhaupt eigene Konversationen sehen/aendern (Jarvis ist aktuell founder-only).
create policy "jarvis_conversations_founder_own"
  on jarvis_conversations for all
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

create policy "jarvis_messages_founder_own"
  on jarvis_messages for all
  using (
    exists (
      select 1 from jarvis_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
        and exists (
          select 1 from user_venture_roles
          where user_id = auth.uid() and role = 'founder'
        )
    )
  )
  with check (
    exists (
      select 1 from jarvis_conversations c
      where c.id = conversation_id
        and c.user_id = auth.uid()
        and exists (
          select 1 from user_venture_roles
          where user_id = auth.uid() and role = 'founder'
        )
    )
  );

create or replace function jarvis_touch_conversation()
returns trigger as $$
begin
  update jarvis_conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_jarvis_touch_conversation on jarvis_messages;
create trigger trg_jarvis_touch_conversation
  after insert on jarvis_messages
  for each row execute function jarvis_touch_conversation();
