-- Convergencia del modulo Klaviyo: desarrollo pasa a la forma que tiene
-- produccion, que es la que el codigo sabe leer y escribir.
--
-- Contexto (2026-09-11). Al crear el proyecto de desarrollo desde cero se vio
-- que 16 tablas de Klaviyo tienen dos formas distintas: la de los ficheros de
-- migracion y la de produccion. El fichero de fundacion se edito DESPUES de
-- crear produccion y, como `create table` no es idempotente, `db:push` nunca
-- reaplico nada: los dos historiales coinciden, los dos esquemas no.
--
-- Manda produccion, y no por antiguedad: es la forma que usa el codigo. El
-- sync escribe `created_at_external` (klaviyo-sync.ts:476 y :493) y los
-- ficheros declaran `external_created_at`; escribe en klaviyo_report_runs
-- exactamente las columnas de produccion (:1327). Dicho de otro modo: el sync
-- de Klaviyo NO funciona contra una base construida desde los ficheros. Eso es
-- lo que se arregla aqui.
--
-- Cada columna que se borra se comprobo una a una contra apps/api, apps/web y
-- packages: ninguna aparece en el codigo. Son restos de un diseño que nunca se
-- construyo (statistic_name/dimension_hash, metricas diarias calculadas,
-- punteros de audiencia...).
--
-- Sobre produccion es un no-op: los `add`/`drop` llevan `if [not] exists` y los
-- cambios de tipo, nulabilidad y default van dentro de un `if` que comprueba el
-- estado actual, para no provocar reescrituras de tabla innecesarias.

-- klaviyo_accounts
alter table public.klaviyo_accounts
  drop column if exists account_name,
  drop column if exists default_currency,
  drop column if exists public_api_key,
  drop column if exists api_revision,
  drop column if exists is_active;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_accounts' and column_name='conversion_metric_source') <> 'character varying' then
    alter table public.klaviyo_accounts alter column conversion_metric_source type varchar(40) using conversion_metric_source::text::varchar(40);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_accounts' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_accounts alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_accounts' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_accounts alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_campaign_audiences
alter table public.klaviyo_campaign_audiences
  add column if not exists name varchar(255);

alter table public.klaviyo_campaign_audiences
  drop column if exists audience_role,
  drop column if exists list_id,
  drop column if exists segment_id,
  drop column if exists priority,
  drop column if exists created_at,
  drop column if exists updated_at;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_audiences' and column_name='audience_type') <> 'character varying' then
    alter table public.klaviyo_campaign_audiences alter column audience_type type varchar(30) using audience_type::text::varchar(30);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_audiences' and column_name='external_audience_id') = 'YES' then
    alter table public.klaviyo_campaign_audiences alter column external_audience_id set not null;
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_audiences' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_campaign_audiences alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_audiences' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_campaign_audiences alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_campaign_messages
do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_messages' and column_name='channel') <> 'character varying' then
    alter table public.klaviyo_campaign_messages alter column channel type varchar(40) using channel::text::varchar(40);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_messages' and column_name='channel') = 'NO' then
    alter table public.klaviyo_campaign_messages alter column channel drop not null;
  end if;
end
$do$;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_messages' and column_name='status') <> 'character varying' then
    alter table public.klaviyo_campaign_messages alter column status type varchar(60) using status::text::varchar(60);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_messages' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_campaign_messages alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_campaign_messages' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_campaign_messages alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_campaigns
alter table public.klaviyo_campaigns
  add column if not exists created_at_external timestamp with time zone,
  add column if not exists updated_at_external timestamp with time zone;

alter table public.klaviyo_campaigns
  drop column if exists archived,
  drop column if exists primary_channel,
  drop column if exists scheduled_at,
  drop column if exists send_strategy,
  drop column if exists send_options,
  drop column if exists tracking_options,
  drop column if exists external_created_at,
  drop column if exists external_updated_at;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_campaigns' and column_name='status') <> 'character varying' then
    alter table public.klaviyo_campaigns alter column status type varchar(60) using status::text::varchar(60);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_campaigns' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_campaigns alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_campaigns' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_campaigns alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_daily_account_metrics
alter table public.klaviyo_daily_account_metrics
  add column if not exists metric_id varchar(255),
  add column if not exists metric_name varchar(255),
  add column if not exists value numeric,
  add column if not exists currency_code varchar(3),
  add column if not exists source varchar(20) default 'reporting_api'::character varying,
  add column if not exists raw_data jsonb default '{}'::jsonb,
  add column if not exists created_at timestamp with time zone default now();

