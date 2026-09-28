-- A02 pasa de una salida plana a un contrato corto, agrupado por área.

insert into public.prompt_versions (code, version, content, checksum)
select
  source.code,
  'v8',
  replace(
    source.content,
    'Devuelve answer breve en espanol, findings con cifra y periodo, recommendations accionables, sources, confidence y warnings.',
    'Devuelve el contrato monitorOutput: headline (una frase) y sections agrupadas por dominio; cada sección lleva key, label, findings con evidencia y recommendations accionables. Usa claves ventas, finanzas, stock, meta, klaviyo, operativa o integraciones. Incluye solo áreas con datos disponibles: si falta la integración o el dato, omite la sección en lugar de inventar o devolver cero. Cada hallazgo mantiene cifra y periodo en evidence; cada recomendación explica acción, prioridad, impacto y responsable. Incluye sources, confidence y warnings. No devuelvas answer ni listas planas de findings/recommendations.'
  ),
  encode(
    sha256(
      replace(
        source.content,
        'Devuelve answer breve en espanol, findings con cifra y periodo, recommendations accionables, sources, confidence y warnings.',
        'Devuelve el contrato monitorOutput: headline (una frase) y sections agrupadas por dominio; cada sección lleva key, label, findings con evidencia y recommendations accionables. Usa claves ventas, finanzas, stock, meta, klaviyo, operativa o integraciones. Incluye solo áreas con datos disponibles: si falta la integración o el dato, omite la sección en lugar de inventar o devolver cero. Cada hallazgo mantiene cifra y periodo en evidence; cada recomendación explica acción, prioridad, impacto y responsable. Incluye sources, confidence y warnings. No devuelvas answer ni listas planas de findings/recommendations.'
      )::bytea
    ),
    'hex'
  )
from public.prompt_versions source
where source.code = 'a02_monitor_negocio_system'
  and source.version = 'v7'
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
  'v9',
  'claude-sonnet-5',
  'a02_monitor_negocio_system',
  'v8',
  '["search_knowledge"]'::jsonb,
  'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
;
