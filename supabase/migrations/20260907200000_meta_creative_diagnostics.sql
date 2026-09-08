-- Meta Ads: lo que falta para poder decidir sobre una cuenta, no solo mirarla.
--
-- Hoy el modulo guarda gasto, impresiones, clics y compras. Con eso se sabe
-- CUANTO se gasto y CUANTO entro, pero no POR QUE: ni si el video engancha, ni
-- si el anuncio compite en su subasta, ni si el conjunto llego a salir de
-- aprendizaje, ni si el pixel sigue vivo, ni quien toco el presupuesto.
--
-- ADR-0006: upsert in-place con unique por id externo, RLS de solo lectura para
-- `authenticated`, e indices que calzan con el predicado de fecha que van a
-- usar las metricas. Las escrituras van con service role tras comprobar
-- membership a mano (pto 7).
--
-- Los desgloses nuevos (edad, genero, pais, hora) NO llevan columna propia: van
-- en el `breakdowns` jsonb que la tabla ya tiene, porque Meta no deja pedirlos
-- todos juntos y cada corte es una peticion distinta con su `breakdown_hash`.
-- Seis columnas casi siempre nulas describirian peor esa realidad.

-- --- Resultados: video, calidad de subasta y clics reales ------------------

alter table public.meta_insight_rows_daily
  -- La curva de abandono del video. El "hook rate" (3 s sobre impresiones) y el
  -- "hold rate" (100% sobre 3 s) salen de aqui, y en una cuenta madura explican
  -- mas varianza que la segmentacion.
  add column if not exists video_plays bigint,
  add column if not exists video_p25_watched bigint,
  add column if not exists video_p50_watched bigint,
  add column if not exists video_p75_watched bigint,
  add column if not exists video_p95_watched bigint,
  add column if not exists video_p100_watched bigint,
  -- ThruPlay es la metrica con la que Meta optimiza. No tenerla es no ver lo
  -- que ve el algoritmo al decidir a quien enseñar el anuncio.
  add column if not exists video_thruplays bigint,
  add column if not exists video_avg_time_watched_seconds numeric(10,2),
  add column if not exists cost_per_thruplay numeric(14,4),
  -- Los tres rankings que Meta calcula gratis y que dicen, en una palabra, si
  -- este anuncio compite o esta pagando de mas por existir.
  add column if not exists quality_ranking varchar(40),
  add column if not exists engagement_rate_ranking varchar(40),
  add column if not exists conversion_rate_ranking varchar(40),
  -- Clics que de verdad salen a la web, frente a los que se quedan dentro de
  -- Meta (expandir el texto, ver el perfil). La diferencia entre los dos es
  -- una de las fugas mas caras y hoy no se puede ver.
  add column if not exists outbound_clicks_ctr numeric(10,6),
  add column if not exists unique_inline_link_clicks bigint,
  add column if not exists inline_link_click_ctr numeric(10,6),
  add column if not exists cost_per_inline_link_click numeric(14,4),
  -- Marca / cobertura.
  add column if not exists estimated_ad_recallers bigint,
  add column if not exists estimated_ad_recall_rate numeric(10,6),
  add column if not exists full_view_impressions bigint,
  add column if not exists full_view_reach bigint,
  -- La ventana con la que Meta atribuyo ESTA fila. Sin ella, comparar dos
  -- conjuntos con ventanas distintas es comparar dos cosas diferentes y no
  -- hay forma de saberlo (ADR-0021).
  add column if not exists attribution_setting varchar(60);

-- Las metricas de creatividad piden siempre "los anuncios con video de esta
-- ventana": el indice parcial evita recorrer las filas sin video, que son la
-- mayoria en una cuenta que tambien hace imagen.
create index if not exists meta_insight_rows_video_idx on public.meta_insight_rows_daily (organization_id, metric_date desc)
  where video_plays is not null;

-- El ranking se consulta como "dame lo que Meta marca por debajo de la media".
create index if not exists meta_insight_rows_quality_idx on public.meta_insight_rows_daily (organization_id, quality_ranking)
  where quality_ranking is not null;

-- --- Aprendizaje del conjunto ---------------------------------------------
--
-- Estado actual, no historico: upsert in-place como el resto de la estructura.
-- Un conjunto en `LEARNING_LIMITED` gasta sin llegar a estabilizarse nunca, y
-- es el diagnostico mas accionable que da Meta.

alter table public.meta_ad_sets
  add column if not exists learning_stage_status varchar(40),
  add column if not exists learning_stage_exit_reason varchar(60),
  add column if not exists learning_conversions integer,
  add column if not exists learning_conversions_needed integer;

create index if not exists meta_ad_sets_learning_idx on public.meta_ad_sets (organization_id, learning_stage_status)
  where learning_stage_status is not null;

