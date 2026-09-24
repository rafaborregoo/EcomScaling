-- D01 (calidad de datos): que fuentes fallan en toda la cartera.
--
-- Un `permission_gap` en doce clientes es un problema de producto, no de doce
-- clientes (conocimiento/TAREAS_PENDIENTES.md, deuda de D01). Agrupa los issues
-- abiertos por fuente y tipo, con cuantas organizaciones afectan y cuantos
-- bloquean el diagnostico aguas abajo. Solo lectura, para platform_admin via
-- service_role.
--
-- Idempotente (CLAUDE.md).

drop function if exists public.admin_data_quality_portfolio();
create or replace function public.admin_data_quality_portfolio()
returns table (
  source varchar,
  issue_type varchar,
  organizations_affected bigint,
  open_issues bigint,
  blocking_issues bigint,
  client_actionable_issues bigint,
  worst_severity varchar,
  oldest_detected_at timestamptz
)
language sql
stable
as $$
  select
    i.source,
    i.issue_type,
    count(distinct i.organization_id),
    count(*),
    count(*) filter (where i.downstream_effect = 'blocked'),
    count(*) filter (where i.client_actionable),
    (array_agg(i.severity order by array_position(
      array['critical', 'high', 'moderate', 'low', 'info']::varchar[], i.severity
    )))[1],
    min(i.detected_at)
  from public.data_quality_issues i
  where i.status in ('open', 'investigating')
  group by i.source, i.issue_type
  order by count(distinct i.organization_id) desc, count(*) desc;
$$;

alter function public.admin_data_quality_portfolio()
  set search_path = pg_catalog, public;

revoke all on function public.admin_data_quality_portfolio() from public, anon, authenticated;
grant execute on function public.admin_data_quality_portfolio() to service_role;

create index if not exists data_quality_issues_abiertos_idx
  on public.data_quality_issues (source, issue_type)
  where status in ('open', 'investigating');
