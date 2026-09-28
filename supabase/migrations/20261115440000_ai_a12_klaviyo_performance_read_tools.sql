-- A12 can query bounded, tenant/store-scoped Klaviyo performance when its
-- prepared diagnostic context needs drill-down. Metrics remain read-only and
-- monthly because klaviyo_email_report does not preserve send-level rows.

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v4',
  replace(
    p.content,
    'Si recibes una revision reciente de A26',
    'Puedes consultar klaviyo_performance_summary para un resumen comparable, klaviyo_entity_performance para profundizar en una campana/flow y klaviyo_deliverability_health para cobertura y medicion. Usalas solo si el contexto preparado no resuelve una pregunta concreta; no repitas lecturas ni pidas ventanas superiores a 90 dias. Cita fechas, volumen y granularidad mensual; distingue null/sin datos de cero. No llames a filas mensuales "envios" ni atribuyas causalidad. Si la tienda activa no admite tracking, indica que no esta disponible, no cambies a agregado global. Si recibes una revision reciente de A26'
  ),
  encode(sha256('a12_analista_email_system_v4'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a12_analista_email_system'
  and p.version = 'v3'
  and position('Si recibes una revision reciente de A26' in p.content) > 0
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active
  and definition_id in (
    select id from public.agent_definitions where code = 'a12_analista_email'
  );

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version,
  allowed_tools, approval_mode
)
select
  v.definition_id,
  'v4',
  v.model,
  v.prompt_code,
  'v4',
  ((v.allowed_tools - 'klaviyo_performance_summary' - 'klaviyo_entity_performance' - 'klaviyo_deliverability_health')
    || '["klaviyo_performance_summary","klaviyo_entity_performance","klaviyo_deliverability_health"]'::jsonb),
  v.approval_mode
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a12_analista_email'
  and v.version = 'v3'
on conflict (definition_id, version) do update
  set is_active = excluded.is_active,
      prompt_version = excluded.prompt_version,
      allowed_tools = excluded.allowed_tools;

do $a12_tools$
declare
  prompt_count integer;
  active_count integer;
begin
  select count(*) into prompt_count
  from public.prompt_versions
  where code = 'a12_analista_email_system'
    and version = 'v4'
    and position('klaviyo_entity_performance' in content) > 0;

  select count(*) into active_count
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a12_analista_email'
    and v.version = 'v4'
    and v.prompt_version = 'v4'
    and v.is_active
    and v.allowed_tools @> '["klaviyo_performance_summary","klaviyo_entity_performance","klaviyo_deliverability_health"]'::jsonb;

  if prompt_count <> 1 or active_count <> 1 then
    raise exception 'AI_A12_PERFORMANCE_TOOLS_INCOMPLETE: prompt %, active agent versions %', prompt_count, active_count;
  end if;
end
$a12_tools$;
