-- A23/A25 must distinguish an empty source from a failed PostgREST RPC.

insert into public.prompt_versions (code, version, content, checksum)
select
  'a23_creatividad_meta_system',
  'v6',
  p.content || E'\n\n13. DISPONIBILIDAD DE LAS FUENTES\nEl bloque "Disponibilidad de consultas principales A23" distingue `available`, `no_data_returned` y `unavailable` para rendimiento y reparto. Si una fuente está `unavailable`, hubo un error de consulta: no digas que no hay anuncios ni uses esa fuente para conclusiones/recomendaciones. Si está `no_data_returned`, la consulta terminó correctamente pero no devolvió filas; explica que no hay datos observados en esa fuente/ventana y no lo conviertas en rendimiento cero. Si solo una fuente falla, usa con cautela la otra e indica la limitación. Nunca inventes cobertura ni conviertas un error técnico en hallazgo de negocio.',
  encode(sha256((p.content || E'\n\n13. DISPONIBILIDAD DE LAS FUENTES\nEl bloque "Disponibilidad de consultas principales A23" distingue `available`, `no_data_returned` y `unavailable` para rendimiento y reparto. Si una fuente está `unavailable`, hubo un error de consulta: no digas que no hay anuncios ni uses esa fuente para conclusiones/recomendaciones. Si está `no_data_returned`, la consulta terminó correctamente pero no devolvió filas; explica que no hay datos observados en esa fuente/ventana y no lo conviertas en rendimiento cero. Si solo una fuente falla, usa con cautela la otra e indica la limitación. Nunca inventes cobertura ni conviertas un error técnico en hallazgo de negocio.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a23_creatividad_meta_system' and p.version = 'v5'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

insert into public.prompt_versions (code, version, content, checksum)
select
  'a25_cambios_meta_system',
  'v3',
  p.content || E'\n\n10. DISPONIBILIDAD DE LAS FUENTES\nEl bloque "Disponibilidad de consultas principales A25" distingue `available`, `no_data_returned` y `unavailable` para registro de cambios y públicos. `unavailable` significa que falló la consulta: no concluyas que la cuenta estuvo quieta ni recomiendes sobre públicos usando esa fuente. `no_data_returned` significa que la consulta tuvo éxito sin filas; en cambios, explica que puede ser cuenta quieta o registro no sincronizado y mantenlo como incertidumbre; en públicos, no afirmes que no existen públicos. Si solo una fuente falla, limita el análisis a la otra y di qué no se pudo verificar. Nunca conviertas un error técnico en hallazgo de negocio.',
  encode(sha256((p.content || E'\n\n10. DISPONIBILIDAD DE LAS FUENTES\nEl bloque "Disponibilidad de consultas principales A25" distingue `available`, `no_data_returned` y `unavailable` para registro de cambios y públicos. `unavailable` significa que falló la consulta: no concluyas que la cuenta estuvo quieta ni recomiendes sobre públicos usando esa fuente. `no_data_returned` significa que la consulta tuvo éxito sin filas; en cambios, explica que puede ser cuenta quieta o registro no sincronizado y mantenlo como incertidumbre; en públicos, no afirmes que no existen públicos. Si solo una fuente falla, limita el análisis a la otra y di qué no se pudo verificar. Nunca conviertas un error técnico en hallazgo de negocio.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a25_cambios_meta_system' and p.version = 'v2'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
from public.agent_definitions d
where av.definition_id = d.id
  and av.is_active
  and d.code in ('a23_creatividad_meta', 'a25_cambios_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select d.id, 'v6', source.model, 'a23_creatividad_meta_system', 'v6', source.allowed_tools, source.approval_mode
from public.agent_definitions d
join public.agent_versions source on source.definition_id = d.id and source.version = 'v5'
where d.code = 'a23_creatividad_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select d.id, 'v3', source.model, 'a25_cambios_meta_system', 'v3', source.allowed_tools, source.approval_mode
from public.agent_definitions d
join public.agent_versions source on source.definition_id = d.id and source.version = 'v2'
where d.code = 'a25_cambios_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