alter table public.klaviyo_daily_account_metrics
  drop column if exists conversion_metric_id,
  drop column if exists channel,
  drop column if exists flow_attributed_revenue,
  drop column if exists campaign_attributed_revenue,
  drop column if exists total_attributed_revenue,
  drop column if exists total_store_revenue,
  drop column if exists attributed_revenue_percentage,
  drop column if exists recipients,
  drop column if exists delivered,
  drop column if exists opens,
  drop column if exists clicks,
  drop column if exists conversions,
  drop column if exists calculation_version,
  drop column if exists calculated_at;

-- klaviyo_flow_actions
do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_actions' and column_name='action_type') <> 'character varying' then
    alter table public.klaviyo_flow_actions alter column action_type type varchar(80) using action_type::text::varchar(80);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_actions' and column_name='action_type') = 'NO' then
    alter table public.klaviyo_flow_actions alter column action_type drop not null;
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_actions' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_flow_actions alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_actions' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_flow_actions alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_flow_messages
alter table public.klaviyo_flow_messages
  drop column if exists flow_action_id;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_messages' and column_name='flow_id') = 'YES' then
    alter table public.klaviyo_flow_messages alter column flow_id set not null;
  end if;
end
$do$;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_messages' and column_name='channel') <> 'character varying' then
    alter table public.klaviyo_flow_messages alter column channel type varchar(40) using channel::text::varchar(40);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_messages' and column_name='channel') = 'NO' then
    alter table public.klaviyo_flow_messages alter column channel drop not null;
  end if;
end
$do$;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_messages' and column_name='status') <> 'character varying' then
    alter table public.klaviyo_flow_messages alter column status type varchar(60) using status::text::varchar(60);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_messages' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_flow_messages alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_flow_messages' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_flow_messages alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_flows
alter table public.klaviyo_flows
  add column if not exists created_at_external timestamp with time zone,
  add column if not exists updated_at_external timestamp with time zone;

alter table public.klaviyo_flows
  drop column if exists archived,
  drop column if exists definition_hash,
  drop column if exists external_created_at,
  drop column if exists external_updated_at;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_flows' and column_name='status') <> 'character varying' then
    alter table public.klaviyo_flows alter column status type varchar(60) using status::text::varchar(60);
  end if;
end
$do$;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_flows' and column_name='trigger_type') <> 'character varying' then
    alter table public.klaviyo_flows alter column trigger_type type varchar(120) using trigger_type::text::varchar(120);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_flows' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_flows alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_flows' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_flows alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_forms
alter table public.klaviyo_forms
  drop column if exists has_ab_test,
  drop column if exists external_created_at,
  drop column if exists external_updated_at;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_forms' and column_name='status') <> 'character varying' then
    alter table public.klaviyo_forms alter column status type varchar(60) using status::text::varchar(60);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_forms' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_forms alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_forms' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_forms alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_list_daily_snapshots
alter table public.klaviyo_list_daily_snapshots
  add column if not exists source varchar(20) default 'live'::character varying,
  add column if not exists created_at timestamp with time zone default now();

alter table public.klaviyo_list_daily_snapshots
  drop column if exists captured_at;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_list_daily_snapshots' and column_name='profile_count') <> 'integer' then
    alter table public.klaviyo_list_daily_snapshots alter column profile_count type integer using profile_count::text::integer;
  end if;
end
$do$;

-- klaviyo_lists
alter table public.klaviyo_lists
  add column if not exists profile_count integer;

alter table public.klaviyo_lists
  drop column if exists external_created_at,
  drop column if exists external_updated_at;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_lists' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_lists alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_lists' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_lists alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_metrics
alter table public.klaviyo_metrics
  add column if not exists metric_type varchar(80),
  add column if not exists last_synced_at timestamp with time zone;

alter table public.klaviyo_metrics
  drop column if exists external_integration_id,
  drop column if exists integration_name,
  drop column if exists integration_category,
  drop column if exists is_primary_conversion_metric,
  drop column if exists external_created_at,
  drop column if exists external_updated_at,
  drop column if exists created_at;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_metrics' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_metrics alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_metrics' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_metrics alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_report_runs
