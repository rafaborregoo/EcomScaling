-- Estado de Meta de toda la cartera del consultor en una sola consulta.
--
-- A diferencia del ranking de tiendas de /shopify, este no pasa por los
-- agentes: las señales de una cuenta publicitaria rota son deterministas y
-- estan en las tablas. Un pixel que lleva dos dias sin disparar es un hecho,
-- no una interpretacion, y no hace falta gastar un modelo para verlo. La
-- contrapartida es que solo detecta lo que se puede contar; el juicio sobre si
-- una campaña tiene sentido sigue siendo del consultor.
--
-- ADR-0006 pto 6: `stable`, sin `security definer`. La RLS de cada tabla sigue
-- mandando, asi que el array de entrada es un filtro, no la autorizacion: un
-- consultor que meta ids de organizaciones ajenas no recibe nada de ellas.

drop function if exists public.consultant_meta_signals(uuid[], integer);
create or replace function public.consultant_meta_signals(
  target_organization_ids uuid[],
  lookback_days integer default 30
)
returns table (
  organization_id uuid,
  ad_accounts integer,
  connection_status text,
  last_sync_at timestamptz,
  spend numeric,
  days_with_spend integer,
  pixels integer,
  pixels_silent integer,
  ads_with_issues integer,
  ad_sets_learning integer,
  spend_below_average numeric,
  spend_with_verdict numeric,
  recent_changes integer
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with orgs as (
    select distinct unnest(target_organization_ids) as organization_id
  ),
  bounds as (
    select
      (current_date - lookback_days)::date as since,
      (current_date - 7)::date as since_changes
  ),
  base_rows as (
    select
      r.organization_id, r.ad_id, r.spend, r.metric_date, r.quality_ranking
    from public.meta_insight_rows_daily r, bounds b
    where r.organization_id = any(target_organization_ids)
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.metric_date >= b.since
  ),
  spend_by_org as (
    select
      organization_id,
      sum(spend) as spend,
      count(distinct metric_date)::integer as days_with_spend
    from base_rows
    group by organization_id
  ),
  spend_by_ad as (
    select organization_id, ad_id, sum(spend) as spend
    from base_rows
    where ad_id is not null
    group by organization_id, ad_id
  ),
  -- El veredicto vigente por anuncio, igual que en meta_creative_performance:
  -- una media del periodo diria otra cosa que lo que Meta opina hoy.
  verdict as (
    select distinct on (ad_id) ad_id, quality_ranking
    from base_rows
    where ad_id is not null and quality_ranking is not null
    order by ad_id, metric_date desc
  ),
  verdict_spend as (
    select
      s.organization_id,
      coalesce(sum(s.spend) filter (
        where v.quality_ranking like 'BELOW_AVERAGE%'
      ), 0) as spend_below_average,
      -- UNKNOWN no cuenta como veredicto: Meta lo devuelve cuando no tiene
      -- volumen para juzgar, que no es lo mismo que aprobar el anuncio. Sin
      -- esta exclusion el denominador infla y la cuota sale demasiado buena.
      coalesce(sum(s.spend) filter (
        where v.quality_ranking is not null and v.quality_ranking <> 'UNKNOWN'
      ), 0) as spend_with_verdict
    from spend_by_ad s
    left join verdict v on v.ad_id = s.ad_id
    group by s.organization_id
  ),
  accounts as (
    select organization_id, count(*)::integer as ad_accounts
    from public.meta_ad_accounts
    where organization_id = any(target_organization_ids)
      and is_selected and is_active
    group by organization_id
  ),
  connections as (
    select distinct on (c.organization_id)
      c.organization_id, c.status::text as connection_status, c.last_sync_at
    from public.integration_connections c
    where c.organization_id = any(target_organization_ids)
      and c.provider = 'meta_ads'
    -- Si hay varias conexiones, manda la que peor esta: una rota es el motivo
    -- para mirar, aunque otra funcione.
    order by c.organization_id, (c.status = 'error') desc, c.last_sync_at desc nulls first
  ),
  pixel_state as (
    select
      organization_id,
      count(*)::integer as pixels,
      count(*) filter (
        where coalesce(is_unavailable, false)
          or last_fired_at is null
          or last_fired_at < now() - interval '24 hours'
      )::integer as pixels_silent
    from public.meta_pixels
    where organization_id = any(target_organization_ids)
    group by organization_id
  ),
  issue_state as (
    select organization_id, count(distinct ad_id)::integer as ads_with_issues
    from public.meta_ad_issues
    where organization_id = any(target_organization_ids)
    group by organization_id
  ),
  learning_state as (
    select organization_id, count(*)::integer as ad_sets_learning
    from public.meta_ad_sets
    where organization_id = any(target_organization_ids)
      and learning_stage_status = 'LEARNING'
      and effective_status = 'ACTIVE'
    group by organization_id
  ),
  change_state as (
    select a.organization_id, count(*)::integer as recent_changes
    from public.meta_account_activities a, bounds b
    where a.organization_id = any(target_organization_ids)
      and a.event_time >= b.since_changes
    group by a.organization_id
  )
  select
    o.organization_id,
    coalesce(ac.ad_accounts, 0) as ad_accounts,
    cn.connection_status,
    cn.last_sync_at,
    coalesce(sp.spend, 0) as spend,
    coalesce(sp.days_with_spend, 0) as days_with_spend,
    coalesce(px.pixels, 0) as pixels,
    coalesce(px.pixels_silent, 0) as pixels_silent,
    coalesce(iss.ads_with_issues, 0) as ads_with_issues,
    coalesce(lr.ad_sets_learning, 0) as ad_sets_learning,
    coalesce(vs.spend_below_average, 0) as spend_below_average,
    coalesce(vs.spend_with_verdict, 0) as spend_with_verdict,
    coalesce(ch.recent_changes, 0) as recent_changes
  from orgs o
  left join accounts ac on ac.organization_id = o.organization_id
  left join connections cn on cn.organization_id = o.organization_id
  left join spend_by_org sp on sp.organization_id = o.organization_id
  left join verdict_spend vs on vs.organization_id = o.organization_id
  left join pixel_state px on px.organization_id = o.organization_id
  left join issue_state iss on iss.organization_id = o.organization_id
  left join learning_state lr on lr.organization_id = o.organization_id
  left join change_state ch on ch.organization_id = o.organization_id;
$function$;

grant execute on function public.consultant_meta_signals(uuid[], integer) to authenticated;

-- El predicado de meta_ad_issues al contar por organizacion.
create index if not exists meta_ad_issues_org_ad_idx
  on public.meta_ad_issues (organization_id, ad_id);
