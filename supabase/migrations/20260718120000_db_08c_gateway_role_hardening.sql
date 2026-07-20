-- DB-08c / AI-03: defensa en profundidad del SQL Gateway.
-- La validacion AST en Node ya rechaza referencias cualificadas fuera de `ai`,
-- pero la funcion ejecutaba la consulta como service_role, que puede leer
-- cualquier tabla. Ahora la consulta corre bajo el rol `ai_gateway`, que solo
-- tiene USAGE sobre el esquema ai y SELECT sobre sus vistas: una referencia a
-- public.* o private.* falla con permission denied aunque la validacion
-- fallara. Las vistas siguen resolviendo sus tablas base con los privilegios
-- de su owner, por lo que el filtro de tenant embebido sigue intacto.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_gateway') then
    create role ai_gateway nologin;
  end if;
end
$$;

grant usage on schema ai to ai_gateway;
grant select on all tables in schema ai to ai_gateway;
alter default privileges in schema ai grant select on tables to ai_gateway;

-- Permite a la funcion (invocada por service_role) hacer SET LOCAL ROLE.
grant ai_gateway to service_role;

create or replace function public.agent_sql_gateway(
  target_organization_id uuid,
  query_sql text,
  max_rows integer default 200
)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
  effective_rows integer := least(greatest(coalesce(max_rows, 200), 1), 500);
begin
  perform set_config('app.gateway_org_id', target_organization_id::text, true);
  perform set_config('search_path', 'ai', true);
  perform set_config('statement_timeout', '8000', true);
  execute 'set local role ai_gateway';

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(gateway_row)), ''[]''::jsonb)
     from (select * from (%s) gateway_inner limit %s) gateway_row',
    query_sql,
    effective_rows
  )
  into result;

  return jsonb_build_object('rows', result, 'row_limit', effective_rows);
exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$$;
