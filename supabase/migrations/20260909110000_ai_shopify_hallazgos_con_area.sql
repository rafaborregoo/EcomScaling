-- A20/A21/A22 v2: los hallazgos de Shopify tambien dicen donde se arreglan.
--
-- Mismo mecanismo que 20260909100000 hizo con los tres de Meta, y por el mismo
-- motivo: el modelo devuelve una CLAVE de una lista cerrada, nunca una URL, y
-- apps/web/src/app/shopify/page.tsx la traduce a un ancla. Una clave que la
-- pantalla no reconozca es inerte -- el hallazgo se dibuja sin enlace.
--
-- `medicion` esta en las tres listas a proposito. Es el unico bloque que puede
-- invalidar lo que los tres analizan: sin costes cargados el margen esta
-- inflado, sin sesiones no hay conversion, sin seguimiento de inventario los
-- agotados no significan nada. Cuando un agente concluya que algo va mal por
-- falta de dato y no por el negocio, ahi es donde hay que ir.
--
-- Idempotente: los prompts v2 se derivan del v1 con `replace` sobre un ancla
-- exacta, `on conflict do nothing`, y las versiones de agente usan
-- `do update set is_active`, nunca `do nothing`.

-- --- 1. Prompts v2 ----------------------------------------------------------

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  replace(
    p.content,
    'Espanol de negocio: nunca cites nombres de campo (repeat_order_rate, p90...), traducelos.',
    'Espanol de negocio: nunca cites nombres de campo (repeat_order_rate, p90...), traducelos. Cada hallazgo lleva ademas `area`: donde se arregla, para que quien lo lea pueda ir. Solo estas claves y escritas tal cual: `clientes` (quien compra y cuanto vale), `cohortes` (quien vuelve mes a mes), `medicion` (lo que puede estar invalidando las cifras). Si ninguna encaja, null. Jamas una URL ni texto libre.'
  ),
  encode(sha256('a20_retencion_clientes_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a20_retencion_clientes_system'
  and p.version = 'v1'
  and position('nunca cites nombres de campo (repeat_order_rate' in p.content) > 0
on conflict (code, version) do nothing;

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  replace(
    p.content,
    'Espanol de negocio, sin nombres de campo.',
    'Espanol de negocio, sin nombres de campo. Cada hallazgo lleva ademas `area`: donde se arregla, para que quien lo lea pueda ir. Solo estas claves y escritas tal cual: `origen` (de donde viene el comprador), `embudo` (cuanta gente entra y cuanta compra), `carritos` (los que llegaron al pago y se fueron), `promociones` (que codigo se uso y que trajo), `medicion` (lo que puede estar invalidando las cifras). Si ninguna encaja, null. Jamas una URL ni texto libre.'
  ),
  encode(sha256('a21_adquisicion_shopify_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a21_adquisicion_shopify_system'
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
    'Espanol de negocio, sin nombres de campo. Cada hallazgo lleva ademas `area`: donde se arregla, para que quien lo lea pueda ir. Solo estas claves y escritas tal cual: `operativa` (plazos de entrega y devoluciones), `ventas` (la cifra de ventas y sus productos), `medicion` (lo que puede estar invalidando las cifras). Si ninguna encaja, null. Jamas una URL ni texto libre.'
  ),
  encode(sha256('a22_postventa_shopify_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a22_postventa_shopify_system'
  and p.version = 'v1'
  and position('Espanol de negocio, sin nombres de campo.' in p.content) > 0
on conflict (code, version) do nothing;

-- --- 2. Versiones de agente -------------------------------------------------

update public.agent_versions
set is_active = false
where is_active
  and definition_id in (
    select id from public.agent_definitions
    where code in (
      'a20_retencion_clientes',
      'a21_adquisicion_shopify',
      'a22_postventa_shopify'
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
    'a20_retencion_clientes',
    'a21_adquisicion_shopify',
    'a22_postventa_shopify'
  )
  and v.version = 'v1'
on conflict (definition_id, version) do update
  set is_active = excluded.is_active,
      prompt_version = excluded.prompt_version;

-- --- 3. Que no quede a medias -----------------------------------------------
--
-- No hay clave ajena entre agent_versions.prompt_version y prompt_versions: un
-- v2 apuntando a un prompt inexistente no falla aqui, falla la proxima vez que
-- alguien ejecute el agente.

do $shopify_areas$
declare
  prompts integer;
  versiones integer;
begin
  select count(*) into prompts
  from public.prompt_versions
  where version = 'v2'
    and code in (
      'a20_retencion_clientes_system',
      'a21_adquisicion_shopify_system',
      'a22_postventa_shopify_system'
    )
    and position('`area`' in content) > 0;

  select count(*) into versiones
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where v.version = 'v2'
    and v.is_active
    and d.code in (
      'a20_retencion_clientes',
      'a21_adquisicion_shopify',
      'a22_postventa_shopify'
    );

  if prompts <> 3 or versiones <> 3 then
    raise exception
      'SHOPIFY_AREAS_INCOMPLETO: % prompts v2 con area y % versiones activas, se esperaban 3 y 3. El ancla del prompt v1 pudo cambiar.',
      prompts, versiones;
  end if;
end
$shopify_areas$;
