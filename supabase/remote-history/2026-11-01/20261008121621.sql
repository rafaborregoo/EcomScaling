-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A02 incorpora el resumen de Klaviyo y conserva conclusiones parciales
-- cuando una moneda atribuida no puede compararse con Shopify.

insert into public.prompt_versions (code, version, content, checksum)
select
  source.code,
  'v9',
  source.content || E'\n\nKLAVIYO: usa el bloque "Email y CRM Klaviyo" cuando tenga disponibilidad. Los indicadores de aperturas, clics, conversiones y entregabilidad pueden analizarse aunque la moneda atribuida sea desconocida o incompatible. El bloque omite esos importes en ese caso: no los reconstruyas, no los conviertas y no compares ingresos de Klaviyo con Shopify salvo que klaviyo_status sea compatible. Trata ingresos atribuidos como atribuciÃ³n de la plataforma, no como ventas adicionales a Shopify. Si faltan filas o falla la consulta, declara Klaviyo no disponible; no interpretes ausencia como rendimiento cero.\n\nEVIDENCIA EJECUTIVA: cada hallazgo debe citar la mÃ©trica observada, su fuente y periodo. Prioriza riesgos actuales y accionables; no eleves una advertencia a urgente sin evidencia cuantificada. La cobertura monetaria pendiente afecta solo a conclusiones monetarias que dependan de la comparaciÃ³n: conserva ventas de Shopify en su moneda y todas las seÃ±ales no monetarias disponibles.',
  encode(
    sha256(
      (source.content || E'\n\nKLAVIYO: usa el bloque "Email y CRM Klaviyo" cuando tenga disponibilidad. Los indicadores de aperturas, clics, conversiones y entregabilidad pueden analizarse aunque la moneda atribuida sea desconocida o incompatible. El bloque omite esos importes en ese caso: no los reconstruyas, no los conviertas y no compares ingresos de Klaviyo con Shopify salvo que klaviyo_status sea compatible. Trata ingresos atribuidos como atribuciÃ³n de la plataforma, no como ventas adicionales a Shopify. Si faltan filas o falla la consulta, declara Klaviyo no disponible; no interpretes ausencia como rendimiento cero.\n\nEVIDENCIA EJECUTIVA: cada hallazgo debe citar la mÃ©trica observada, su fuente y periodo. Prioriza riesgos actuales y accionables; no eleves una advertencia a urgente sin evidencia cuantificada. La cobertura monetaria pendiente afecta solo a conclusiones monetarias que dependan de la comparaciÃ³n: conserva ventas de Shopify en su moneda y todas las seÃ±ales no monetarias disponibles.')::bytea
    ),
    'hex'
  )
from public.prompt_versions source
where source.code = 'a02_monitor_negocio_system'
  and source.version = 'v8'
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active = true
  and definition_id = (
    select id from public.agent_definitions
    where code = 'a02_monitor_negocio'
  );

insert into public.agent_versions
  (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select
  id,
  'v10',
  'claude-sonnet-5',
  'a02_monitor_negocio_system',
  'v9',
  '["search_knowledge"]'::jsonb,
  'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set is_active = excluded.is_active;


