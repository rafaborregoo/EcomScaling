-- Consumo de IA por agente para el panel de platform admin.
--
-- Una fila por agente con cuantas veces ha corrido y todos sus tokens (entrada,
-- salida y cache). Se agrega en SQL, como el resto de metricas; el indice
-- agent_runs_started_at_idx calza con el predicado de fecha. `since` nulo = todo
-- el historial. El copiloto (a09) se incluye solo si se pide: tiene saldo propio.
--
-- Solo lo llama la API con la clave de servicio tras comprobar platform_admin.

drop function if exists public.admin_ai_usage_by_agent(timestamptz, boolean);
create or replace function public.admin_ai_usage_by_agent(
  since timestamptz default null,
  include_copilot boolean default false
)
returns table (
  agent_code varchar,
  agent_name varchar,
  run_count bigint,
  succeeded_count bigint,
  failed_count bigint,
  rejected_count bigint,
  running_count bigint,
  zero_token_runs bigint,
  input_tokens bigint,
  output_tokens bigint,
  cache_read_tokens bigint,
  cache_creation_tokens bigint,
  total_cost_usd numeric,
  runs_by_trigger jsonb,
  runs_by_model jsonb,
  first_run_at timestamptz,
  last_run_at timestamptz
)
language sql
stable
set search_path = pg_catalog, public
as $$
  with base as (
    select
      ad.code as code,
      ad.name as name,
      ar.status,
      ar.trigger_type,
      coalesce(ar.model, av.model) as model,
      ar.input_tokens,
      ar.output_tokens,
      ar.cache_read_tokens,
      ar.cache_creation_tokens,
      ar.estimated_cost_usd,
      ar.started_at
    from public.agent_runs ar
    join public.agent_versions av on av.id = ar.agent_version_id
    join public.agent_definitions ad on ad.id = av.definition_id
    where (since is null or ar.started_at >= since)
      and (include_copilot or ad.code <> 'a09_copiloto_consultor')
  ),
  by_trigger as (
    select code, jsonb_object_agg(trigger_type, n) as j
    from (select code, trigger_type, count(*) as n from base group by code, trigger_type) t
    group by code
  ),
  by_model as (
    select code, jsonb_object_agg(model, n) as j
    from (select code, coalesce(model, 'desconocido') as model, count(*) as n from base group by code, coalesce(model, 'desconocido')) t
    group by code
  )
  select
    b.code::varchar,
    b.name::varchar,
    count(*),
    count(*) filter (where b.status = 'succeeded'),
    count(*) filter (where b.status not in ('succeeded', 'rejected_output', 'running')),
    count(*) filter (where b.status = 'rejected_output'),
    count(*) filter (where b.status = 'running'),
    count(*) filter (where b.input_tokens + b.output_tokens = 0),
    coalesce(sum(b.input_tokens), 0)::bigint,
    coalesce(sum(b.output_tokens), 0)::bigint,
    coalesce(sum(b.cache_read_tokens), 0)::bigint,
    coalesce(sum(b.cache_creation_tokens), 0)::bigint,
    round(coalesce(sum(b.estimated_cost_usd), 0), 4),
    coalesce(bt.j, '{}'::jsonb),
    coalesce(bm.j, '{}'::jsonb),
    min(b.started_at),
    max(b.started_at)
  from base b
  left join by_trigger bt on bt.code = b.code
  left join by_model bm on bm.code = b.code
  group by b.code, b.name, bt.j, bm.j
  order by coalesce(sum(b.input_tokens), 0) + coalesce(sum(b.output_tokens), 0) desc, b.name;
$$;

revoke execute on function public.admin_ai_usage_by_agent(timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.admin_ai_usage_by_agent(timestamptz, boolean) to service_role;
