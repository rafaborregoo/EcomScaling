-- A02 consulta metodologia contextual solo cuando necesita interpretar una cifra.
-- La tool de conocimiento es read-only; las métricas de tienda siguen siendo
-- los hechos primarios y la recuperación no puede inventar valores.

insert into public.prompt_versions (code, version, content, checksum)
select
  source.code,
  'v7',
  replace(
    replace(
      source.content,
      '- No presentes ausencia de datos como cero ni una inferencia como hecho.',
      '- No presentes ausencia de datos como cero ni una inferencia como hecho. Las cifras del snapshot son los hechos; el conocimiento solo aporta criterios de interpretación contextual. No generalices benchmarks de otra vertical, periodo o tamaño de muestra.'
    ),
    'Usa solo las tools permitidas por el backend y solo cuando falte evidencia puntual. No explores por rutina.',
    'Puedes usar search_knowledge para consultar una regla, definición o referencia de rendimiento de la vertical cuando sea necesaria para interpretar los datos. No repitas una búsqueda para obtener métricas que ya vienen en el contexto; no trates un benchmark como umbral universal; si la referencia no es comparable o no existe, dilo y abstente de clasificar la cifra como buena o mala. Cita en sources el documento recuperado y separa expresamente la cifra observada de su interpretación.'
  ),
  encode(
    sha256(
      replace(
        replace(
          source.content,
          '- No presentes ausencia de datos como cero ni una inferencia como hecho.',
          '- No presentes ausencia de datos como cero ni una inferencia como hecho. Las cifras del snapshot son los hechos; el conocimiento solo aporta criterios de interpretación contextual. No generalices benchmarks de otra vertical, periodo o tamaño de muestra.'
        ),
        'Usa solo las tools permitidas por el backend y solo cuando falte evidencia puntual. No explores por rutina.',
        'Puedes usar search_knowledge para consultar una regla, definición o referencia de rendimiento de la vertical cuando sea necesaria para interpretar los datos. No repitas una búsqueda para obtener métricas que ya vienen en el contexto; no trates un benchmark como umbral universal; si la referencia no es comparable o no existe, dilo y abstente de clasificar la cifra como buena o mala. Cita en sources el documento recuperado y separa expresamente la cifra observada de su interpretación.'
      )::bytea
    ),
    'hex'
  )
from public.prompt_versions source
where source.code = 'a02_monitor_negocio_system'
  and source.version = 'v6'
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
  'v8',
  'claude-sonnet-5',
  'a02_monitor_negocio_system',
  'v7',
  '["search_knowledge"]'::jsonb,
  'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio'
on conflict (definition_id, version) do update set is_active = excluded.is_active;
;
