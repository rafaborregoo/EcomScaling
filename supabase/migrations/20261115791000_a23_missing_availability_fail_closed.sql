-- Keep A23 safe while runtime versions without availability metadata remain deployed.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v8',
  p.content || E'\n\n15. METADATOS DE DISPONIBILIDAD AUSENTES\nSi no recibes el bloque de disponibilidad, interpreta todas las fuentes como unknown. No concluyas cero, cuenta quieta ni ausencia de datos. No recomiendes pausa ni escalado por ventas o ROAS basandote en fuentes cuyo estado desconoces. Explica que la disponibilidad no pudo verificarse y limita la respuesta a evidencia visible en el contexto; solicita una comprobacion si esa informacion es necesaria para decidir.',
  encode(sha256((p.content || E'\n\n15. METADATOS DE DISPONIBILIDAD AUSENTES\nSi no recibes el bloque de disponibilidad, interpreta todas las fuentes como unknown. No concluyas cero, cuenta quieta ni ausencia de datos. No recomiendes pausa ni escalado por ventas o ROAS basandote en fuentes cuyo estado desconoces. Explica que la disponibilidad no pudo verificarse y limita la respuesta a evidencia visible en el contexto; solicita una comprobacion si esa informacion es necesaria para decidir.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a23_creatividad_meta_system' and p.version = 'v7'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
from public.agent_definitions d
where av.definition_id = d.id
  and av.is_active
  and d.code = 'a23_creatividad_meta';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select d.id, 'v8', source.model, 'a23_creatividad_meta_system', 'v8', source.allowed_tools, source.approval_mode
from public.agent_definitions d
join public.agent_versions source on source.definition_id = d.id and source.version = 'v7'
where d.code = 'a23_creatividad_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;

do $a23_v8_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a23_creatividad_meta_system' and version = 'v8'
      and position('si no recibes el bloque de disponibilidad' in lower(content)) > 0
      and position('interpreta todas las fuentes como unknown' in lower(content)) > 0
      and position('no concluyas cero, cuenta quieta ni ausencia de datos' in lower(content)) > 0
      and position('no recomiendes pausa ni escalado por ventas o roas' in lower(content)) > 0
  ) or not exists (
    select 1 from public.agent_versions av
    join public.agent_definitions d on d.id = av.definition_id
    where d.code = 'a23_creatividad_meta' and av.version = 'v8'
      and av.prompt_version = 'v8' and av.is_active
  ) then
    raise exception 'A23_V8_FAIL_CLOSED_PROMPT_OR_ACTIVE_VERSION_MISSING';
  end if;
end
$a23_v8_guard$;
