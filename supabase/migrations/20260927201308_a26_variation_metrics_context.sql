-- A26 v4 consumes stable, store-scoped A/B reporting observations without
-- treating the observations as proof of rendered content or causal lift.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v4',
  p.content || E'\n\nRESULTADOS A/B DE KLAVIYO (A26 v4)\n' ||
  '- Puedes recibir resultados agregados de Reporting API por variacion y mensaje, solo cuando hay datos sincronizados y relacionables con el mensaje muestreado. Son metricas descriptivas, no el HTML de cada variante ni una captura por destinatario.\n' ||
  '- Compara variantes unicamente si comparten campana/mensaje, periodo y metrica. Si faltan variantes, volumen, grupo de control o contexto del experimento, dilo y no declares ganadora.\n' ||
  '- Una diferencia observada NO demuestra que el copy, diseno, color, CTA o estructura la haya causado. No atribuyas incrementos de conversion ni recomiendes replicar una variante como certeza; formula una hipotesis y su siguiente prueba.\n' ||
  '- Los resultados A/B son una fuente distinta del analisis textual/estructural del HTML. Nunca asumas que el cuerpo de la campana es el cuerpo de A o B: la asociacion del contenido de variante sigue incompleta hasta disponer de version/cuerpo verificable por variante.\n' ||
  'Conserva el formato existente y explica las limitaciones en lenguaje claro.',
  encode(sha256('a26_contenido_email_system_v4'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a26_contenido_email_system'
  and p.version = 'v3'
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active
  and definition_id = (select id from public.agent_definitions where code = 'a26_contenido_email');

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode
)
select definition_id, 'v4', model, prompt_code, 'v4', allowed_tools, approval_mode
from public.agent_versions
where definition_id = (select id from public.agent_definitions where code = 'a26_contenido_email')
  and version = 'v3'
on conflict (definition_id, version) do update
set is_active = excluded.is_active, prompt_version = excluded.prompt_version;

do $a26_v4$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a26_contenido_email_system' and version = 'v4'
      and position('RESULTADOS A/B DE KLAVIYO' in content) > 0
  ) or not exists (
    select 1 from public.agent_versions v
    join public.agent_definitions d on d.id = v.definition_id
    where d.code = 'a26_contenido_email' and v.version = 'v4'
      and v.prompt_version = 'v4' and v.is_active
  ) then
    raise exception 'A26_V4_INCOMPLETO: prompt A/B/version activa ausente';
  end if;
end
$a26_v4$;
