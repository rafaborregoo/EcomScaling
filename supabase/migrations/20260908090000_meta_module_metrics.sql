-- Metricas del modulo Meta (ADR-0006 punto 6: funciones SQL stable, sin
-- security definer, llamadas via .rpc(); nunca agregar en Node).
--
-- Antes de las funciones nuevas, dos correcciones de aritmetica. Las dos
-- estaban invisibles porque la unica cuenta conectada es una seed, y la seed
-- escribe una forma de fila que el sync real no produce.
--
-- 1. VENTANAS DE ATRIBUCION. El sync pide a Meta tres ventanas
--    (1d_click, 7d_click, 1d_view), asi que cada action_type devuelve TRES
--    filas en meta_insight_action_metrics. `meta_spend_summary` las sumaba:
--    con datos reales habria reportado el triple de compras y el triple de
--    ingresos. La seed solo escribe 'default', por eso cuadraba.
--
--    No se pueden sumar: son la misma compra contada con tres reglas
--    distintas. Hay que elegir UNA, y decir cual (ADR-0021: cada cifra lleva
--    su ventana).
--
-- 2. DESGLOSES. Las tres funciones filtran `breakdown_hash = 'none'`, que es
--    lo correcto, pero el sync solo escribia filas desglosadas por
--    plataforma. Arreglado en el sync (corte total sin desglose); aqui queda
--    documentado por que ese filtro es el bueno: el alcance no es aditivo
--    entre desgloses ni entre dias, y los rankings de subasta no vienen
--    cuando pides desglose.

-- --- Politica de ventana de atribucion ---------------------------------------
--
-- Un unico sitio donde se decide que ventana gana. Si esto vive repetido en
-- seis funciones, en seis meses no coincidiran.
--
-- Orden: 7d_click primero porque es el ajuste por defecto de Meta y lo que
-- ve el cliente en su propio panel. 'default' es lo que llega cuando Meta no
-- desglosa por ventana (o cuando la fila viene de la seed). 1d_view va
-- ultimo: atribuir una compra a alguien que solo vio el anuncio es la regla
-- mas generosa y la que menos se parece a causalidad.
create or replace function public.meta_attribution_window_rank(window_name text)
returns integer
language sql
immutable
set search_path to 'pg_catalog', 'public'
as $function$
  select case window_name
    when '7d_click' then 1
    when '1d_click' then 2
    when 'default'  then 3
    when '1d_view'  then 4
    else 9
  end;
$function$;

comment on function public.meta_attribution_window_rank(text) is
  'Prioridad de ventana de atribucion de Meta. Menor = preferida. Se elige una, nunca se suman.';

-- Indice que calce con el predicado que usan todas las funciones de abajo.
-- Desde que el sync trae cinco cortes, las filas sin desglose son una minoria
-- de la tabla: el parcial evita recorrer las otras cuatro.
create index if not exists meta_insight_rows_total_idx
  on public.meta_insight_rows_daily (organization_id, metric_date)
  include (ad_id, ad_set_id, campaign_id)
  where breakdown_hash = 'none' and level = 'ad';

-- --- Correccion: una sola ventana en las tres funciones existentes ------------

