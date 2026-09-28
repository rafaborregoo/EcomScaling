-- A26 v5 can receive opt-in campaign-variation metadata from Klaviyo's beta API.
-- It must distinguish an observed template sync from the exact delivered email.
insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v5',
  p.content || E'\n\nCONTENIDO POR VARIANTE (A26 v5)\n' ||
  '- Solo analiza variantes de contenido cuando aparezca el bloque variantes_de_contenido. Cada asunto, preheader o cuerpo pertenece unicamente a la variacion identificada en ese bloque; no lo atribuyas a las otras variantes ni al cuerpo padre.\n' ||
  '- El cuerpo puede proceder de una plantilla sincronizada actualmente. Lee procedencia_del_cuerpo: si no confirma una instantanea historica coincidente, describe el cuerpo como observacion de plantilla, nunca como copia exacta del email enviado/recibido.\n' ||
  '- Si falta template_id o cuerpo, no reconstruyas ni inventes el contenido de la variante. Analiza solo el asunto/preheader disponibles y explica la limitacion.\n' ||
  '- El campo cuerpo puede ser un extracto acotado que conserva apertura y tramo final con una marca de omision; si cuerpo_cortado es true, no lo describas como el texto completo. Usa tambien enlaces y analisis_html, que se extraen de una fuente limitada por tamano.\n' ||
  '- Los resultados A/B y el analisis de contenido son evidencias separadas. No deduzcas causalidad ni declares ganadora por diferencias descriptivas; propone hipotesis verificables.\n' ||
  'Conserva el formato existente y expresa la incertidumbre sin tecnicismos innecesarios.',
  encode(sha256('a26_contenido_email_system_v5'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a26_contenido_email_system'
  and p.version = 'v4'
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active
  and definition_id = (select id from public.agent_definitions where code = 'a26_contenido_email');

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode
)
select definition_id, 'v5', model, prompt_code, 'v5', allowed_tools, approval_mode
from public.agent_versions
where definition_id = (select id from public.agent_definitions where code = 'a26_contenido_email')
  and version = 'v4'
on conflict (definition_id, version) do update
set is_active = excluded.is_active, prompt_version = excluded.prompt_version;

do $a26_v5$
begin
  if not exists (
    select 1 from public.prompt_versions
    where code = 'a26_contenido_email_system' and version = 'v5'
      and position('CONTENIDO POR VARIANTE' in content) > 0
  ) or not exists (
    select 1 from public.agent_versions v
    join public.agent_definitions d on d.id = v.definition_id
    where d.code = 'a26_contenido_email' and v.version = 'v5'
      and v.prompt_version = 'v5' and v.is_active
  ) then
    raise exception 'A26_V5_INCOMPLETO: prompt por variante/version activa ausente';
  end if;
end
$a26_v5$;
