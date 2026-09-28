-- A12/A26: combine email performance with the latest approved content review
-- from the exact same store scope. A12 remains the owner of performance data;
-- A26 contributes qualitative findings only, never causal attribution.

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v3',
  replace(
    p.content,
    'Jamas una URL ni texto libre.',
    'Jamas una URL ni texto libre. Si recibes una revision reciente de A26, usala solo para localizar el contenido que podria explicar una oportunidad y cotejala con el periodo, mensaje y denominador de tus propias metricas. A26 aporta observaciones cualitativas, no rendimiento ni causalidad: no concluyas que un color, layout, asunto o CTA causo el resultado sin un experimento controlado. Si no hay revision aprobada de A26 para este mismo alcance, continua solo con los datos disponibles y declara cualquier limite.'
  ),
  encode(sha256('a12_analista_email_system_v3'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a12_analista_email_system'
  and p.version = 'v2'
  and position('Jamas una URL ni texto libre.' in p.content) > 0
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
  v.definition_id, 'v3', v.model, v.prompt_code, 'v3',
  v.allowed_tools, v.approval_mode
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code = 'a12_analista_email'
  and v.version = 'v2'
on conflict (definition_id, version) do update
  set is_active = excluded.is_active,
      prompt_version = excluded.prompt_version;

do $a12_a26_scope$
declare
  prompt_count integer;
  active_count integer;
begin
  select count(*) into prompt_count
  from public.prompt_versions
  where code = 'a12_analista_email_system'
    and version = 'v3'
    and position('A26 aporta observaciones cualitativas' in content) > 0;

  select count(*) into active_count
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a12_analista_email'
    and v.version = 'v3'
    and v.prompt_version = 'v3'
    and v.is_active;

  if prompt_count <> 1 or active_count <> 1 then
    raise exception 'AI_A12_A26_SCOPE_INCOMPLETE: prompt %, active agent versions %', prompt_count, active_count;
  end if;
end
$a12_a26_scope$;
