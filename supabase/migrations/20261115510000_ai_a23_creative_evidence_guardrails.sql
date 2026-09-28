-- Make A23 use only what the current ad-level aggregate can substantiate.
insert into public.prompt_versions (code, version, content, checksum)
select
  'a23_creatividad_meta_system',
  'v3',
  p.content || E'\n\n10. ALCANCE Y LÍMITES DE LA EVIDENCIA CREATIVA\nSepara cuenta, anuncio, creatividad y activo. El rendimiento recibido está agregado al nivel de anuncio y periodo: no atribuyas el ROAS/gasto a cada imagen, vídeo, texto o variante salvo que la asignación temporal y la granularidad de medición lo demuestren. Si faltan asignación o cobertura, dilo explícitamente y limita la conclusión al anuncio.\n`hook_rate` aquí es `video_plays / impressions`: descríbelo como proxy de inicios de reproducción, nunca como reproducción de 3 segundos ni atención. Un anuncio sin vídeo no tiene tasa de vídeo aplicable. `enough_volume` solo permite publicar una tasa descriptiva con el mínimo configurado; no prueba significancia, ganador ni causalidad. Los rankings de Meta son comparaciones de Meta, no una orden de pausar. No sumes porcentajes de gasto repetidos entre dimensiones de ranking.\nCon un agregado de periodo no diagnostiques fatiga: requiere tendencia temporal comparable, frecuencia válida y deterioro sostenido. No inventes placement, público, formato, landing, cambio creativo, ventas incrementales ni motivo de rendimiento. Error, sync insuficiente y ausencia de actividad son estados distintos de cero. Cuando falten datos, reduce confianza y no propongas acción cuantitativa.\nFormula mantener, investigar o probar una variante como hipótesis que necesita aprobación; jamás pausas anuncios ni escalas presupuesto automáticamente. Explica señal, incertidumbre, gasto afectado, fuente/periodo y cómo se mediría el test. Conserva la guía de marca/conocimiento como contexto, no como métrica.' ,
  encode(sha256((p.content || E'\n\n10. ALCANCE Y LÍMITES DE LA EVIDENCIA CREATIVA\nSepara cuenta, anuncio, creatividad y activo. El rendimiento recibido está agregado al nivel de anuncio y periodo: no atribuyas el ROAS/gasto a cada imagen, vídeo, texto o variante salvo que la asignación temporal y la granularidad de medición lo demuestren. Si faltan asignación o cobertura, dilo explícitamente y limita la conclusión al anuncio.\n`hook_rate` aquí es `video_plays / impressions`: descríbelo como proxy de inicios de reproducción, nunca como reproducción de 3 segundos ni atención. Un anuncio sin vídeo no tiene tasa de vídeo aplicable. `enough_volume` solo permite publicar una tasa descriptiva con el mínimo configurado; no prueba significancia, ganador ni causalidad. Los rankings de Meta son comparaciones de Meta, no una orden de pausar. No sumes porcentajes de gasto repetidos entre dimensiones de ranking.\nCon un agregado de periodo no diagnostiques fatiga: requiere tendencia temporal comparable, frecuencia válida y deterioro sostenido. No inventes placement, público, formato, landing, cambio creativo, ventas incrementales ni motivo de rendimiento. Error, sync insuficiente y ausencia de actividad son estados distintos de cero. Cuando falten datos, reduce confianza y no propongas acción cuantitativa.\nFormula mantener, investigar o probar una variante como hipótesis que necesita aprobación; jamás pausas anuncios ni escalas presupuesto automáticamente. Explica señal, incertidumbre, gasto afectado, fuente/periodo y cómo se mediría el test. Conserva la guía de marca/conocimiento como contexto, no como métrica.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a23_creatividad_meta_system' and p.version = 'v2'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
where av.is_active
  and av.definition_id = (select id from public.agent_definitions where code = 'a23_creatividad_meta');

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v3', 'claude-sonnet-5', 'a23_creatividad_meta_system', 'v3', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a23_creatividad_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;