drop function if exists public.meta_spend_summary(uuid, date, date, uuid);
create or replace function public.meta_spend_summary(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  spend numeric, impressions bigint, clicks bigint, purchases numeric,
  purchase_value numeric, roas numeric, cac numeric, days_with_data bigint,
  purchase_action_types text[]
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select r.id, r.ad_account_id, r.spend, r.impressions, r.clicks, r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  -- Una fila por (insight, metrica): la ventana preferida gana, el resto se
  -- descarta. Sumarlas contaria la misma compra hasta tres veces.
  row_purchases as (
    select distinct on (m.insight_row_id, m.metric_name)
      m.insight_row_id, m.metric_name, m.value
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    order by
      m.insight_row_id,
      m.metric_name,
      public.meta_attribution_window_rank(m.attribution_window)
  ),
  purchase_actions as (
    select
      coalesce(sum(value) filter (where metric_name = 'actions'), 0) as purchases,
      coalesce(sum(value) filter (where metric_name = 'action_values'), 0) as purchase_value
    from row_purchases
  ),
  action_types as (
    select coalesce(array_agg(distinct a.canonical_purchase_action_type), '{}') as types
    from base_rows b
    join public.meta_ad_accounts a on a.id = b.ad_account_id
  )
  select
    coalesce(sum(b.spend), 0) as spend,
    coalesce(sum(b.impressions), 0)::bigint as impressions,
    coalesce(sum(b.clicks), 0)::bigint as clicks,
    p.purchases,
    p.purchase_value,
    case when coalesce(sum(b.spend), 0) > 0 then round(p.purchase_value / sum(b.spend), 4) else null end as roas,
    case when p.purchases > 0 then round(coalesce(sum(b.spend), 0) / p.purchases, 2) else null end as cac,
    count(distinct b.metric_date)::bigint as days_with_data,
    t.types as purchase_action_types
  from base_rows b
  cross join purchase_actions p
  cross join action_types t
  group by p.purchases, p.purchase_value, t.types;
$function$;

drop function if exists public.meta_spend_by_campaign(uuid, date, date, uuid);
create or replace function public.meta_spend_by_campaign(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  campaign_id uuid, campaign_name text, spend numeric, impressions bigint,
  clicks bigint, purchases numeric, purchase_value numeric, roas numeric,
  days_with_data bigint, purchase_action_type text
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.id, r.ad_account_id, r.campaign_id, r.spend, r.impressions,
      r.clicks, r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.campaign_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  row_purchases as (
    select distinct on (m.insight_row_id, m.metric_name)
      m.insight_row_id, m.metric_name, m.value, b.campaign_id
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    order by
      m.insight_row_id,
      m.metric_name,
      public.meta_attribution_window_rank(m.attribution_window)
  ),
  purchases_by_campaign as (
    select
      campaign_id,
      coalesce(sum(value) filter (where metric_name = 'actions'), 0) as purchases,
      coalesce(sum(value) filter (where metric_name = 'action_values'), 0) as purchase_value
    from row_purchases
    group by campaign_id
  )
  select
    b.campaign_id,
    max(c.name)::text as campaign_name,
    coalesce(sum(b.spend), 0) as spend,
    coalesce(sum(b.impressions), 0)::bigint as impressions,
    coalesce(sum(b.clicks), 0)::bigint as clicks,
    coalesce(p.purchases, 0) as purchases,
    coalesce(p.purchase_value, 0) as purchase_value,
    case
      when coalesce(sum(b.spend), 0) > 0
      then round(coalesce(p.purchase_value, 0) / sum(b.spend), 4)
      else null
    end as roas,
    count(distinct b.metric_date)::bigint as days_with_data,
    max(a.canonical_purchase_action_type)::text as purchase_action_type
  from base_rows b
  join public.meta_campaigns c on c.id = b.campaign_id
  join public.meta_ad_accounts a on a.id = b.ad_account_id
  left join purchases_by_campaign p on p.campaign_id = b.campaign_id
  group by b.campaign_id, p.purchases, p.purchase_value
  order by coalesce(sum(b.spend), 0) desc;
$function$;

-- --- 1. Rendimiento por creatividad -----------------------------------------
--
-- La pregunta real del consultor: de todo lo que esta corriendo, que pieza
-- merece que la mire hoy.
--
-- Tres decisiones que hacen que las cifras signifiquen algo:
--
--   * Las tasas de video son NULL, no cero, cuando el anuncio no es de video.
--     Un anuncio de imagen no tiene un hook rate del 0%: no tiene hook rate.
--     Sin esta distincion, ordenar por hook rate entierra los videos buenos
--     debajo de todas las imagenes.
--
--   * Las tasas solo se calculan con volumen suficiente. Un 33% de hold rate
--     sobre tres reproducciones no es un dato, es ruido, y en una tabla
--     ordenada sale primero.
--
--   * El veredicto de subasta es el ULTIMO que dio Meta, no la moda del
--     periodo: es un juicio sobre el estado actual del anuncio, no una
--     media historica.
drop function if exists public.meta_creative_performance(uuid, date, date, uuid, bigint);
create or replace function public.meta_creative_performance(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  min_impressions bigint default 1000
)
returns table(
  ad_id uuid,
  ad_name text,
  ad_set_name text,
  campaign_name text,
  effective_status text,
  spend numeric,
  impressions bigint,
  outbound_clicks bigint,
  outbound_ctr numeric,
  video_plays bigint,
  hook_rate numeric,
  hold_rate numeric,
  thruplay_rate numeric,
  quality_ranking text,
  engagement_rate_ranking text,
  conversion_rate_ranking text,
  purchases numeric,
  purchase_value numeric,
  roas numeric,
  cost_per_purchase numeric,
  purchase_attribution_window text,
  has_video boolean,
  enough_volume boolean,
  days_with_data bigint
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.id, r.ad_id, r.spend, r.impressions, r.metric_date,
      r.outbound_clicks, r.video_plays, r.video_p100_watched, r.video_thruplays,
      r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking,
      r.ad_account_id
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  row_purchases as (
    select distinct on (m.insight_row_id, m.metric_name)
      m.insight_row_id, m.metric_name, m.value, m.attribution_window, b.ad_id
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    join public.meta_ad_accounts a on a.id = b.ad_account_id
    where m.action_type = a.canonical_purchase_action_type
    order by
      m.insight_row_id,
      m.metric_name,
      public.meta_attribution_window_rank(m.attribution_window)
  ),
  purchases_by_ad as (
    select
      ad_id,
      coalesce(sum(value) filter (where metric_name = 'actions'), 0) as purchases,
      coalesce(sum(value) filter (where metric_name = 'action_values'), 0) as purchase_value,
      (array_agg(attribution_window order by
        public.meta_attribution_window_rank(attribution_window)))[1] as attribution_window
    from row_purchases
    group by ad_id
  ),
  -- El veredicto vigente, no el mas frecuente.
  latest_verdict as (
    select distinct on (b.ad_id)
      b.ad_id,
      b.quality_ranking,
      b.engagement_rate_ranking,
      b.conversion_rate_ranking
    from base_rows b
    where b.quality_ranking is not null
       or b.engagement_rate_ranking is not null
       or b.conversion_rate_ranking is not null
    order by b.ad_id, b.metric_date desc
  ),
  totals as (
    select
      b.ad_id,
      sum(b.spend) as spend,
      sum(b.impressions)::bigint as impressions,
      sum(b.outbound_clicks)::bigint as outbound_clicks,
      -- sum() de puros nulos es null, y eso es exactamente lo que queremos:
      -- distingue "no es un video" de "es un video que nadie empezo".
      sum(b.video_plays)::bigint as video_plays,
      sum(b.video_p100_watched)::bigint as video_p100_watched,
      sum(b.video_thruplays)::bigint as video_thruplays,
      count(distinct b.metric_date)::bigint as days_with_data
    from base_rows b
    group by b.ad_id
  )
  select
    t.ad_id,
    d.name::text as ad_name,
    s.name::text as ad_set_name,
    c.name::text as campaign_name,
    d.effective_status::text,
    coalesce(t.spend, 0) as spend,
    coalesce(t.impressions, 0) as impressions,
    t.outbound_clicks,
    case
      when t.impressions >= min_impressions and t.outbound_clicks is not null
      then round(t.outbound_clicks::numeric / t.impressions, 6)
    end as outbound_ctr,
    t.video_plays,
    case
      when t.impressions >= min_impressions and t.video_plays is not null
      then round(t.video_plays::numeric / t.impressions, 6)
    end as hook_rate,
    case
      when t.impressions >= min_impressions and t.video_p100_watched is not null
      then round(t.video_p100_watched::numeric / nullif(t.video_plays, 0), 6)
    end as hold_rate,
    case
      when t.impressions >= min_impressions and t.video_thruplays is not null
      then round(t.video_thruplays::numeric / t.impressions, 6)
    end as thruplay_rate,
    v.quality_ranking::text,
    v.engagement_rate_ranking::text,
    v.conversion_rate_ranking::text,
    coalesce(p.purchases, 0) as purchases,
    coalesce(p.purchase_value, 0) as purchase_value,
    case
      when coalesce(t.spend, 0) > 0
      then round(coalesce(p.purchase_value, 0) / t.spend, 4)
    end as roas,
    case
      when coalesce(p.purchases, 0) > 0
      then round(coalesce(t.spend, 0) / p.purchases, 2)
    end as cost_per_purchase,
    p.attribution_window::text as purchase_attribution_window,
    t.video_plays is not null as has_video,
    coalesce(t.impressions, 0) >= min_impressions as enough_volume,
    t.days_with_data
  from totals t
  join public.meta_ads d on d.id = t.ad_id
  join public.meta_ad_sets s on s.id = d.ad_set_id
  join public.meta_campaigns c on c.id = s.campaign_id
  left join latest_verdict v on v.ad_id = t.ad_id
  left join purchases_by_ad p on p.ad_id = t.ad_id
  order by coalesce(t.spend, 0) desc;
$function$;

-- --- 2. Cuanto dinero hay detras de cada veredicto de Meta -------------------
--
-- No "cuantos anuncios estan por debajo de la media", que no dice nada:
-- cuanto gasto tienen detras. Diez anuncios malos con 20 EUR son ruido; uno
-- malo con el 60% del presupuesto es la reunion del lunes.
--
-- UNKNOWN se queda aparte y no se cuenta como malo: Meta responde eso cuando
-- el anuncio no tiene volumen para juzgarlo, que es una respuesta distinta de
-- "esta por debajo de la media".
drop function if exists public.meta_creative_ranking_distribution(uuid, date, date, uuid);
create or replace function public.meta_creative_ranking_distribution(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  dimension text,
  ranking_value text,
  ads bigint,
  spend numeric,
  spend_share numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with base_rows as (
    select
      r.ad_id, r.spend, r.metric_date,
      r.quality_ranking, r.engagement_rate_ranking, r.conversion_rate_ranking
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = r.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  spend_by_ad as (
    select ad_id, sum(spend) as spend
    from base_rows
    group by ad_id
  ),
  latest_verdict as (
    select distinct on (ad_id)
      ad_id, quality_ranking, engagement_rate_ranking, conversion_rate_ranking
    from base_rows
    where quality_ranking is not null
       or engagement_rate_ranking is not null
       or conversion_rate_ranking is not null
    order by ad_id, metric_date desc
  ),
  spread as (
    select d.dimension, coalesce(d.value, 'SIN_VEREDICTO') as ranking_value, s.spend
    from spend_by_ad s
    left join latest_verdict v on v.ad_id = s.ad_id
    cross join lateral (values
      ('calidad', v.quality_ranking),
      ('interaccion', v.engagement_rate_ranking),
      ('conversion', v.conversion_rate_ranking)
    ) as d(dimension, value)
  ),
  grouped as (
    select
      dimension,
      ranking_value,
      count(*)::bigint as ads,
      coalesce(sum(spend), 0) as spend
    from spread
    group by dimension, ranking_value
  )
  select
    dimension,
    ranking_value,
    ads,
    spend,
    case
      when sum(spend) over (partition by dimension) > 0
      then round(spend / sum(spend) over (partition by dimension), 4)
    end as spend_share
  from grouped
  order by dimension, spend desc;
$function$;

-- --- 3. Fase de aprendizaje --------------------------------------------------
--
-- Un conjunto en aprendizaje entrega peor y es normal que entregue peor. Sin
-- esto, cada reinicio de la fase se lee como una caida de rendimiento y el
-- consultor "arregla" tocando algo, que reinicia la fase otra vez.
--
-- Por eso viene el ultimo cambio significativo al lado: el bucle solo se ve
-- si se ven las dos cosas juntas.
drop function if exists public.meta_learning_phase_status(uuid, date, date, uuid);
create or replace function public.meta_learning_phase_status(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  ad_set_id uuid,
  ad_set_name text,
  campaign_name text,
  effective_status text,
  optimization_goal text,
  learning_stage_status text,
  learning_conversions integer,
  learning_conversions_needed integer,
  conversions_missing integer,
  daily_budget numeric,
  spend_in_period numeric,
  last_significant_change timestamptz,
  days_since_change numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with scoped_sets as (
    select s.*, c.name as campaign_name, c.ad_account_id
    from public.meta_ad_sets s
    join public.meta_campaigns c on c.id = s.campaign_id
    where s.organization_id = target_organization_id
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = c.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  spend_by_set as (
    select r.ad_set_id, sum(r.spend) as spend
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and r.ad_set_id is not null
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
    group by r.ad_set_id
  )
  select
    s.id as ad_set_id,
    s.name::text as ad_set_name,
    s.campaign_name::text,
    s.effective_status::text,
    s.optimization_goal::text,
    s.learning_stage_status::text,
    s.learning_conversions,
    s.learning_conversions_needed,
    case
      when s.learning_conversions_needed is not null
      then greatest(
        s.learning_conversions_needed - coalesce(s.learning_conversions, 0),
        0
      )
    end as conversions_missing,
    s.daily_budget,
    coalesce(sp.spend, 0) as spend_in_period,
    ch.event_time as last_significant_change,
    case
      when ch.event_time is not null
      then round(extract(epoch from (now() - ch.event_time))::numeric / 86400, 1)
    end as days_since_change
  from scoped_sets s
  left join spend_by_set sp on sp.ad_set_id = s.id
  -- Meta reinicia el aprendizaje ante cambios de presupuesto, puja,
  -- segmentacion u objetivo. El registro de cambios no marca cuales resetean,
  -- asi que se toma el ultimo cambio sobre el conjunto y se deja que quien lo
  -- lea juzgue: una fecha real vale mas que una lista adivinada de tipos.
  left join lateral (
    select a.event_time
    from public.meta_account_activities a
    where a.organization_id = target_organization_id
      and a.ad_account_id = s.ad_account_id
      and a.object_external_id = s.external_ad_set_id
    order by a.event_time desc
    limit 1
  ) ch on true
  where s.learning_stage_status is not null
     or coalesce(sp.spend, 0) > 0
  order by coalesce(sp.spend, 0) desc;
$function$;

-- --- 4. Salud del pixel ------------------------------------------------------
--
-- Que el pixel dispare no basta: tiene que disparar el evento que la campaña
-- esta optimizando. Un pixel que sigue mandando PageView pero dejo de mandar
-- Purchase se ve "vivo" en el panel de Meta y deja la optimizacion ciega.
--
-- Por eso la fila es (pixel, evento) y no (pixel), y por eso `days_missing`
-- cuenta dias sin ese evento en concreto: es la forma de que se note el dia
-- que alguien toco el checkout.
--
-- Un pixel sin ninguna estadistica aparece igual, con event_name nulo. Es el
-- caso mas grave y seria el unico que un inner join escondería.
drop function if exists public.meta_pixel_health(uuid, date, date, uuid);
create or replace function public.meta_pixel_health(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  pixel_id uuid,
  pixel_name text,
  external_pixel_id text,
  is_unavailable boolean,
  last_fired_at timestamptz,
  hours_since_last_fire numeric,
  event_name text,
  events_total bigint,
  days_with_events bigint,
  days_in_period integer,
  days_missing integer,
  last_event_date date,
  avg_daily_events numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with scoped_pixels as (
    select p.id, p.name, p.external_pixel_id, p.is_unavailable, p.last_fired_at
    from public.meta_pixels p
    where p.organization_id = target_organization_id
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = p.ad_account_id and sa.store_id = target_store_id
      ))
  ),
  stats as (
    select
      s.pixel_id,
      s.event_name,
      sum(s.event_count)::bigint as events_total,
      count(distinct s.metric_date)::bigint as days_with_events,
      max(s.metric_date) as last_event_date
    from public.meta_pixel_daily_stats s
    join scoped_pixels p on p.id = s.pixel_id
    where (period_start is null or s.metric_date >= period_start)
      and s.metric_date <= period_end
    group by s.pixel_id, s.event_name
  )
  select
    p.id as pixel_id,
    p.name::text as pixel_name,
    p.external_pixel_id::text,
    p.is_unavailable,
    p.last_fired_at,
    case
      when p.last_fired_at is not null
      then round(extract(epoch from (now() - p.last_fired_at))::numeric / 3600, 1)
    end as hours_since_last_fire,
    st.event_name::text,
    coalesce(st.events_total, 0) as events_total,
    coalesce(st.days_with_events, 0) as days_with_events,
    (period_end - coalesce(period_start, period_end) + 1) as days_in_period,
    (
      (period_end - coalesce(period_start, period_end) + 1)
      - coalesce(st.days_with_events, 0)
    )::integer as days_missing,
    st.last_event_date,
    case
      when coalesce(st.days_with_events, 0) > 0
      then round(st.events_total::numeric / st.days_with_events, 1)
    end as avg_daily_events
  from scoped_pixels p
  left join stats st on st.pixel_id = p.id
  order by p.name, coalesce(st.events_total, 0) desc;
$function$;

-- --- 5. Publicos -------------------------------------------------------------
--
-- La cuenta tipica acumula decenas de publicos y usa cuatro. El resto son
-- ruido en el selector y, si son antiguos, gente que ya no existe.
--
-- `ad_sets_using` cruza el id del publico contra el targeting guardado. Se usa
-- jsonb_path_exists con comodin recursivo en vez de leer una clave concreta
-- porque Meta mete los publicos en sitios distintos segun el tipo de conjunto
-- (custom_audiences, excluded_custom_audiences, dentro de flexible_spec...).
-- Contrapartida honesta: NO distingue incluido de excluido. Dice "este publico
-- aparece en el targeting de N conjuntos", que ya es la diferencia entre un
-- publico vivo y uno olvidado.
drop function if exists public.meta_audience_overview(uuid, uuid);
create or replace function public.meta_audience_overview(
  target_organization_id uuid,
  target_store_id uuid default null
)
returns table(
  audience_id uuid,
  audience_name text,
  subtype text,
  approximate_count_lower bigint,
  approximate_count_upper bigint,
  retention_days integer,
  is_lookalike boolean,
  lookalike_ratio numeric,
  lookalike_country text,
  origin_name text,
  delivery_status_code integer,
  delivery_status_description text,
  ad_sets_using bigint,
  external_updated_at timestamptz
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with scoped as (
    select a.*
    from public.meta_custom_audiences a
    where a.organization_id = target_organization_id
      and (target_store_id is null or exists (
        select 1 from public.meta_ad_accounts sa
        where sa.id = a.ad_account_id and sa.store_id = target_store_id
      ))
  )
  select
    a.id as audience_id,
    a.name::text as audience_name,
    a.subtype::text,
    a.approximate_count_lower,
    a.approximate_count_upper,
    a.retention_days,
    a.is_lookalike,
    a.lookalike_ratio,
    a.lookalike_country::text,
    origin.name::text as origin_name,
    -- Meta documenta `code` como entero, pero el cast directo tumbaria la
    -- funcion entera si algun dia manda otra cosa. Aqui un valor raro es un
    -- nulo, no una excepcion.
    case
      when a.delivery_status->>'code' ~ '^[0-9]+$'
      then (a.delivery_status->>'code')::integer
    end as delivery_status_code,
    (a.delivery_status->>'description')::text as delivery_status_description,
    (
      select count(*)
      from public.meta_ad_sets s
      where s.organization_id = target_organization_id
        and coalesce(
          jsonb_path_exists(
            s.targeting_data,
            '$.**.id ? (@ == $aid)',
            jsonb_build_object('aid', a.external_audience_id)
          ),
          false
        )
    )::bigint as ad_sets_using,
    a.external_updated_at
  from scoped a
  left join scoped origin
    on origin.external_audience_id = a.lookalike_origin_external_id
  order by a.is_lookalike, a.name;
$function$;

-- --- 6. Que paso despues de cada cambio --------------------------------------
--
-- La funcion que justifica haber traido el registro de cambios. Para cada
-- cambio de la cuenta compara la ventana anterior con la posterior sobre la
-- MISMA entidad: "subiste el presupuesto de este conjunto el dia 12 y el CPA
-- subio un 40%".
--
-- Tres cosas que la hacen honesta y no un grafico bonito:
--
--   * El dia del cambio se excluye de las dos ventanas. Es mitad viejo y
--     mitad nuevo; meterlo en cualquiera de los dos lados ensucia los dos.
--
--   * La fecha del cambio se calcula en el huso de la cuenta, no en UTC. Las
--     filas diarias de Meta vienen en el huso de la cuenta: comparar contra un
--     dia UTC desplaza la frontera y mete horas del lado equivocado.
--
--   * Solo salen los cambios con datos a ambos lados y con gasto por encima
--     de `min_spend`. Una comparacion con dos dias sueltos no es una senal,
--     y sin el umbral la lista se llena de cambios sobre conjuntos parados.
--
-- No es causalidad: es coincidencia temporal, que es lo que un consultor
-- necesita para saber donde mirar.
drop function if exists public.meta_change_impact(uuid, date, date, uuid, integer, numeric);
create or replace function public.meta_change_impact(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null,
  window_days integer default 7,
  min_spend numeric default 50
)
returns table(
  event_time timestamptz,
  event_type text,
  translated_event_type text,
  actor_name text,
  object_name text,
  entity_level text,
  spend_before numeric,
  spend_after numeric,
  purchases_before numeric,
  purchases_after numeric,
  purchase_value_before numeric,
  purchase_value_after numeric,
  roas_before numeric,
  roas_after numeric,
  cpa_before numeric,
  cpa_after numeric,
  roas_delta_pct numeric,
  days_before bigint,
  days_after bigint,
  purchase_attribution_window text
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with day_rows as (
    select
      r.metric_date,
      r.campaign_id,
      r.ad_set_id,
      r.ad_id,
      r.spend,
      coalesce(pm.purchases, 0) as purchases,
      coalesce(pm.purchase_value, 0) as purchase_value,
      pm.attribution_window
    from public.meta_insight_rows_daily r
    join public.meta_ad_accounts a on a.id = r.ad_account_id
    -- Una ventana de atribucion por fila, elegida por la misma politica que
    -- el resto del modulo.
    left join lateral (
      select
        sum(x.value) filter (where x.metric_name = 'actions') as purchases,
        sum(x.value) filter (where x.metric_name = 'action_values') as purchase_value,
        (array_agg(x.attribution_window order by
          public.meta_attribution_window_rank(x.attribution_window)))[1] as attribution_window
      from (
        select distinct on (m.metric_name)
          m.metric_name, m.value, m.attribution_window
        from public.meta_insight_action_metrics m
        where m.insight_row_id = r.id
          and m.action_type = a.canonical_purchase_action_type
        order by m.metric_name, public.meta_attribution_window_rank(m.attribution_window)
      ) x
    ) pm on true
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start - window_days)
      and r.metric_date <= period_end + window_days
      and (target_store_id is null or a.store_id = target_store_id)
  ),
  changes as (
    select
      act.event_time,
      act.event_type,
      act.translated_event_type,
      act.actor_name,
      act.object_name,
      act.object_external_id,
      act.ad_account_id,
      (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date as event_date
    from public.meta_account_activities act
    join public.meta_ad_accounts acc on acc.id = act.ad_account_id
    where act.organization_id = target_organization_id
      and act.object_external_id <> ''
      and (period_start is null
        or (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date >= period_start)
      and (act.event_time at time zone coalesce(acc.timezone_name, 'UTC'))::date <= period_end
      and (target_store_id is null or acc.store_id = target_store_id)
  ),
  -- El registro de cambios da el id externo del objeto sin decir de que nivel
  -- es. Se resuelve contra los tres, y lo que no case con ninguno se cae: un
  -- cambio sobre algo que ya no existe no se puede medir.
  resolved as (
    select c.*, 'campaign'::text as entity_level, e.id as entity_id
    from changes c
    join public.meta_campaigns e
      on e.ad_account_id = c.ad_account_id
     and e.external_campaign_id = c.object_external_id
    union all
    select c.*, 'adset'::text, s.id
    from changes c
    join public.meta_ad_sets s
      on s.organization_id = target_organization_id
     and s.external_ad_set_id = c.object_external_id
    union all
    select c.*, 'ad'::text, d.id
    from changes c
    join public.meta_ads d
      on d.organization_id = target_organization_id
     and d.external_ad_id = c.object_external_id
  )
  select
    r.event_time,
    r.event_type::text,
    r.translated_event_type::text,
    r.actor_name::text,
    r.object_name::text,
    r.entity_level,
    w.spend_before,
    w.spend_after,
    w.purchases_before,
    w.purchases_after,
    w.value_before as purchase_value_before,
    w.value_after as purchase_value_after,
    k.roas_before,
    k.roas_after,
    k.cpa_before,
    k.cpa_after,
    case
      when k.roas_before > 0
      then round((k.roas_after - k.roas_before) / k.roas_before * 100, 1)
    end as roas_delta_pct,
    w.days_before,
    w.days_after,
    w.attribution_window::text as purchase_attribution_window
  from resolved r
  cross join lateral (
    select
      coalesce(sum(dr.spend) filter (where dr.metric_date < r.event_date), 0) as spend_before,
      coalesce(sum(dr.spend) filter (where dr.metric_date > r.event_date), 0) as spend_after,
      coalesce(sum(dr.purchases) filter (where dr.metric_date < r.event_date), 0) as purchases_before,
      coalesce(sum(dr.purchases) filter (where dr.metric_date > r.event_date), 0) as purchases_after,
      coalesce(sum(dr.purchase_value) filter (where dr.metric_date < r.event_date), 0) as value_before,
      coalesce(sum(dr.purchase_value) filter (where dr.metric_date > r.event_date), 0) as value_after,
      count(distinct dr.metric_date) filter (where dr.metric_date < r.event_date) as days_before,
      count(distinct dr.metric_date) filter (where dr.metric_date > r.event_date) as days_after,
      (array_agg(dr.attribution_window) filter (where dr.attribution_window is not null))[1] as attribution_window
    from day_rows dr
    where dr.metric_date >= r.event_date - window_days
      and dr.metric_date <= r.event_date + window_days
      and dr.metric_date <> r.event_date
      and (
        (r.entity_level = 'campaign' and dr.campaign_id = r.entity_id)
        or (r.entity_level = 'adset' and dr.ad_set_id = r.entity_id)
        or (r.entity_level = 'ad' and dr.ad_id = r.entity_id)
      )
  ) w
  cross join lateral (
    select
      case when w.spend_before > 0 then round(w.value_before / w.spend_before, 4) end as roas_before,
      case when w.spend_after > 0 then round(w.value_after / w.spend_after, 4) end as roas_after,
      case when w.purchases_before > 0 then round(w.spend_before / w.purchases_before, 2) end as cpa_before,
      case when w.purchases_after > 0 then round(w.spend_after / w.purchases_after, 2) end as cpa_after
  ) k
  where w.days_before > 0
    and w.days_after > 0
    and w.spend_before + w.spend_after >= min_spend
  order by r.event_time desc;
$function$;

-- --- Permisos ----------------------------------------------------------------
--
-- Ninguna es security definer: la RLS de las tablas (private.can_access_org)
-- se evalua con el usuario que llama, que es justo lo que queremos.

grant execute on function public.meta_attribution_window_rank(text) to authenticated;
grant execute on function public.meta_creative_performance(uuid, date, date, uuid, bigint) to authenticated;
grant execute on function public.meta_creative_ranking_distribution(uuid, date, date, uuid) to authenticated;
grant execute on function public.meta_learning_phase_status(uuid, date, date, uuid) to authenticated;
grant execute on function public.meta_pixel_health(uuid, date, date, uuid) to authenticated;
grant execute on function public.meta_audience_overview(uuid, uuid) to authenticated;
grant execute on function public.meta_change_impact(uuid, date, date, uuid, integer, numeric) to authenticated;
