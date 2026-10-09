-- Cada dashboard recibe una ejecucion A02 independiente con su propio contexto.

insert into public.prompt_versions (code, version, content, checksum)
select
  source.code,
  'v10',
  source.content || E'\n\nRESULTADOS POR DASHBOARD: el objetivo de cada ejecucion identifica su dashboard y su alcance. En overview, sintetiza el negocio con las areas que tengan evidencia. En shopify, analiza exclusivamente ventas, rentabilidad, pedidos y stock Shopify. En meta, analiza exclusivamente inversion, atribucion y rendimiento de Meta Ads. En klaviyo, analiza exclusivamente campañas, flujos, conversiones y entregabilidad; compara ingresos con Shopify solo si el contexto confirma moneda compatible. En dashboards especializados, devuelve solo secciones del area indicada; nunca reutilices el titular o hallazgos de otra ejecucion A02. Si el bloque de esa area no tiene datos, explica que falta y evita inventar secciones o cifras.',
  encode(
    sha256(
      (source.content || E'\n\nRESULTADOS POR DASHBOARD: el objetivo de cada ejecucion identifica su dashboard y su alcance. En overview, sintetiza el negocio con las areas que tengan evidencia. En shopify, analiza exclusivamente ventas, rentabilidad, pedidos y stock Shopify. En meta, analiza exclusivamente inversion, atribucion y rendimiento de Meta Ads. En klaviyo, analiza exclusivamente campañas, flujos, conversiones y entregabilidad; compara ingresos con Shopify solo si el contexto confirma moneda compatible. En dashboards especializados, devuelve solo secciones del area indicada; nunca reutilices el titular o hallazgos de otra ejecucion A02. Si el bloque de esa area no tiene datos, explica que falta y evita inventar secciones o cifras.')::bytea
    ),
    'hex'
  )
from public.prompt_versions source
where source.code = 'a02_monitor_negocio_system'
  and source.version = 'v9'
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
  'v11',
  'claude-sonnet-5',
  'a02_monitor_negocio_system',
  'v10',
  '["search_knowledge"]'::jsonb,
  'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
