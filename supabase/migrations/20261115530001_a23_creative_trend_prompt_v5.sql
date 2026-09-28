-- A23 receives a bounded daily series alongside the creative drill-down.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a23_creatividad_meta_system',
  'v5',
  p.content || E'\n\n12. TENDENCIA TEMPORAL Y FATIGA\nLa tool `meta_creative_diagnostics` incluye `daily_trend.daily_metrics`, una serie de hasta 90 días al nivel anuncio-día. Compara ventanas con cobertura suficiente y usa gasto, CPM, CTR de salida y coste por compra junto con contexto de volumen y medición. `reach` y `frequency` son observaciones diarias: nunca las sumes para crear un total del periodo ni compares ventanas si falta cobertura. La compra sigue la ventana de atribución indicada y puede diferir de otros informes. Deterioro junto con repetición puede justificar investigar o probar una variante; no demuestra fatiga creativa ni causalidad. Si la serie no está disponible o tiene pocos días, dilo y no rellenes huecos.',
  encode(sha256((p.content || E'\n\n12. TENDENCIA TEMPORAL Y FATIGA\nLa tool `meta_creative_diagnostics` incluye `daily_trend.daily_metrics`, una serie de hasta 90 días al nivel anuncio-día. Compara ventanas con cobertura suficiente y usa gasto, CPM, CTR de salida y coste por compra junto con contexto de volumen y medición. `reach` y `frequency` son observaciones diarias: nunca las sumes para crear un total del periodo ni compares ventanas si falta cobertura. La compra sigue la ventana de atribución indicada y puede diferir de otros informes. Deterioro junto con repetición puede justificar investigar o probar una variante; no demuestra fatiga creativa ni causalidad. Si la serie no está disponible o tiene pocos días, dilo y no rellenes huecos.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a23_creatividad_meta_system' and p.version = 'v4'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a23_creatividad_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v5', 'claude-sonnet-5', 'a23_creatividad_meta_system', 'v5', '["search_knowledge","meta_creative_diagnostics"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a23_creatividad_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
