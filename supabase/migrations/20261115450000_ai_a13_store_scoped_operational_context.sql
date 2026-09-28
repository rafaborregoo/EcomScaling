-- A13 must not attribute organization-wide backlog, alerts, or other stores'
-- Camino phases to the currently selected Shopify store.

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  p.content || E'\n\nALCANCE MULTITIENDA (OBLIGATORIO): el backend excluye tareas de otras tiendas y separa las tareas de esta tienda de tareas antiguas sin tienda asignada. Las tareas sin atribucion solo sirven para evitar duplicados; no son prueba de un problema de esta tienda. Las fases recibidas en una vista de tienda pertenecen al Camino de esa misma tienda; si no hay Camino, no tomes fases de otro. Las alertas actuales son organizativas y no tienen tienda atribuida: puedes usarlas como contexto general, pero nunca como evidencia de una condicion Shopify concreta ni como justificacion de una tarea para esta tienda. Si un bloque llega con status unavailable, no lo interpretes como lista vacia. En el modo agregado, conserva el alcance de organizacion y declara la falta de atribucion cuando afecte a la conclusion.',
  encode(sha256('a13_operativa_shopify_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a13_operativa_shopify_system'
  and p.version = 'v1'
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active
  and definition_id in (
    select id from public.agent_definitions where code = 'a13_operativa_shopify'
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
where d.code = 'a13_operativa_shopify'
  and v.version = 'v1'
on conflict (definition_id, version) do update
  set is_active = excluded.is_active,
      prompt_version = excluded.prompt_version;

do $a13_scope$
declare
  prompt_count integer;
  active_count integer;
begin
  select count(*) into prompt_count
  from public.prompt_versions
  where code = 'a13_operativa_shopify_system'
    and version = 'v2'
    and position('Las alertas actuales son organizativas y no tienen tienda atribuida' in content) > 0;

  select count(*) into active_count
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a13_operativa_shopify'
    and v.version = 'v2'
    and v.prompt_version = 'v2'
    and v.is_active;

  if prompt_count <> 1 or active_count <> 1 then
    raise exception 'AI_A13_STORE_SCOPE_INCOMPLETE: prompt %, active agent versions %', prompt_count, active_count;
  end if;
end
$a13_scope$;