-- --- Cuenta: como se paga ---------------------------------------------------

alter table public.meta_ad_accounts
  -- Una tarjeta rechazada corta la cuenta entera y desde la plataforma se ve
  -- igual que un anuncio que dejo de funcionar.
  add column if not exists funding_source_details jsonb,
  add column if not exists business_country_code varchar(2),
  add column if not exists has_accepted_terms boolean;

-- --- Pixel ------------------------------------------------------------------
--
-- Es lo que dice si la atribucion sigue viva. Un pixel caido se ve exactamente
-- igual que una mala campaña: gasto que entra, compras que no.

create table if not exists public.meta_pixels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  external_pixel_id varchar(255) not null,
  name varchar(255),
  -- El instante que importa: si esto lleva horas parado, nada de lo que diga
  -- Meta sobre conversiones de hoy es fiable.
  last_fired_at timestamptz,
  is_unavailable boolean,
  data_use_setting varchar(40),
  enable_automatic_matching boolean,
  first_party_cookie_status varchar(40),
  external_created_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_pixels_unique_external unique (ad_account_id, external_pixel_id)
);

-- Cobertura por evento y dia: no basta con que el pixel dispare, tiene que
-- disparar los eventos que la campaña esta optimizando.
create table if not exists public.meta_pixel_daily_stats (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  pixel_id uuid not null references public.meta_pixels (id) on delete cascade,
  metric_date date not null,
  event_name varchar(120) not null,
  event_count bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_pixel_daily_stats_unique unique (pixel_id, metric_date, event_name)
);

create index if not exists meta_pixels_organization_id_idx on public.meta_pixels (organization_id);
create index if not exists meta_pixel_daily_stats_organization_id_idx on public.meta_pixel_daily_stats (organization_id);
create index if not exists meta_pixel_daily_stats_date_idx on public.meta_pixel_daily_stats (organization_id, metric_date desc);

-- --- Publicos ---------------------------------------------------------------
--
-- La materia prima de escalar: a quien se le vuelve a hablar y a quien se
-- parece. Un publico de retargeting que se quedo pequeño deja de entregar sin
-- avisar, y un similar construido sobre 200 compradores no es el mismo animal
-- que uno sobre 5.000.

create table if not exists public.meta_custom_audiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  external_audience_id varchar(255) not null,
  name varchar(255),
  description text,
  subtype varchar(60),
  -- Meta da el tamaño como una horquilla, nunca como un numero exacto: se
  -- guardan los dos extremos para no aparentar una precision que no existe.
  approximate_count_lower bigint,
  approximate_count_upper bigint,
  retention_days integer,
  operation_status jsonb,
  delivery_status jsonb,
  data_source jsonb,
  is_lookalike boolean not null default false,
  lookalike_origin_external_id varchar(255),
  lookalike_ratio numeric(6,4),
  lookalike_country varchar(2),
  external_created_at timestamptz,
  external_updated_at timestamptz,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_custom_audiences_unique_external unique (ad_account_id, external_audience_id)
);

create index if not exists meta_custom_audiences_organization_id_idx on public.meta_custom_audiences (organization_id);
-- "Que similares tengo y sobre que estan construidos" es la consulta util.
create index if not exists meta_custom_audiences_lookalike_idx on public.meta_custom_audiences (organization_id, lookalike_origin_external_id)
  where is_lookalike;

-- --- Registro de cambios ----------------------------------------------------
--
-- Convierte "cayo el rendimiento el dia 14" en "alguien subio el presupuesto un
-- 300% el dia 13". Es la tabla que mas veces evita culpar al algoritmo.

create table if not exists public.meta_account_activities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  -- Meta no da un id estable por actividad: la clave natural es el instante mas
  -- quien lo hizo, sobre que objeto y de que tipo. Sin esto, cada sync
  -- duplicaria el historial entero.
  event_time timestamptz not null,
  event_type varchar(120) not null,
  translated_event_type varchar(255),
  -- Vacio en vez de null: un `unique` de tabla no admite expresiones, y con
  -- nulos dentro la clave dejaria de deduplicar justo en las actividades sin
  -- actor u objeto identificado. El vacio es un valor, y aqui significa
  -- "Meta no lo dijo".
  actor_id varchar(255) not null default '',
  actor_name varchar(255),
  object_type varchar(60),
  object_external_id varchar(255) not null default '',
  object_name varchar(255),
  extra_data jsonb,
  created_at timestamptz not null default now(),
  constraint meta_account_activities_unique unique (
    ad_account_id, event_time, event_type, object_external_id, actor_id
  )
);

