-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- AI-31: private storage and A09 tool enablement for native PDF reports.
-- Uploads and signed downloads are performed by the tenant-checked API using
-- service_role. The bucket stays private; clients receive only expiring URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'copilot-reports',
  'copilot-reports',
  false,
  20971520,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

do $a09_report_guard$
begin
  if not exists (
    select 1
    from public.agent_versions av
    join public.agent_definitions ad on ad.id = av.definition_id
    where ad.code = 'a09_copiloto_consultor'
      and av.version = 'v14'
  ) then
    raise exception 'A09_AGENT_V14_REQUIRED_FOR_REPORT_TOOL';
  end if;
end
$a09_report_guard$;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (
    select id from public.agent_definitions where code = 'a09_copiloto_consultor'
  );

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools,
   approval_mode, output_schema_version, config)
select v.definition_id,
  'v15',
  v.model,
  v.prompt_code,
  v.prompt_version,
  case
    when coalesce(v.allowed_tools, '[]'::jsonb) ? 'generate_report'
      then coalesce(v.allowed_tools, '[]'::jsonb)
    else coalesce(v.allowed_tools, '[]'::jsonb) || jsonb_build_array('generate_report')
  end,
  v.approval_mode,
  v.output_schema_version,
  v.config
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a09_copiloto_consultor'
  and v.version = 'v14'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    output_schema_version = excluded.output_schema_version,
    config = excluded.config,
    is_active = true;


