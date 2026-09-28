-- A11: conectar datos de producto sincronizados e histórico de Klaviyo al
-- generador, con alcance de organización/tienda y sin permisos de escritura.
-- El prompt nuevo conserva íntegramente el contrato v5 y añade precedencia y
-- reglas de uso de las nuevas fuentes.

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v6',
  p.content || E'\n\n10. CONTEXTO DE PRODUCTO Y VOZ HISTÓRICA (A11-1)\nAntes de redactar un email Klaviyo, consulta klaviyo_email_content para calibrar voz y estructura con campañas/flows reales de ESTA organización; nunca copies literalmente una pieza anterior. Consulta get_shopify_product_catalog cuando el brief mencione productos, precios o variantes: utiliza solo campos devueltos y respeta el ámbito de tienda activa. El catálogo sincronizado no incluye descripción completa, imágenes ni disponibilidad en tiempo real; si falta un dato, no lo infieras y devuelve marcador visible + warning. La precedencia es: brief explícito actual > perfil/guía de marca disponible > hechos del catálogo sincronizado > tono neutro-profesional. Si el histórico contradice el brief actual, prevalece el brief y señala la diferencia solo si afecta al resultado.',
  encode(sha256((p.content || E'\n\n10. CONTEXTO DE PRODUCTO Y VOZ HISTÓRICA (A11-1)\nAntes de redactar un email Klaviyo, consulta klaviyo_email_content para calibrar voz y estructura con campañas/flows reales de ESTA organización; nunca copies literalmente una pieza anterior. Consulta get_shopify_product_catalog cuando el brief mencione productos, precios o variantes: utiliza solo campos devueltos y respeta el ámbito de tienda activa. El catálogo sincronizado no incluye descripción completa, imágenes ni disponibilidad en tiempo real; si falta un dato, no lo infieras y devuelve marcador visible + warning. La precedencia es: brief explícito actual > perfil/guía de marca disponible > hechos del catálogo sincronizado > tono neutro-profesional. Si el histórico contradice el brief actual, prevalece el brief y señala la diferencia solo si afecta al resultado.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a11_generador_marketing_system'
  and p.version = 'v5'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions
set is_active = false
where is_active
  and definition_id = (
    select id from public.agent_definitions where code = 'a11_generador_marketing'
  );

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode
)
select
  id,
  'v6',
  'claude-sonnet-5',
  'a11_generador_marketing_system',
  'v6',
  '["data_coverage","search_knowledge","get_organization_profile","get_strategic_plan","list_open_tasks","list_open_alerts","get_call_history","get_financial_settings","klaviyo_email_content","get_shopify_product_catalog"]'::jsonb,
  'required_before_publish'
from public.agent_definitions
where code = 'a11_generador_marketing'
on conflict (definition_id, version) do update
set model = excluded.model,
    prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
;
