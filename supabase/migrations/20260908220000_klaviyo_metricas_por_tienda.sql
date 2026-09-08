-- Alcance por tienda en las funciones del modulo de Klaviyo.
--
-- Las dos se escribieron sin `target_store_id` y eso es un fallo, no una
-- mejora pendiente: desde el modelo multitienda, `klaviyo_accounts.store_id`
-- ata cada cuenta de Klaviyo a una tienda, y una organizacion con dos tiendas
-- veia los emails de las dos mezclados en un solo inventario, sin nada en
-- pantalla que lo delatase. Las funciones de Meta ya llevaban el parametro
-- (20260907230000); estas se alinean.
--
-- target_store_id NULL = agregado de la organizacion, que es el comportamiento
-- que ya tenian: la llamada existente sigue significando lo mismo.
--
-- CLAUDE.md: anadir un parametro con `default` a una funcion existente crea una
-- SOBRECARGA, y entonces la llamada con un solo argumento encaja en las dos
-- firmas y Postgres la rechaza por ambigua. Por eso se hace `drop function` de
-- la firma vieja en esta misma migracion, antes de crear la nueva.

drop function if exists public.klaviyo_measurement_health(uuid);
drop function if exists public.klaviyo_email_inventory(uuid);

create or replace function public.klaviyo_email_inventory(
  target_organization_id uuid,
  target_store_id uuid default null
)
returns table (
  source text,
  parent_id uuid,
  parent_name text,
  parent_status text,
  trigger_type text,
  send_time timestamptz,
  message_id uuid,
  external_message_id text,
  position_in_parent bigint,
  subject text,
  preview_text text,
  external_template_id text,
  template_name text,
  body_chars integer,
  tracks_opens boolean,
  tracks_clicks boolean,
  adds_utm boolean,
  custom_utm_params integer
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select
    'flow'::text as source,
    f.id as parent_id,
    f.name::text as parent_name,
    f.status::text as parent_status,
    f.trigger_type::text,
    null::timestamptz as send_time,
    m.id as message_id,
    m.external_message_id::text,
    row_number() over (
      partition by f.id
      order by a.external_created_at nulls last, a.external_action_id
    ) as position_in_parent,
    m.subject::text,
    m.preview_text,
    m.external_template_id::text,
    t.name::text as template_name,
    length(t.html_content) as body_chars,
    null::boolean as tracks_opens,
    null::boolean as tracks_clicks,
    coalesce((m.raw_data->>'add_tracking_params')::boolean, false) as adds_utm,
    coalesce(jsonb_array_length(
      case when jsonb_typeof(m.raw_data->'custom_tracking_params') = 'array'
        then m.raw_data->'custom_tracking_params' else '[]'::jsonb end
    ), 0) as custom_utm_params
  from public.klaviyo_flow_messages m
  join public.klaviyo_flows f on f.id = m.flow_id
  left join public.klaviyo_flow_actions a on a.id = m.action_id
  left join public.klaviyo_templates t
    on t.organization_id = m.organization_id
   and t.external_template_id = m.external_template_id
  where m.organization_id = target_organization_id
    and (target_store_id is null or exists (
      select 1 from public.klaviyo_accounts ka
      where ka.id = f.account_id and ka.store_id = target_store_id
    ))

  union all

  select
    'campaign'::text,
    c.id,
    c.name::text,
    c.status::text,
    null::text,
    c.send_time,
    m.id,
    m.external_message_id::text,
    row_number() over (
      partition by c.id order by m.external_message_id
    ),
    m.subject::text,
    m.preview_text,
    m.external_template_id::text,
    t.name::text,
    length(t.html_content),
    (c.raw_data->'tracking_options'->>'is_tracking_opens')::boolean,
    (c.raw_data->'tracking_options'->>'is_tracking_clicks')::boolean,
    coalesce(
      (c.raw_data->'tracking_options'->>'add_tracking_params')::boolean,
      false
    ),
    coalesce(jsonb_array_length(
      case when jsonb_typeof(c.raw_data->'tracking_options'->'custom_tracking_params') = 'array'
        then c.raw_data->'tracking_options'->'custom_tracking_params'
        else '[]'::jsonb end
    ), 0)
  from public.klaviyo_campaign_messages m
  join public.klaviyo_campaigns c on c.id = m.campaign_id
  left join public.klaviyo_templates t
    on t.organization_id = m.organization_id
   and t.external_template_id = m.external_template_id
  where m.organization_id = target_organization_id
    and (m.channel is null or m.channel = 'email')
    and (target_store_id is null or exists (
      select 1 from public.klaviyo_accounts ka
      where ka.id = c.account_id and ka.store_id = target_store_id
    ));
$function$;

grant execute on function public.klaviyo_email_inventory(uuid, uuid) to authenticated;

comment on function public.klaviyo_email_inventory is
  'Un email por fila, venga de campana o de flujo: asunto, preheader, plantilla, tamano del cuerpo y configuracion de seguimiento (aperturas, clics, UTM). target_store_id NULL = toda la organizacion.';

drop function if exists public.klaviyo_measurement_health(uuid, uuid);
create or replace function public.klaviyo_measurement_health(
  target_organization_id uuid,
  target_store_id uuid default null
)
returns table (
  emails_total bigint,
  emails_sin_asunto bigint,
  emails_sin_cuerpo bigint,
  emails_sin_utm bigint,
  emails_sin_seguimiento_clics bigint,
  flujos_activos bigint,
  campanas_enviadas bigint,
  listas bigint,
  segmentos bigint,
  metrica_conversion text,
  ultimo_sync timestamptz,
  ultimo_sync_estado text,
  recursos_no_traidos text
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with cuentas as (
    select a.id
    from public.klaviyo_accounts a
    where a.organization_id = target_organization_id
      and (target_store_id is null or a.store_id = target_store_id)
  ),
  inventario as (
    select * from public.klaviyo_email_inventory(
      target_organization_id, target_store_id
    )
  ),
  ultimo as (
    -- El sync es por conexion, no por tienda: si se pide una tienda concreta,
    -- se mira el run de la conexion de SU cuenta.
    select r.status, r.error_message, r.finished_at, r.records_failed
    from public.integration_sync_runs r
    where r.organization_id = target_organization_id
      and r.provider = 'klaviyo'
      and (target_store_id is null or exists (
        select 1 from public.klaviyo_accounts a
        where a.id in (select id from cuentas)
          and a.connection_id = r.connection_id
      ))
    order by r.started_at desc
    limit 1
  )
  select
    (select count(*) from inventario),
    (select count(*) from inventario where subject is null),
    (select count(*) from inventario where coalesce(body_chars, 0) = 0),
    (select count(*) from inventario where not adds_utm),
    (select count(*) from inventario where tracks_clicks is false),
    (select count(*) from public.klaviyo_flows
      where organization_id = target_organization_id
        and status = 'live'
        and account_id in (select id from cuentas)),
    (select count(*) from public.klaviyo_campaigns
      where organization_id = target_organization_id
        and send_time is not null
        and account_id in (select id from cuentas)),
    (select count(*) from public.klaviyo_lists
      where organization_id = target_organization_id
        and account_id in (select id from cuentas)),
    (select count(*) from public.klaviyo_segments
      where organization_id = target_organization_id
        and account_id in (select id from cuentas)),
    (select a.conversion_metric_name::text from public.klaviyo_accounts a
      where a.id in (select id from cuentas) limit 1),
    (select finished_at from ultimo),
    (select status::text from ultimo),
    (select case when coalesce(records_failed, 0) > 0 then error_message end
      from ultimo);
$function$;

grant execute on function public.klaviyo_measurement_health(uuid, uuid) to authenticated;

comment on function public.klaviyo_measurement_health is
  'Estado de la medicion de email: cuantos emails no tienen asunto, cuerpo, UTM o seguimiento de clics, mas flujos, campanas, listas y segmentos y el estado del ultimo sync. target_store_id NULL = toda la organizacion.';