alter table public.klaviyo_report_runs
  drop column if exists sync_run_id,
  drop column if exists entity_type,
  drop column if exists conversion_metric_id,
  drop column if exists statistics,
  drop column if exists timeframe_start,
  drop column if exists timeframe_end,
  drop column if exists interval,
  drop column if exists channel,
  drop column if exists filters,
  drop column if exists request_data,
  drop column if exists api_revision,
  drop column if exists error_code,
  drop column if exists requested_at,
  drop column if exists completed_at;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='report_type') <> 'character varying' then
    alter table public.klaviyo_report_runs alter column report_type type varchar(60) using report_type::text::varchar(60);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='period_start') = 'YES' then
    alter table public.klaviyo_report_runs alter column period_start set not null;
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='period_end') = 'YES' then
    alter table public.klaviyo_report_runs alter column period_end set not null;
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='timezone') = 'YES' then
    alter table public.klaviyo_report_runs alter column timezone set not null;
  end if;
end
$do$;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='status') <> 'character varying' then
    alter table public.klaviyo_report_runs alter column status type varchar(40) using status::text::varchar(40);
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='status') is distinct from '''running''::character varying' then
    alter table public.klaviyo_report_runs alter column status set default 'running'::character varying;
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='idempotency_key') = 'YES' then
    alter table public.klaviyo_report_runs alter column idempotency_key set not null;
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='started_at') = 'YES' then
    alter table public.klaviyo_report_runs alter column started_at set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_report_runs' and column_name='started_at') is distinct from 'now()' then
    alter table public.klaviyo_report_runs alter column started_at set default now();
  end if;
end
$do$;

-- klaviyo_report_values
do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_report_values' and column_name='entity_type') <> 'character varying' then
    alter table public.klaviyo_report_values alter column entity_type type varchar(40) using entity_type::text::varchar(40);
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_report_values' and column_name='metric_id') = 'YES' then
    alter table public.klaviyo_report_values alter column metric_id set not null;
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_report_values' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_report_values alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_report_values' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_report_values alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- klaviyo_segment_daily_snapshots
alter table public.klaviyo_segment_daily_snapshots
  add column if not exists source varchar(20) default 'live'::character varying,
  add column if not exists created_at timestamp with time zone default now();

alter table public.klaviyo_segment_daily_snapshots
  drop column if exists captured_at;

do $do$
begin
  if (select data_type from information_schema.columns where table_schema='public' and table_name='klaviyo_segment_daily_snapshots' and column_name='profile_count') <> 'integer' then
    alter table public.klaviyo_segment_daily_snapshots alter column profile_count type integer using profile_count::text::integer;
  end if;
end
$do$;

-- klaviyo_segments
alter table public.klaviyo_segments
  add column if not exists profile_count integer;

alter table public.klaviyo_segments
  drop column if exists is_starred,
  drop column if exists external_created_at,
  drop column if exists external_updated_at;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_segments' and column_name='is_active') = 'YES' then
    alter table public.klaviyo_segments alter column is_active set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_segments' and column_name='is_active') is distinct from 'true' then
    alter table public.klaviyo_segments alter column is_active set default true;
  end if;
end
$do$;

do $do$
begin
  if (select is_nullable from information_schema.columns where table_schema='public' and table_name='klaviyo_segments' and column_name='raw_data') = 'YES' then
    alter table public.klaviyo_segments alter column raw_data set not null;
  end if;
end
$do$;

do $do$
begin
  if (select column_default from information_schema.columns where table_schema='public' and table_name='klaviyo_segments' and column_name='raw_data') is distinct from '''{}''::jsonb' then
    alter table public.klaviyo_segments alter column raw_data set default '{}'::jsonb;
  end if;
end
$do$;

-- Nulabilidad de las columnas recien anadidas: el `add column` de arriba las
-- crea opcionales y en produccion son obligatorias. Las tablas estan vacias en
-- cualquier entorno nuevo, asi que el `set not null` es inmediato.
do $do$
declare
  faltantes text[] := array[
    'klaviyo_daily_account_metrics.created_at',
    'klaviyo_daily_account_metrics.metric_id',
    'klaviyo_daily_account_metrics.raw_data',
    'klaviyo_daily_account_metrics.source',
    'klaviyo_daily_account_metrics.value',
    'klaviyo_list_daily_snapshots.created_at',
    'klaviyo_list_daily_snapshots.source',
    'klaviyo_segment_daily_snapshots.created_at',
    'klaviyo_segment_daily_snapshots.source'
  ];
  objetivo text;
  tabla text;
  columna text;
begin
  foreach objetivo in array faltantes loop
    tabla := split_part(objetivo, '.', 1);
    columna := split_part(objetivo, '.', 2);
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tabla
        and column_name = columna and is_nullable = 'YES'
    ) then
      execute format('alter table public.%I alter column %I set not null', tabla, columna);
    end if;
  end loop;
end
$do$;
