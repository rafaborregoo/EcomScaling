-- Rafa (2026-10-16): se quita el gate de release de agentes. Exigia 10 casos
-- gold + 3 holdout de produccion para activar cualquier version, y sin tiendas
-- cliente en PROD bloqueaba todo (A04 v12/v13, A06, el futuro A29).
--
-- Se quita solo el bloqueo: las evaluaciones, los manifiestos inmutables y
-- `agent_version_has_release_evidence` siguen existiendo, asi que volver a
-- exigir evidencia es recrear el trigger y el `if` de abajo (migracion
-- 20261213090000). Activar sigue pasando por `promote_agent_version`, que
-- desactiva la version anterior en la misma transaccion.

drop trigger if exists agent_versions_release_evidence_required on public.agent_versions;

create or replace function public.promote_agent_version(p_agent_version_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_definition_id uuid;
begin
  select definition_id into v_definition_id
  from public.agent_versions
  where id = p_agent_version_id
  for update;

  if v_definition_id is null then
    raise exception using errcode = 'P0002', message = 'agent_release_gate:candidate_not_found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_definition_id::text, 0));

  update public.agent_versions
  set is_active = false
  where definition_id = v_definition_id and is_active is true and id <> p_agent_version_id;

  update public.agent_versions
  set is_active = true
  where id = p_agent_version_id;
end;
$$;

revoke all on function public.promote_agent_version(uuid) from public, anon, authenticated;
grant execute on function public.promote_agent_version(uuid) to service_role;

comment on function public.promote_agent_version(uuid) is
  'Activa una version de agente y desactiva la anterior en la misma transaccion. Sin gate de evidencia desde 20261226100000 (decision de Rafa 2026-10-16); las evaluaciones siguen registrandose pero no bloquean.';
