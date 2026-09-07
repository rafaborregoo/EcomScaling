-- Drift de esquema detectado el 2026-09-05 al intentar reconstruir la base
-- desde cero en un proyecto limpio (EcomScaling-Tests).
--
-- `20260802140000_db_09_klaviyo_foundation.sql` crea
-- `klaviyo_report_values.period_start/period_end` como `timestamptz not null`.
-- NINGUNA migracion posterior cambia ese tipo. Sin embargo, produccion los
-- tiene como `date`: alguien los cambio a mano (dashboard o SQL suelto) y ese
-- cambio nunca se escribio como migracion.
--
-- Consecuencia: el repo NO podia reconstruir produccion. Una base nueva se
-- quedaba con `timestamptz`, y entonces
-- `20260829120000_klaviyo_email_report.sql` reventaba al crear su funcion --
-- ahi `period_end` es a la vez parametro (`date`) y columna, Postgres da
-- preferencia a la columna, y `timestamptz + 1` no existe como operador.
-- Sobre produccion no fallo porque alli la columna ya era `date`.
--
-- Esta migracion escribe el estado real de produccion en el repo. Es
-- idempotente y no toca nada si el tipo ya es el correcto, asi que sobre
-- produccion es un no-op (no hay reescritura de tabla).
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'klaviyo_report_values'
      and column_name = 'period_start'
      and data_type <> 'date'
  ) then
    alter table public.klaviyo_report_values
      alter column period_start type date using period_start::date,
      alter column period_end type date using period_end::date;
  end if;
end
$$;
