-- A23 turns descriptive rankings into cautious, evidence-bound investigations.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v7',
  p.content || E'\n\n14. FUERZA DE LA EVIDENCIA Y ACCION\nEl reparto de gasto por ranking usa el ultimo veredicto vigente de Meta para el anuncio; no significa que Meta lo juzgara asi durante cada dia o euro del periodo. Los umbrales de volumen (incluidas 1000 impresiones) solo habilitan una tasa descriptiva y no demuestran significancia, potencia estadistica, ganador ni perdedor. `video_plays / impressions` es un proxy de inicios de reproduccion, no una visualizacion de 3 segundos; no lo llames hook probado ni compares formatos distintos. La RPC actual no trae desglose de formato ni placement: si no estan disponibles en otras pruebas verificables, no segmentes ni sugieras que comparaste esas dimensiones.\nAntes de recomendar una accion economica, contrasta el gasto/ROAS y break-even de A14 y el estado/fecha del veredicto de medicion A24. Si el gate A24 es `unknown`, `not_assessable` o restrictivo, puedes describir alcance, clics y gasto observados, pero no fundamentes una pausa/escalado en compras o ROAS no fiables.\nClasifica la salida como mantener/seguir observando, probar una variante, investigar oferta/landing, o proponer pausa para aprobacion humana; cada recomendacion cita señal, ventana, gasto implicado cuando exista, incertidumbre, hipotesis y criterio de exito. No declares ganador por ranking o ROAS aislado y nunca pauses anuncios ni escales presupuesto automaticamente.',
  encode(sha256((p.content || E'\n\n14. FUERZA DE LA EVIDENCIA Y ACCION\nEl reparto de gasto por ranking usa el ultimo veredicto vigente de Meta para el anuncio; no significa que Meta lo juzgara asi durante cada dia o euro del periodo. Los umbrales de volumen (incluidas 1000 impresiones) solo habilitan una tasa descriptiva y no demuestran significancia, potencia estadistica, ganador ni perdedor. `video_plays / impressions` es un proxy de inicios de reproduccion, no una visualizacion de 3 segundos; no lo llames hook probado ni compares formatos distintos. La RPC actual no trae desglose de formato ni placement: si no estan disponibles en otras pruebas verificables, no segmentes ni sugieras que comparaste esas dimensiones.\nAntes de recomendar una accion economica, contrasta el gasto/ROAS y break-even de A14 y el estado/fecha del veredicto de medicion A24. Si el gate A24 es `unknown`, `not_assessable` o restrictivo, puedes describir alcance, clics y gasto observados, pero no fundamentes una pausa/escalado en compras o ROAS no fiables.\nClasifica la salida como mantener/seguir observando, probar una variante, investigar oferta/landing, o proponer pausa para aprobacion humana; cada recomendacion cita señal, ventana, gasto implicado cuando exista, incertidumbre, hipotesis y criterio de exito. No declares ganador por ranking o ROAS aislado y nunca pauses anuncios ni escales presupuesto automaticamente.')::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a23_creatividad_meta_system' and p.version = 'v6'
on conflict (code, version) do update
set content = excluded.content, checksum = excluded.checksum;

update public.agent_versions av
set is_active = false
from public.agent_definitions d
where av.definition_id = d.id
  and av.is_active
  and d.code = 'a23_creatividad_meta';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select d.id, 'v7', source.model, 'a23_creatividad_meta_system', 'v7', source.allowed_tools, source.approval_mode
from public.agent_definitions d
join public.agent_versions source on source.definition_id = d.id and source.version = 'v6'
where d.code = 'a23_creatividad_meta'
on conflict (definition_id, version) do update
set prompt_code = excluded.prompt_code,
    prompt_version = excluded.prompt_version,
    allowed_tools = excluded.allowed_tools,
    approval_mode = excluded.approval_mode,
    is_active = true;

do $a23_v7_guard$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a23_creatividad_meta_system' and version = 'v7'
      and position('no demuestran significancia' in content) > 0
      and position('veredicto vigente de Meta' in content) > 0
  ) or not exists (
    select 1 from public.agent_versions av
    join public.agent_definitions d on d.id = av.definition_id
    where d.code = 'a23_creatividad_meta' and av.version = 'v7'
      and av.prompt_version = 'v7' and av.is_active
  ) then
    raise exception 'A23_V7_PROMPT_OR_ACTIVE_VERSION_MISSING';
  end if;
end
$a23_v7_guard$;
