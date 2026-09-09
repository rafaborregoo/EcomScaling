-- A23/A24/A25 v2: cada hallazgo dice DONDE se arregla.
--
-- El problema que resuelve: un hallazgo es texto. "El pixel lleva tres dias sin
-- disparar" se lee, se asiente, y no lleva a ningun sitio. La pantalla de Meta
-- tiene el bloque donde eso se ve, pero el usuario tiene que encontrarlo solo.
--
-- La solucion NO es que el modelo escriba el enlace: se inventaria rutas, y las
-- que acertara hoy quedarian muertas en silencio al renombrar una pagina. En su
-- lugar devuelve una CLAVE de una lista cerrada que enumera este prompt, y
-- apps/web/src/app/meta/page.tsx la traduce a un ancla concreta. Una clave que
-- la pantalla no reconozca es inerte: el hallazgo se dibuja sin enlace, como
-- hasta ahora. Por eso tampoco se valida contra ningun conjunto en el backend
-- -- la lista es distinta por agente y no merece tumbar una salida util.
--
-- El campo `area` viaja en el contrato comun (packages/ai): requerido y
-- nulable, como `period` en sources. Los demas agentes, cuyo prompt no enumera
-- claves, devuelven null y no cambian de comportamiento.
--
-- Idempotente: los prompts v2 se derivan del v1 con `replace` sobre un ancla
-- exacta, `on conflict do nothing`, y las versiones de agente usan
-- `do update set is_active` -- nunca `do nothing`, que sobre una base que ya
-- tenia la fila desactivaria la vieja sin reactivar la nueva y dejaria al
-- agente sin ninguna version activa.

-- --- 1. Prompts v2 ----------------------------------------------------------
--
-- Se derivan del contenido v1 en vez de reescribirlo entero: copiar 50 lineas
-- de prompt a mano es como se cuelan las diferencias que nadie ve luego en el
-- diff. El `where position(...) > 0` evita insertar un v2 identico al v1 si el
-- ancla se movio; el bloque de comprobacion del final convierte eso en un
-- error ruidoso en vez de un agente que calla.

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  replace(
    p.content,
    'Espanol de negocio: nunca cites nombres de campo (hook_rate, quality_ranking...), traducelos.',
    'Espanol de negocio: nunca cites nombres de campo (hook_rate, quality_ranking...), traducelos. Cada hallazgo lleva ademas `area`: donde se arregla, para que quien lo lea pueda ir. Solo estas claves y escritas tal cual: `creatividades` (la pieza concreta), `reparto` (a que se esta yendo el presupuesto), `general` (la cifra de cabecera de la cuenta). Si ninguna encaja, null. Jamas una URL ni texto libre.'
  ),
  encode(sha256('a23_creatividad_meta_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a23_creatividad_meta_system'
  and p.version = 'v1'
  and position('nunca cites nombres de campo (hook_rate' in p.content) > 0
on conflict (code, version) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  replace(
    p.content,
    'Espanol de negocio, sin nombres de campo.',
    'Espanol de negocio, sin nombres de campo. Cada hallazgo lleva ademas `area`: donde se arregla, para que quien lo lea pueda ir. Solo estas claves y escritas tal cual: `medicion` (el pixel y sus eventos), `aprendizaje` (conjuntos que aun no salen de la fase), `general` (la cifra de cabecera de la cuenta). Si ninguna encaja, null. Jamas una URL ni texto libre.'
  ),
  encode(sha256('a24_medicion_meta_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a24_medicion_meta_system'
  and p.version = 'v1'
  and position('Espanol de negocio, sin nombres de campo.' in p.content) > 0
on conflict (code, version) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  replace(
    p.content,
    'Espanol de negocio, sin nombres de campo.',
    'Espanol de negocio, sin nombres de campo. Cada hallazgo lleva ademas `area`: donde se arregla, para que quien lo lea pueda ir. Solo estas claves y escritas tal cual: `cambios` (que se toco y que paso despues), `publicos` (los publicos de la cuenta), `general` (la cifra de cabecera de la cuenta). Si ninguna encaja, null. Jamas una URL ni texto libre.'
  ),
  encode(sha256('a25_cambios_meta_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a25_cambios_meta_system'
  and p.version = 'v1'
  and position('Espanol de negocio, sin nombres de campo.' in p.content) > 0
on conflict (code, version) do nothing;

-- --- 2. Versiones de agente -------------------------------------------------
--
-- Se copian del v1 (modelo, tools, modo de aprobacion) cambiando solo la
-- version del prompt: si manana cambian las tools del v1, este bloque no se
-- queda con una copia vieja escrita a mano.

update public.agent_versions
set is_active = false
where is_active
  and definition_id in (
    select id from public.agent_definitions
    where code in (
      'a23_creatividad_meta',
      'a24_medicion_meta',
      'a25_cambios_meta'
    )
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
where d.code in (
    'a23_creatividad_meta',
    'a24_medicion_meta',
    'a25_cambios_meta'
  )
  and v.version = 'v1'
on conflict (definition_id, version) do update
  set is_active = excluded.is_active,
      prompt_version = excluded.prompt_version;

-- --- 3. Que no quede a medias -----------------------------------------------
--
-- No hay clave ajena entre agent_versions.prompt_version y prompt_versions: un
-- v2 de agente apuntando a un prompt que no existe no falla aqui, falla en la
-- cara del usuario la proxima vez que ejecute el agente. Se comprueba.

do $meta_areas$
declare
  prompts integer;
  versiones integer;
begin
  select count(*) into prompts
  from public.prompt_versions
  where version = 'v2'
    and code in (
      'a23_creatividad_meta_system',
      'a24_medicion_meta_system',
      'a25_cambios_meta_system'
    )
    and position('`area`' in content) > 0;

  select count(*) into versiones
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where v.version = 'v2'
    and v.is_active
    and d.code in (
      'a23_creatividad_meta',
      'a24_medicion_meta',
      'a25_cambios_meta'
    );

  if prompts <> 3 or versiones <> 3 then
    raise exception
      'META_AREAS_INCOMPLETO: % prompts v2 con area y % versiones activas, se esperaban 3 y 3. El ancla del prompt v1 pudo cambiar.',
      prompts, versiones;
  end if;
end
$meta_areas$;
