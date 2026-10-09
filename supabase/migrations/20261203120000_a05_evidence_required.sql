-- New A05 campaigns must be grounded. An empty calendar remains a valid
-- response when the shop has no seasonal/commercial evidence for the window.
with next_prompt as (
  select code,
    content || E'\n\n- EVIDENCIA OBLIGATORIA POR INICIATIVA: cada campaña propuesta debe citar al menos una señal concreta de los bloques recibidos y el plan debe declarar las fuentes realmente usadas. No conviertas hipótesis, una fecha festiva o conocimiento sin procedencia en prueba de demanda. Si no puedes respaldar cada iniciativa con evidencia de la tienda, de un especialista aprobado o de un calendario comercial disponible, devuelve `campaigns: []` y explica en `warnings` qué dato o preparación falta. Un calendario vacío es preferible a una campaña sin contexto.' as prompt_content
  from public.prompt_versions
  where code = 'a05_estrategia_campanas_system' and version = 'v4'
)
insert into public.prompt_versions (code, version, content, checksum)
select code, 'v5', prompt_content, encode(sha256(convert_to(prompt_content, 'UTF8')), 'hex')
from next_prompt
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (
    select id from public.agent_definitions where code = 'a05_estrategia_campanas'
  );

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v5', 'claude-sonnet-5', 'a05_estrategia_campanas_system', 'v5',
  '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions where code = 'a05_estrategia_campanas'
on conflict (definition_id, version) do update
set is_active = excluded.is_active,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode;
