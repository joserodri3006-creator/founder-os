create index if not exists customers_venture_created_idx
  on public.customers (venture, created_at);

create index if not exists leads_venture_won_idx
  on public.leads (venture, won_at)
  where won_at is not null;

create index if not exists tasks_venture_completed_idx
  on public.tasks (venture, completed_at)
  where completed_at is not null;

create index if not exists products_venture_status_idx
  on public.products (venture, status);

create or replace function public.dashboard_venture_summary(
  p_venture text,
  p_period text default 'month',
  p_as_of date default current_date
)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_venture public.venture;
  v_start date;
  v_end date;
  v_step interval;
  v_result jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  begin
    v_venture := p_venture::public.venture;
  exception when invalid_text_representation then
    raise exception 'unknown venture';
  end;

  if not private.current_user_has_venture(v_venture::text) then
    raise exception 'access denied';
  end if;

  case lower(p_period)
    when 'week' then
      v_start := pg_catalog.date_trunc('week', p_as_of::timestamp)::date;
      v_end := v_start + 7;
      v_step := interval '1 day';
    when 'month' then
      v_start := pg_catalog.date_trunc('month', p_as_of::timestamp)::date;
      v_end := (v_start + interval '1 month')::date;
      v_step := interval '1 day';
    when 'quarter' then
      v_start := pg_catalog.date_trunc('quarter', p_as_of::timestamp)::date;
      v_end := (v_start + interval '3 months')::date;
      v_step := interval '1 month';
    when 'year' then
      v_start := pg_catalog.date_trunc('year', p_as_of::timestamp)::date;
      v_end := (v_start + interval '1 year')::date;
      v_step := interval '1 month';
    else
      raise exception 'period must be week, month, quarter or year';
  end case;

  with
  lead_stats as (
    select
      count(*) filter (where l.created_at >= v_start and l.created_at < v_end) as new_leads,
      count(*) filter (where l.won_at >= v_start and l.won_at < v_end) as won_leads,
      count(*) filter (where l.archived_at is null and l.status not in ('gewonnen', 'verloren')) as open_leads_total
    from public.leads l
    where l.venture = v_venture
  ),
  customer_stats as (
    select count(*) as customers_created
    from public.customers c
    where c.venture = v_venture
      and c.created_at >= v_start
      and c.created_at < v_end
  ),
  task_stats as (
    select
      count(*) filter (where t.created_at >= v_start and t.created_at < v_end) as created,
      count(*) filter (where t.completed_at >= v_start and t.completed_at < v_end) as completed,
      count(*) filter (where coalesce(t.status, '') not in ('done', 'completed', 'erledigt')) as open_total
    from public.tasks t
    where t.venture = v_venture
  ),
  order_stats as (
    select
      count(*) as orders,
      coalesce(sum(o.value), 0) as order_value
    from public.orders o
    where o.venture = v_venture
      and o.created_at >= v_start
      and o.created_at < v_end
  ),
  product_stats as (
    select count(*) as active_products
    from public.products p
    where p.venture = v_venture and p.status = 'active'
  ),
  finance_stats as (
    select
      coalesce(sum(f.amount) filter (where f.type = 'income'), 0) as income,
      coalesce(sum(f.amount) filter (where f.type = 'expense'), 0) as expense
    from public.finance_entries f
    where f.venture = v_venture
      and f.entry_date >= v_start
      and f.entry_date < v_end
  ),
  venture_agents as materialized (
    select a.*
    from public.agent_registry a
    where coalesce(a.venture, case when a.scope_type = 'venture' then a.scope_id end) = v_venture::text
  ),
  agent_stats as (
    select
      count(*) as registered,
      count(*) filter (where a.status = 'active') as active,
      count(*) filter (where a.agent_type = 'manager_agent' and a.status = 'active') as manager_agents,
      count(*) filter (where a.agent_type = 'ai_agent' and a.status = 'active') as ai_agents,
      count(*) filter (where a.agent_type in ('script', 'worker', 'automation') and a.status = 'active') as automations
    from venture_agents a
  ),
  agent_items as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'slug', a.slug,
          'name', a.name,
          'purpose', a.purpose,
          'role', a.role,
          'agent_type', a.agent_type,
          'status', a.status,
          'trigger_type', a.trigger_type,
          'schedule', a.schedule,
          'last_run_at', a.last_run_at,
          'last_status', a.last_status
        ) order by a.name
      ),
      '[]'::jsonb
    ) as items
    from venture_agents a
  ),
  run_stats as (
    select
      count(*) filter (where r.started_at >= v_start and r.started_at < v_end) as runs_in_period,
      count(*) filter (where r.started_at >= v_start and r.started_at < v_end and r.status in ('failed', 'error')) as failed_runs_in_period,
      max(r.started_at) as last_run_at,
      count(*) > 0 as telemetry_ready
    from public.agent_runs r
    join venture_agents a on a.id = r.agent_id
  ),
  buckets as (
    select bucket::date as bucket_start
    from pg_catalog.generate_series(v_start::timestamp, (v_end - 1)::timestamp, v_step) as bucket
  ),
  lead_trend as (
    select
      (case when lower(p_period) in ('week', 'month')
        then pg_catalog.date_trunc('day', l.created_at)
        else pg_catalog.date_trunc('month', l.created_at)
      end)::date as bucket_start,
      count(*) as leads
    from public.leads l
    where l.venture = v_venture and l.created_at >= v_start and l.created_at < v_end
    group by 1
  ),
  order_trend as (
    select
      (case when lower(p_period) in ('week', 'month')
        then pg_catalog.date_trunc('day', o.created_at)
        else pg_catalog.date_trunc('month', o.created_at)
      end)::date as bucket_start,
      count(*) as orders
    from public.orders o
    where o.venture = v_venture and o.created_at >= v_start and o.created_at < v_end
    group by 1
  ),
  trend_json as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'bucket_start', b.bucket_start,
          'label', case when lower(p_period) in ('week', 'month')
            then pg_catalog.to_char(b.bucket_start, 'DD.MM.')
            else pg_catalog.to_char(b.bucket_start, 'MM.YYYY')
          end,
          'leads', coalesce(l.leads, 0),
          'orders', coalesce(o.orders, 0)
        ) order by b.bucket_start
      ),
      '[]'::jsonb
    ) as trend
    from buckets b
    left join lead_trend l using (bucket_start)
    left join order_trend o using (bucket_start)
  )
  select jsonb_build_object(
    'venture', v_venture::text,
    'period', jsonb_build_object(
      'dimension', lower(p_period),
      'from', v_start,
      'to_exclusive', v_end,
      'start', v_start,
      'end', v_end - 1,
      'as_of', p_as_of,
      'calendar_week', extract(week from p_as_of)::int,
      'calendar_quarter', extract(quarter from p_as_of)::int,
      'calendar_year', extract(year from p_as_of)::int
    ),
    'crm', jsonb_build_object(
      'new_leads', ls.new_leads,
      'won_leads', ls.won_leads,
      'customers_created', cs.customers_created,
      'open_leads_total', ls.open_leads_total
    ),
    'tasks', jsonb_build_object(
      'created', ts.created,
      'completed', ts.completed,
      'open_total', ts.open_total
    ),
    'commerce', jsonb_build_object(
      'orders', os.orders,
      'order_value', os.order_value,
      'active_products', ps.active_products,
      'readiness', 'partial',
      'note', 'Founder-OS-Bestand; WooCommerce-Daten sind bewusst noch nicht enthalten'
    ),
    'finance', jsonb_build_object(
      'income', fs.income,
      'expense', fs.expense,
      'readiness', 'partial',
      'note', 'Nur vorhandene Founder-OS-Einträge; noch keine belastbare GuV'
    ),
    'agents', jsonb_build_object(
      'registered', ast.registered,
      'active', ast.active,
      'manager_agents', ast.manager_agents,
      'ai_agents', ast.ai_agents,
      'automations', ast.automations,
      'runs_in_period', rs.runs_in_period,
      'failed_runs_in_period', rs.failed_runs_in_period,
      'last_run_at', rs.last_run_at,
      'telemetry_ready', rs.telemetry_ready,
      'items', ai.items,
      'note', case when rs.telemetry_ready
        then 'Zentrale Agentenlaufdaten vorhanden'
        else 'Agentenkatalog vorhanden; zentrale Lauf- und Fehlerprotokollierung ist noch nicht angeschlossen'
      end
    ),
    'trend', tj.trend,
    'data_quality', jsonb_build_object(
      'crm', 'ready',
      'commerce', 'partial',
      'orders', 'partial',
      'finance', 'partial',
      'woocommerce', 'not_included',
      'woocommerce_included', false,
      'agent_catalog', 'ready',
      'agent_telemetry', case when rs.telemetry_ready then 'ready' else 'missing' end
    )
  ) into v_result
  from lead_stats ls
  cross join customer_stats cs
  cross join task_stats ts
  cross join order_stats os
  cross join product_stats ps
  cross join finance_stats fs
  cross join agent_stats ast
  cross join agent_items ai
  cross join run_stats rs
  cross join trend_json tj;

  return v_result;
end;
$$;
