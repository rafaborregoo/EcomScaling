-- Estado del email de toda la cartera del consultor en una sola consulta.
--
-- Mismo criterio que consultant_meta_signals: no pasa por los agentes. Que una
-- tienda no tenga ningun flujo activo, o que ninguno de sus emails etiquete sus
-- enlaces, son hechos contables. Gastar un modelo para verlos seria caro y
-- ademas irreproducible.
--
-- La diferencia con Meta esta en QUE cuesta dinero. En Meta lo grave es gastar
-- a ciegas: el presupuesto se quema igual. En email lo grave es NO enviar --
-- una tienda sin flujos activos no pierde dinero, deja de ganarlo todos los
-- dias, y eso no aparece en ningun informe porque no hay nada que informar.
--
-- ADR-0006 pto 6: `stable`, sin `security definer`. La RLS de cada tabla sigue
-- mandando: el array de entrada es un filtro, no la autorizacion.

drop function if exists public.consultant_klaviyo_signals(uuid[], integer);
create or replace function public.consultant_klaviyo_signals(
  target_organization_ids uuid[],
  lookback_days integer default 30
)
returns table (
  organization_id uuid,
  connection_status text,
  last_sync_at timestamptz,
  sync_incomplete boolean,
  emails_total integer,
  emails_sin_utm integer,
  emails_sin_cuerpo integer,
  flows_active integer,
  campaigns_in_window integer,
  last_send_at timestamptz,
  lists integer,
  segments integer
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with orgs as (
    select distinct unnest(target_organization_ids) as organization_id
  ),
  desde as (
    select (now() - make_interval(days => greatest(lookback_days, 1))) as inicio
  ),
  -- Una organizacion puede tener varias conexiones; manda la peor, igual que
  -- en Meta: una rota no se disimula con otra sana.
  conexion as (
    select distinct on (c.organization_id)
      c.organization_id,
      c.status::text as status,
      c.last_sync_at
    from public.integration_connections c
    where c.organization_id in (select organization_id from orgs)
      and c.provider = 'klaviyo'
    order by c.organization_id, (c.status = 'error') desc, c.last_sync_at desc nulls first
  ),
  ultimo_run as (
    select distinct on (r.organization_id)
      r.organization_id,
      coalesce(r.records_failed, 0) > 0 as incompleto
    from public.integration_sync_runs r
    where r.organization_id in (select organization_id from orgs)
      and r.provider = 'klaviyo'
    order by r.organization_id, r.started_at desc
  ),
  inventario as (
    select
      o.organization_id,
      count(e.*)::integer as emails_total,
      count(e.*) filter (where not e.adds_utm)::integer as emails_sin_utm,
      count(e.*) filter (where coalesce(e.body_chars, 0) = 0)::integer as emails_sin_cuerpo
    from orgs o
    left join lateral public.klaviyo_email_inventory(o.organization_id) e on true
    group by o.organization_id
  )
  select
    o.organization_id,
    conexion.status,
    conexion.last_sync_at,
    coalesce(ultimo_run.incompleto, false),
    coalesce(inventario.emails_total, 0),
    coalesce(inventario.emails_sin_utm, 0),
    coalesce(inventario.emails_sin_cuerpo, 0),
    (select count(*)::integer from public.klaviyo_flows f
      where f.organization_id = o.organization_id and f.status = 'live'),
    (select count(*)::integer from public.klaviyo_campaigns c
      where c.organization_id = o.organization_id
        and c.send_time is not null
        and c.send_time >= (select inicio from desde)),
    (select max(c.send_time) from public.klaviyo_campaigns c
      where c.organization_id = o.organization_id and c.send_time is not null),
    (select count(*)::integer from public.klaviyo_lists l
      where l.organization_id = o.organization_id),
    (select count(*)::integer from public.klaviyo_segments s
      where s.organization_id = o.organization_id)
  from orgs o
  left join conexion on conexion.organization_id = o.organization_id
  left join ultimo_run on ultimo_run.organization_id = o.organization_id
  left join inventario on inventario.organization_id = o.organization_id;
$function$;

grant execute on function public.consultant_klaviyo_signals(uuid[], integer) to authenticated;

comment on function public.consultant_klaviyo_signals is
  'Señales deterministas del email de cada organizacion de la cartera: estado de la conexion, si el ultimo sync quedo incompleto, inventario de emails y cuantos no etiquetan enlaces o no tienen cuerpo, flujos activos, campanas en la ventana y tamano de listas y segmentos. El ranking se calcula en Node (klaviyo-triage).';
