-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Select one recent result per specialist before serializing any output.
-- This prevents a frequent agent from filling the whole shared sample.
create or replace function public.get_latest_specialist_runs(
  p_organization_id uuid,
  p_store_id uuid,
  p_agent_codes text[],
  p_include_pending boolean,
  p_since timestamptz
)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  with ranked as (
    select
      run.id,
      run.organization_id,
      run.store_id,
      run.status,
      run.finished_at,
      run.time_range,
      run.lookback_days,
      version.version,
      definition.code,
      agent_output.id as output_id,
      agent_output.status as output_status,
      agent_output.output,
      row_number() over (
        partition by definition.code
        order by run.finished_at desc, run.id desc
      ) as rank_in_specialist
    from public.agent_runs as run
    join public.agent_versions as version on version.id = run.agent_version_id
    join public.agent_definitions as definition on definition.id = version.definition_id
    join public.agent_outputs as agent_output on agent_output.run_id = run.id
    where run.organization_id = p_organization_id
      and run.store_id is not distinct from p_store_id
      and run.status = 'succeeded'
      and run.finished_at >= p_since
      and definition.code = any(p_agent_codes)
      and agent_output.organization_id = p_organization_id
      and agent_output.status in ('approved', 'published', 'pending_approval')
      and (p_include_pending or agent_output.status <> 'pending_approval')
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'organization_id', organization_id,
        'store_id', store_id,
        'status', status,
        'finished_at', finished_at,
        'time_range', time_range,
        'lookback_days', lookback_days,
        'agent_versions', jsonb_build_object(
          'version', version,
          'agent_definitions', jsonb_build_object('code', code)
        ),
        'agent_outputs', jsonb_build_object(
          'id', output_id,
          'organization_id', organization_id,
          'status', output_status,
          'output', output
        )
      ) order by finished_at desc
    ),
    '[]'::jsonb
  )
  from ranked
  where rank_in_specialist = 1;
$$;

revoke all on function public.get_latest_specialist_runs(uuid, uuid, text[], boolean, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_latest_specialist_runs(uuid, uuid, text[], boolean, timestamptz)
  to service_role;


