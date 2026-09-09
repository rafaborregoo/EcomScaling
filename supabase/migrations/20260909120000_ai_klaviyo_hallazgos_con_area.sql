-- A26/A12 v2: los hallazgos de Klaviyo dicen donde se arreglan. Cierra el
-- patron que 20260909100000 (Meta) y 20260909110000 (Shopify) ya aplicaron.
--
-- Mismo mecanismo: clave de una lista cerrada, nunca una URL; la traduce
-- apps/web/src/app/klaviyo/page.tsx a un ancla. Clave desconocida = hallazgo
-- sin enlace, que es como se dibujaba hasta ahora.
--
-- Dos diferencias con los otros modulos, ambas deliberadas:
--
-- 1. A26 NO tiene `rendimiento`. Ese agente lee asuntos, cuerpos y enlaces; su
--    prompt le prohibe expresamente juzgar con cifras que no recibe ("Aqui no
--    tienes rendimiento... una hipotesis a comprobar, no un dato"). Darle el
--    area le dejaria mandar al lector a una tabla que no ha mirado.
--
-- 2. A12 no sigue el formato de 9 secciones: su prompt es un bloque unico. El
--    ancla es su frase sobre el lenguaje, que es donde ya viven las reglas de
--    salida.
--
-- Idempotente: `replace` sobre un ancla exacta, `on conflict do nothing`, y las
-- versiones de agente con `do update set is_active`, nunca `do nothing`.

-- --- 1. Prompts v2 ----------------------------------------------------------

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  replace(
    p.content,
    'Espanol de negocio: nunca cites nombres de campo (adds_utm, preview_text...), traducelos.',
    'Espanol de negocio: nunca cites nombres de campo (adds_utm, preview_text...), traducelos. Cada hallazgo lleva ademas `area`: donde se arregla, para que quien lo lea pueda ir. Solo estas claves y escritas tal cual: `emails` (el asunto, el cuerpo o los enlaces de una pieza concreta), `medicion` (el etiquetado de enlaces y lo que hace invisible el efecto). Si ninguna encaja, null. Jamas una URL ni texto libre. No existe un area de rendimiento: tu no recibes esas cifras.'
  ),
  encode(sha256('a26_contenido_email_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a26_contenido_email_system'
  and p.version = 'v1'
  and position('nunca cites nombres de campo (adds_utm' in p.content) > 0
on conflict (code, version) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  replace(
    p.content,
    'nunca cites nombres de campo (flow_share_pct, open_rate...); traducelos.',
    'nunca cites nombres de campo (flow_share_pct, open_rate...); traducelos. Cada hallazgo lleva ademas `area`: donde se arregla, para que quien lo lea pueda ir. Solo estas claves y escritas tal cual: `rendimiento` (las cifras por envio y por asunto), `emails` (que emails existen y que dicen), `medicion` (el etiquetado de enlaces y lo que hace invisible el efecto). Si ninguna encaja, null. Jamas una URL ni texto libre.'
  ),
  encode(sha256('a12_analista_email_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a12_analista_email_system'
  and p.version = 'v1'
  and position('nunca cites nombres de campo (flow_share_pct' in p.content) > 0
on conflict (code, version) do nothing;

-- --- 2. Versiones de agente -------------------------------------------------

update public.agent_versions
set is_active = false
where is_active
  and definition_id in (
    select id from public.agent_definitions
    where code in ('a26_contenido_email', 'a12_analista_email')
  );

insert into public.agent_versions (
  definition_id, version, model, prompt_code, prompt_version,
  allowed_tools, approval_mode
)
select
  v.definition_id, 'v2', v.model, v.prompt_code, 'v2',
  v.allowed_tools, v.approval_mode
from public.agent_versions v
join public.agent_definitions d on d.id = v.definition_id
where d.code in ('a26_contenido_email', 'a12_analista_email')
  and v.version = 'v1'
on conflict (definition_id, version) do update
  set is_active = excluded.is_active,
      prompt_version = excluded.prompt_version;

-- --- 3. Que no quede a medias -----------------------------------------------

do $klaviyo_areas$
declare
  prompts integer;
  versiones integer;
begin
  select count(*) into prompts
  from public.prompt_versions
  where version = 'v2'
    and code in ('a26_contenido_email_system', 'a12_analista_email_system')
    and position('`area`' in content) > 0;

  select count(*) into versiones
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where v.version = 'v2'
    and v.is_active
    and d.code in ('a26_contenido_email', 'a12_analista_email');

  if prompts <> 2 or versiones <> 2 then
    raise exception
      'KLAVIYO_AREAS_INCOMPLETO: % prompts v2 con area y % versiones activas, se esperaban 2 y 2. El ancla del prompt v1 pudo cambiar.',
      prompts, versiones;
  end if;
end
$klaviyo_areas$;
