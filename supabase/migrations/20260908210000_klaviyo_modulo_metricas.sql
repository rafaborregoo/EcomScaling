-- Funciones del modulo de Klaviyo: inventario de emails y salud de la medicion.
--
-- Por que estas dos y no un panel de rendimiento: el rendimiento ya lo da
-- klaviyo_email_report, y depende de klaviyo_report_values, que solo se llena
-- con envios reales. Lo que SI tenemos validado contra la cuenta real es la
-- estructura (flujos, sus emails, asuntos, cuerpos) y la configuracion de
-- medicion de cada pieza. Eso es lo que estas funciones exponen.
--
-- ADR-0006 pto 6: `stable`, SECURITY INVOKER (la RLS de cada tabla ya filtra por
-- organizacion), sin agregar en Node, llamadas via .rpc().

-- Un email es un email lo envie una campana o un flujo, asi que las dos mitades
-- se unen aqui y no en la pantalla.
--
-- De donde sale cada cosa:
--   - Campana: la configuracion de seguimiento vive en la CAMPANA
--     (raw_data.tracking_options), no en su mensaje.
--   - Flujo: el mensaje ES el objeto incrustado en la accion, asi que sus
--     opciones (add_tracking_params) estan en su propio raw_data.
--   - El cuerpo se mide en caracteres de HTML: es lo unico que Klaviyo devuelve
--     lleno (el `text` de las plantillas del editor visual viene vacio).
drop function if exists public.klaviyo_email_inventory(uuid);
create or replace function public.klaviyo_email_inventory(
  target_organization_id uuid
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
  -- Emails de flujo, ordenados por el orden real de la accion dentro del flujo.
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
    -- El mensaje de flujo no declara seguimiento de aperturas/clics: lo hereda
    -- de la cuenta. Se devuelve null en vez de inventarse un true.
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
    and (m.channel is null or m.channel = 'email');
$function$;

grant execute on function public.klaviyo_email_inventory(uuid) to authenticated;

comment on function public.klaviyo_email_inventory is
  'Un email por fila, venga de campana o de flujo: asunto, preheader, plantilla, tamano del cuerpo y configuracion de seguimiento (aperturas, clics, UTM). Fuente validada contra una cuenta Klaviyo real.';

-- Resumen de "se puede creer lo que mide esta cuenta". Mismo papel que
-- meta_pixel_health en el modulo de Meta: sale antes que el rendimiento, porque
-- si la medicion esta rota el rendimiento describe otra cosa.
drop function if exists public.klaviyo_measurement_health(uuid);
create or replace function public.klaviyo_measurement_health(
  target_organization_id uuid
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
  with inventario as (
    select * from public.klaviyo_email_inventory(target_organization_id)
  ),
  ultimo as (
    select status, error_message, finished_at, records_failed
    from public.integration_sync_runs
    where organization_id = target_organization_id
      and provider = 'klaviyo'
    order by started_at desc
    limit 1
  )
  select
    (select count(*) from inventario),
    (select count(*) from inventario where subject is null),
    (select count(*) from inventario where coalesce(body_chars, 0) = 0),
    -- Sin UTM el trafico de ese email llega a Shopify y a Analytics sin
    -- atribuir: es medicion rota, no una preferencia.
    (select count(*) from inventario where not adds_utm),
    (select count(*) from inventario where tracks_clicks is false),
    (select count(*) from public.klaviyo_flows
      where organization_id = target_organization_id and status = 'live'),
    (select count(*) from public.klaviyo_campaigns
      where organization_id = target_organization_id and send_time is not null),
    (select count(*) from public.klaviyo_lists
      where organization_id = target_organization_id),
    (select count(*) from public.klaviyo_segments
      where organization_id = target_organization_id),
    (select conversion_metric_name::text from public.klaviyo_accounts
      where organization_id = target_organization_id limit 1),
    (select finished_at from ultimo),
    (select status::text from ultimo),
    -- `succeeded` no basta: la pasada se anota completa aunque se haya dejado
    -- recursos por el camino. Si los hay, se dicen.
    (select case when coalesce(records_failed, 0) > 0 then error_message end
      from ultimo);
$function$;

grant execute on function public.klaviyo_measurement_health(uuid) to authenticated;

comment on function public.klaviyo_measurement_health is
  'Estado de la medicion de email de una organizacion: cuantos emails no tienen asunto, cuerpo, UTM o seguimiento de clics, mas el inventario de flujos, campanas, listas y segmentos y el estado del ultimo sync.';

create index if not exists klaviyo_flow_messages_org_flow_idx
  on public.klaviyo_flow_messages (organization_id, flow_id);

create index if not exists klaviyo_campaign_messages_org_campaign_idx
  on public.klaviyo_campaign_messages (organization_id, campaign_id);