create index if not exists meta_account_activities_organization_id_idx on public.meta_account_activities (organization_id);
-- Siempre se lee como "que se toco en esta ventana", de lo mas reciente atras.
create index if not exists meta_account_activities_time_idx on public.meta_account_activities (organization_id, event_time desc);

-- --- Problemas y recomendaciones -------------------------------------------
--
-- Un anuncio rechazado deja de gastar y desde las cifras se ve igual que un
-- anuncio que dejo de funcionar. `meta_ads.review_feedback` ya existia como
-- columna y nadie la pedia; esto es el detalle, que puede ser mas de uno.

create table if not exists public.meta_ad_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_id uuid not null references public.meta_ads (id) on delete cascade,
  level varchar(40),
  -- La clave es (anuncio, codigo): un anuncio no acumula dos problemas del
  -- mismo codigo, y el resumen es texto libre que no cabe en un indice btree.
  error_code integer not null default 0,
  error_type varchar(80),
  error_summary text,
  error_message text,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint meta_ad_issues_unique unique (ad_id, error_code)
);

create index if not exists meta_ad_issues_organization_id_idx on public.meta_ad_issues (organization_id);
create index if not exists meta_ad_issues_ad_id_idx on public.meta_ad_issues (ad_id);

-- Lo que la propia plataforma sugiere para esa campaña, conjunto o anuncio, ya
-- calculado por Meta. Vale como segunda opinion, no como orden: se guarda para
-- que el consultor la vea, no para aplicarla.
create table if not exists public.meta_recommendations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  entity_level varchar(20) not null,
  entity_external_id varchar(255) not null,
  code integer not null default 0,
  title text,
  message text,
  confidence varchar(40),
  importance varchar(40),
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint meta_recommendations_unique unique (
    ad_account_id, entity_level, entity_external_id, code
  ),
  constraint meta_recommendations_level check (
    entity_level in ('campaign', 'adset', 'ad', 'account')
  )
);

create index if not exists meta_recommendations_organization_id_idx on public.meta_recommendations (organization_id);
create index if not exists meta_recommendations_entity_idx on public.meta_recommendations (organization_id, entity_level, entity_external_id);

-- --- updated_at -------------------------------------------------------------

drop trigger if exists set_meta_pixels_updated_at on public.meta_pixels;
create trigger set_meta_pixels_updated_at
before update on public.meta_pixels
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_pixel_daily_stats_updated_at on public.meta_pixel_daily_stats;
create trigger set_meta_pixel_daily_stats_updated_at
before update on public.meta_pixel_daily_stats
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_custom_audiences_updated_at on public.meta_custom_audiences;
create trigger set_meta_custom_audiences_updated_at
before update on public.meta_custom_audiences
for each row execute function private.set_updated_at();

-- --- RLS --------------------------------------------------------------------

alter table public.meta_pixels enable row level security;
alter table public.meta_pixel_daily_stats enable row level security;
alter table public.meta_custom_audiences enable row level security;
alter table public.meta_account_activities enable row level security;
alter table public.meta_ad_issues enable row level security;
alter table public.meta_recommendations enable row level security;

drop policy if exists "meta_pixels_select_authorized" on public.meta_pixels;
create policy "meta_pixels_select_authorized" on public.meta_pixels for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_pixel_daily_stats_select_authorized" on public.meta_pixel_daily_stats;
create policy "meta_pixel_daily_stats_select_authorized" on public.meta_pixel_daily_stats for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_custom_audiences_select_authorized" on public.meta_custom_audiences;
create policy "meta_custom_audiences_select_authorized" on public.meta_custom_audiences for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_account_activities_select_authorized" on public.meta_account_activities;
create policy "meta_account_activities_select_authorized" on public.meta_account_activities for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_ad_issues_select_authorized" on public.meta_ad_issues;
create policy "meta_ad_issues_select_authorized" on public.meta_ad_issues for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_recommendations_select_authorized" on public.meta_recommendations;
create policy "meta_recommendations_select_authorized" on public.meta_recommendations for select to authenticated
using (private.can_access_org(organization_id));

grant select on public.meta_pixels to authenticated;
grant select on public.meta_pixel_daily_stats to authenticated;
grant select on public.meta_custom_audiences to authenticated;
grant select on public.meta_account_activities to authenticated;
grant select on public.meta_ad_issues to authenticated;
grant select on public.meta_recommendations to authenticated;

comment on column public.meta_insight_rows_daily.attribution_setting is
  'Ventana con la que Meta atribuyo esta fila. Dos conjuntos con ventanas distintas no son comparables (ADR-0021).';
comment on column public.meta_ad_sets.learning_stage_status is
  'LEARNING, SUCCESS o LEARNING_LIMITED. Un conjunto en LEARNING_LIMITED gasta sin llegar a estabilizarse.';
