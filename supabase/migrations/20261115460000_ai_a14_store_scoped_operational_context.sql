-- A14's selected-store diagnosis must only use that store's plan and tasks.

insert into public.prompt_versions (code, version, content, checksum)
select
  p.code,
  'v2',
  p.content || E'\n\nALCANCE MULTITIENDA (OBLIGATORIO): cuando el contexto sea de una tienda, el gasto Meta y las finanzas son de esa misma tienda. El Camino mostrado pertenece solo a esa tienda; si no existe, no tomes fases de otro plan. Las tareas sin tienda asignada son legacy/organizativas y solo sirven para evitar duplicados, no prueban una necesidad de esta tienda. Las alertas no tienen tienda atribuida: son contexto organizativo, nunca evidencia de un problema Meta específico. Las cuentas sin tienda asignada se muestran aparte; su gasto no está incluido en el corte de la tienda y su ausencia no significa gasto cero. Si una consulta devuelve status unavailable, trátala como desconocida y no como cero. En modo agregado, no afirmes que las métricas pertenecen a una sola tienda.',
  encode(sha256('a14_operativa_meta_system_v2'::bytea), 'hex')
from public.prompt_versions p
where p.code = 'a14_operativa_meta_system'
  and p.version = 'v1'
on conflict (code, version) do nothing;

update public.agent_versions
set is_active = false
where is_active
  and definition_id in (
    select id from public.agent_definitions where code = 'a14_operativa_meta'
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
where d.code = 'a14_operativa_meta'
  and v.version = 'v1'
on conflict (definition_id, version) do update
  set is_active = excluded.is_active,
      prompt_version = excluded.prompt_version;

do $a14_scope$
declare
  prompt_count integer;
  active_count integer;
begin
  select count(*) into prompt_count
  from public.prompt_versions
  where code = 'a14_operativa_meta_system'
    and version = 'v2'
    and position('Las alertas no tienen tienda atribuida' in content) > 0;

  select count(*) into active_count
  from public.agent_versions v
  join public.agent_definitions d on d.id = v.definition_id
  where d.code = 'a14_operativa_meta'
    and v.version = 'v2'
    and v.prompt_version = 'v2'
    and v.is_active;

  if prompt_count <> 1 or active_count <> 1 then
    raise exception 'AI_A14_STORE_SCOPE_INCOMPLETE: prompt %, active agent versions %', prompt_count, active_count;
  end if;
end
$a14_scope$;
