-- AI-14: tools de abstencion y calidad de datos.
-- Solo amplia el catalogo permitido de A11; no conecta proveedores ni escribe
-- datos de negocio. Los executors siguen siendo propuestas no mutantes.
update public.agent_versions as av
set allowed_tools = (
  select jsonb_agg(distinct tool_name order by tool_name)
  from jsonb_array_elements_text(
    coalesce(av.allowed_tools, '[]'::jsonb) ||
    '["request_missing_data", "escalate_to_human", "flag_data_quality_issue", "report_confidence"]'::jsonb
  ) as tools(tool_name)
)
from public.agent_definitions as ad
where av.definition_id = ad.id
  and ad.code = 'a11_generador_marketing'
  and av.is_active = true;

comment on column public.agent_versions.allowed_tools is
  'Catalogo explicito de tools permitido para la version del agente; incluye abstencion y calidad cuando la version lo declare.';
