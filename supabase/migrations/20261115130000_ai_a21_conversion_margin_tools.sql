-- Habilita las herramientas read-only que A21 ya ejecuta, con contratos Zod.
-- Nueva versión de agente: no mutar una configuración activa de forma in-place.
update public.agent_versions av
set is_active = false
from public.agent_definitions d
where av.definition_id = d.id
  and d.code = 'a21_adquisicion_shopify'
  and av.is_active;

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode, output_schema_version, is_active)
select d.id, 'v2', 'claude-sonnet-5', 'a21_adquisicion_shopify_system', 'v1',
  '["search_knowledge","shopify_funnel_health","shopify_margin_health"]'::jsonb,
  'required_before_publish', 'v1', true
from public.agent_definitions d
where d.code = 'a21_adquisicion_shopify'
on conflict (definition_id, version) do update
set allowed_tools = excluded.allowed_tools, is_active = true;
;
