-- Panel platform_admin (/admin/consultores): estadisticas de uso de IA por
-- cliente y por consultor -- coste estimado, nº de ejecuciones y agentes mas
-- usados en una ventana temporal.
--
-- ADR-0006 pto. 6: agregacion en funciones SQL `stable` (SECURITY INVOKER, la
-- RLS de agent_runs sigue aplicando), llamadas via .rpc(); nunca sumar en Node.
-- Indice que calza con el predicado de fecha, creado junto a las funciones.

create index if not exists agent_runs_org_started_at_idx
  on public.agent_runs (organization_id, started_at);

-- Estadisticas por organizacion (cliente).
drop function if exists public.admin_organization_ai_stats(timestamptz);
create or replace function public.admin_organization_ai_stats(since timestamptz)
returns table (
  organization_id uuid,
  total_cost_usd numeric,
  run_count bigint,
  top_agents jsonb
)
language sql
stable
as $$
  with runs as (
    select
      ar.organization_id,
      ar.estimated_cost_usd,
      ad.name as agent_name
    from public.agent_runs ar
    join public.agent_versions av on av.id = ar.agent_version_id
    join public.agent_definitions ad on ad.id = av.definition_id
    where ar.started_at >= since
  ),
  per_agent as (
    select organization_id, agent_name, count(*) as agent_runs
    from runs
    group by organization_id, agent_name
  ),
  ranked as (
    select
      organization_id,
      agent_name,
      agent_runs,
      row_number() over (
        partition by organization_id order by agent_runs desc, agent_name
      ) as rn
    from per_agent
  ),
  top_by_org as (
    select
      organization_id,
      jsonb_agg(
        jsonb_build_object('name', agent_name, 'runs', agent_runs)
        order by agent_runs desc, agent_name
      ) as top_agents
    from ranked
    where rn <= 3
    group by organization_id
  )
  select
    r.organization_id,
    round(sum(r.estimated_cost_usd), 4) as total_cost_usd,
    count(*) as run_count,
    coalesce(t.top_agents, '[]'::jsonb) as top_agents
  from runs r
  left join top_by_org t on t.organization_id = r.organization_id
  group by r.organization_id, t.top_agents;
$$;

grant execute on function public.admin_organization_ai_stats(timestamptz) to authenticated;

-- Estadisticas por consultor: agregadas sobre sus consultant_assignments
-- activas.
drop function if exists public.admin_consultant_ai_stats(timestamptz);
create or replace function public.admin_consultant_ai_stats(since timestamptz)
returns table (
  consultant_user_id uuid,
  client_count bigint,
  total_cost_usd numeric,
  run_count bigint,
  top_agents jsonb
)
language sql
stable
as $$
  with assign as (
    select consultant_user_id, organization_id
    from public.consultant_assignments
    where is_active
  ),
  runs as (
    select
      a.consultant_user_id,
      ar.estimated_cost_usd,
      ad.name as agent_name
    from assign a
    join public.agent_runs ar
      on ar.organization_id = a.organization_id
     and ar.started_at >= since
    join public.agent_versions av on av.id = ar.agent_version_id
    join public.agent_definitions ad on ad.id = av.definition_id
  ),
  per_agent as (
    select consultant_user_id, agent_name, count(*) as agent_runs
    from runs
    group by consultant_user_id, agent_name
  ),
  ranked as (
    select
      consultant_user_id,
      agent_name,
      agent_runs,
      row_number() over (
        partition by consultant_user_id order by agent_runs desc, agent_name
      ) as rn
    from per_agent
  ),
  top_by_consultant as (
    select
      consultant_user_id,
      jsonb_agg(
        jsonb_build_object('name', agent_name, 'runs', agent_runs)
        order by agent_runs desc, agent_name
      ) as top_agents
    from ranked
    where rn <= 3
    group by consultant_user_id
  ),
  cost_by_consultant as (
    select
      consultant_user_id,
      round(sum(estimated_cost_usd), 4) as total_cost_usd,
      count(*) as run_count
    from runs
    group by consultant_user_id
  ),
  clients as (
    select consultant_user_id, count(*) as client_count
    from assign
    group by consultant_user_id
  )
  select
    c.consultant_user_id,
    c.client_count,
    coalesce(co.total_cost_usd, 0) as total_cost_usd,
    coalesce(co.run_count, 0) as run_count,
    coalesce(t.top_agents, '[]'::jsonb) as top_agents
  from clients c
  left join cost_by_consultant co on co.consultant_user_id = c.consultant_user_id
  left join top_by_consultant t on t.consultant_user_id = c.consultant_user_id;
$$;

grant execute on function public.admin_consultant_ai_stats(timestamptz) to authenticated;
