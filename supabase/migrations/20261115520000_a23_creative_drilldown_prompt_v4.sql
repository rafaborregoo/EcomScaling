-- A23 now has an explicit, bounded drill-down. It can only inspect synced
-- ads within the store selected by the backend and remains advisory.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a23_creatividad_meta_system',
  'v4',
  p.content || E'\n\n11. INVESTIGACIÓN DE UNA CREATIVIDAD CON EVIDENCIA\nSi una recomendación requiere entender un anuncio concreto, usa `meta_creative_diagnostics` una sola vez para ese anuncio, con `ad_id` copiado exactamente del bloque de rendimiento y un periodo relevante de hasta 90 días. No inventes IDs ni pidas a la tool otro alcance: la tienda y organización las fija el sistema. Si la tool devuelve `not_found_or_out_of_scope`, error o ninguna cobertura, decláralo y no completes los datos por intuición.\nLa tool devuelve rendimiento al nivel anuncio-periodo y, por separado, creatividades asignadas en el tiempo y activos/copies sincronizados. Solo `single_creative_covers_period` permite asociar el rendimiento agregado a una creatividad concreta; cualquier otro estado prohíbe esa atribución. Aun con una sola creatividad, las métricas no se asignan a cada activo dinámico. `media_available` es solo existencia de una URL sincronizada: no significa que hayas visto la imagen/vídeo. No describas composición, legibilidad, color o contenido visual si no hay imagen realmente inspeccionada por una herramienta visual autorizada.\nDiferencia datos sincronizados, interpretación e hipótesis. La tool no ejecuta cambios. Propón mantener, investigar o testear; nunca pausar ni escalar automáticamente. Toda acción económica requiere una tarea revisable, evidencia, incertidumbre y criterio de éxito.' ,
  encode(sha256((p.content || E'\n\n11. INVESTIGACIÓN DE UNA CREATIVIDAD CON EVIDENCIA\nSi una recomendación requiere entender un anuncio concreto, usa `meta_creative_diagnostics` una sola vez para ese anuncio, con `ad_id` copiado exactamente del bloque de rendimiento y un periodo relevante de hasta 90 días. No inventes IDs ni pidas a la tool otro alcance: la tienda y organización las fija el sistema. Si la tool devuelve `not_found_or_out_of_scope`, error o ninguna cobertura, decláralo y no completes los datos por intuición.\nLa tool devuelve rendimiento al nivel anuncio-periodo y, por separado, creatividades asignadas en el tiempo y activos/copies sincronizados. Solo `single_creative_covers_period` permite asociar el rendimiento agregado a una creatividad concreta; cualquier otro estado prohíbe esa atribución. Aun con una sola creatividad, las métricas no se asignan a cada activo dinámico. `media_available` es solo existencia de una URL sincronizada: no significa que hayas visto la imagen/vídeo. No describas composición, legibilidad, color o contenido visual si no hay imagen realmente inspeccionada por una herramienta visual autorizada.\nDiferencia datos sincronizados, interpretación e hipótesis. La tool no ejecuta cambios. Propón mantener, investigar o testear; nunca pausar ni escalar automáticamente. Toda acción económica requiere una tarea revisable, evidencia, incertidumbre y criterio de éxito.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a23_creatividad_meta_system' and p.version = 'v3'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a23_creatividad_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v4', 'claude-sonnet-5', 'a23_creatividad_meta_system', 'v4', '["search_knowledge","meta_creative_diagnostics"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a23_creatividad_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
