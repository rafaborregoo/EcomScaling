-- Deriva en klaviyo_report_values: el fichero de fundacion describe un diseño
-- (statistic_name + dimension_hash + punteros a cada entidad) que NUNCA se
-- construyo. Produccion tiene el diseño que usa el codigo -- una fila por
-- metrica, con `metric_id` y unique
-- (report_run_id, entity_type, external_entity_id, metric_id, period_start, period_end),
-- que es el onConflict de klaviyo-sync.ts -- y ahi se quedo.
--
-- Se detecto al levantar el proyecto de desarrollo desde cero (2026-09-11): la
-- base nueva nacia con la forma del fichero, en la que el sync de informes no
-- puede escribir (statistic_name not null, unique distinto).
--
-- Manda el codigo, que coincide con produccion. Esta migracion converge
-- cualquier base a esa forma; sobre produccion es practicamente un no-op.

alter table public.klaviyo_report_values
  add column if not exists metric_id varchar(255),
  add column if not exists created_at timestamptz not null default now();

-- El unique que usa el upsert. Indice para poder pedir `if not exists`.
create unique index if not exists klaviyo_report_values_unique_metric
  on public.klaviyo_report_values (
    report_run_id, entity_type, external_entity_id, metric_id, period_start, period_end
  );

-- Restos del diseño que no llego a existir. `if exists` en todo: en produccion
-- no hay nada que borrar.
alter table public.klaviyo_report_values
  drop constraint if exists klaviyo_report_values_entity_target_check,
  drop constraint if exists klaviyo_report_values_unique_value;

drop index if exists public.klaviyo_report_values_dimension_idx;

alter table public.klaviyo_report_values
  drop column if exists statistic_name,
  drop column if exists value_numeric,
  drop column if exists value_json,
  drop column if exists dimension_hash,
  drop column if exists dimensions,
  drop column if exists channel,
  drop column if exists interval,
  drop column if exists captured_at,
  drop column if exists campaign_id,
  drop column if exists campaign_message_id,
  drop column if exists flow_id,
  drop column if exists flow_message_id,
  drop column if exists form_id,
  drop column if exists segment_id;

comment on column public.klaviyo_report_values.metric_id is
  'Metrica de Klaviyo a la que corresponde el valor. Forma la clave del upsert junto al run, la entidad y el periodo.';
