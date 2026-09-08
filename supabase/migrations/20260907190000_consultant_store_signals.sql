-- La ultima salida de cada agente para cada cliente de la cartera, en una sola
-- consulta.
--
-- `distinct on` y no "ordenar por fecha y coger los primeros N": ordenando la
-- cartera entera por fecha, las N primeras filas pueden ser todas del mismo
-- cliente y los demas se quedan sin senal, apareciendo como "sin analizar"
-- cuando si lo estaban. Es el mismo error que ya se colo una vez en el aviso de
-- frescura de integraciones.
--
-- ADR-0006 pto 6: `stable`, sin `security definer`. La RLS de agent_runs y
-- agent_outputs sigue mandando, asi que un consultor solo ve las salidas de las
-- organizaciones a las que ya tiene acceso; el array de entrada es un filtro,
-- no la autorizacion.

drop function if exists public.consultant_store_signals(uuid[], text[]);
create or replace function public.consultant_store_signals(
  target_organization_ids uuid[],
  agent_codes text[]
)
returns table (
  organization_id uuid,
  agent_code text,
  ran_at timestamptz,
  output jsonb
)
language sql
stable
as $$
  select distinct on (r.organization_id, d.code)
    r.organization_id,
    d.code::text as agent_code,
    r.started_at as ran_at,
    o.output
  from public.agent_runs r
  join public.agent_versions v on v.id = r.agent_version_id
  join public.agent_definitions d on d.id = v.definition_id
  join public.agent_outputs o on o.run_id = r.id
  where r.organization_id = any(target_organization_ids)
    and d.code = any(agent_codes)
    and r.status = 'succeeded'
    -- Solo los runs de "toda la organizacion". Un run de una tienda concreta
    -- describe esa tienda, no al cliente, y mezclarlos daria un ranking que
    -- cambia segun que tienda se miro por ultima vez.
    and r.store_id is null
  order by r.organization_id, d.code, r.started_at desc;
$$;

-- El predicado real es (organization_id, status) filtrando por fecha dentro de
-- cada grupo: sin este indice, la cartera entera de agent_runs se recorre en
-- cada carga de la vista general.
create index if not exists agent_runs_org_started_idx
  on public.agent_runs (organization_id, started_at desc)
  where status = 'succeeded';

grant execute on function public.consultant_store_signals(uuid[], text[]) to authenticated;
