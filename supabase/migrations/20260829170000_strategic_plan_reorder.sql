-- Mi Camino: reordenar fases e hitos por drag & drop.
--
-- strategic_plan_phases y strategic_plan_milestones tienen unique
-- (plan_id, position) / (phase_id, position), asi que un UPDATE masa a las
-- nuevas posiciones colisiona a mitad de camino. Estas funciones apartan
-- primero todas las filas del padre a un rango alto y luego asignan la
-- posicion final segun el orden recibido, en una sola transaccion.
--
-- volatile (escriben) y security invoker (default): la API las llama con el
-- service client tras comprobar assertCanManagePlan, y el propio wrapper
-- valida que el plan/fase pertenece a la organizacion.

create or replace function public.reorder_strategic_phases(
  p_plan_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
as $$
begin
  if array_length(p_ordered_ids, 1) is distinct from (
    select count(*) from public.strategic_plan_phases where plan_id = p_plan_id
  ) then
    raise exception 'reorder_strategic_phases: el orden debe cubrir todas las fases del plan';
  end if;

  update public.strategic_plan_phases
    set position = position + 1000000
    where plan_id = p_plan_id;

  update public.strategic_plan_phases p
    set position = ord.idx
    from (
      select unnest(p_ordered_ids) as id,
             generate_subscripts(p_ordered_ids, 1) as idx
    ) ord
    where p.id = ord.id and p.plan_id = p_plan_id;
end;
$$;

create or replace function public.reorder_strategic_milestones(
  p_phase_id uuid,
  p_ordered_ids uuid[]
)
returns void
language plpgsql
as $$
begin
  if array_length(p_ordered_ids, 1) is distinct from (
    select count(*) from public.strategic_plan_milestones where phase_id = p_phase_id
  ) then
    raise exception 'reorder_strategic_milestones: el orden debe cubrir todos los hitos de la fase';
  end if;

  update public.strategic_plan_milestones
    set position = position + 1000000
    where phase_id = p_phase_id;

  update public.strategic_plan_milestones m
    set position = ord.idx
    from (
      select unnest(p_ordered_ids) as id,
             generate_subscripts(p_ordered_ids, 1) as idx
    ) ord
    where m.id = ord.id and m.phase_id = p_phase_id;
end;
$$;

comment on function public.reorder_strategic_phases(uuid, uuid[]) is
  'Mi Camino: fija position de las fases de un plan segun el array ordenado de ids. Llamar via .rpc() con service client tras assertCanManagePlan.';
comment on function public.reorder_strategic_milestones(uuid, uuid[]) is
  'Mi Camino: fija position de los hitos de una fase segun el array ordenado de ids. Llamar via .rpc() con service client tras assertCanManagePlan.';
