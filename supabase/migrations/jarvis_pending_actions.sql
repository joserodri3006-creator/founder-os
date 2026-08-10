-- Jarvis Bestätigungs-Gate: pausiert einen Tool-Aufruf, der Nebenwirkungen für Kunden hat
-- (z.B. update_order_status → automatische E-Mail via order-workflow), bis der Nutzer im
-- Chat explizit zustimmt. Persistiert den Rest der Tool-Queue + bereits ausgeführte
-- Tool-Results, damit die Anthropic-Message-Sequenz (tool_use -> tool_result) über zwei
-- getrennte HTTP-Requests hinweg konsistent bleibt.

create table if not exists jarvis_pending_actions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references jarvis_conversations(id) on delete cascade unique,
  tool_queue jsonb not null,
  executed_results jsonb not null default '[]'::jsonb,
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_jarvis_pending_actions_conversation on jarvis_pending_actions(conversation_id);

alter table jarvis_pending_actions enable row level security;

create policy "jarvis_pending_actions_founder_own"
  on jarvis_pending_actions for all
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
