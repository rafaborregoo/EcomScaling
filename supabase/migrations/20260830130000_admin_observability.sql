-- Panel platform_admin (/admin/observabilidad): salud del runtime de agentes IA
-- a nivel de plataforma -- ejecuciones, fallos, coste y latencia por agente en
-- una ventana temporal.
--
-- ADR-0006 pto. 6: la agregacion vive en una funcion SQL `stable` (SECURITY
-- INVOKER, la RLS de agent_runs sigue aplicando -- un platform_admin ve todas
-- las orgs via private.is_platform_admin()), llamada via .rpc(); nunca sumar en
-- Node. El indice agent_runs_started_at_idx (db_08a) ya calza con el predicado.

create or replace function public.admin_agent_runtime_stats(since timestamptz)
returns table (
  agent_code varchar,
  agent_name varchar,
  run_count bigint,
  failed_count bigint,
  running_count bigint,
  total_cost_usd numeric,
  avg_latency_ms integer,
  p95_latency_ms integer
)
language sql
stable
as $$
  select
    ad.code as agent_code,
    ad.name as agent_name,
    count(*) as run_count,
    count(*) filter (where ar.status in ('failed', 'rejected_output')) as failed_count,
    count(*) filter (where ar.status = 'running') as running_count,
    round(coalesce(sum(ar.estimated_cost_usd), 0), 4) as total_cost_usd,
    round(avg(ar.latency_ms))::int as avg_latency_ms,
    percentile_cont(0.95) within group (order by ar.latency_ms)::int as p95_latency_ms
  from public.agent_runs ar
  join public.agent_versions av on av.id = ar.agent_version_id
  join public.agent_definitions ad on ad.id = av.definition_id
  where ar.started_at >= since
  group by ad.code, ad.name
  order by count(*) desc, ad.name;
$$;

grant execute on function public.admin_agent_runtime_stats(timestamptz) to authenticated;
