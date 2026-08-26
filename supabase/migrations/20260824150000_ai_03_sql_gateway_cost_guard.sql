-- AI-03: evita ejecutar consultas de coste estimado desproporcionado.
-- EXPLAIN sin ANALYZE solo planifica: no ejecuta la consulta ni sus funciones.
-- El API sigue validando AST, allowlist y tenant antes de llegar a esta RPC.

create or replace function public.agent_sql_gateway(
  target_organization_id uuid,
  query_sql text,
  max_rows integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, ai
as $$
declare
  result jsonb;
  plan jsonb;
  estimated_total_cost numeric;
  effective_rows integer := least(greatest(coalesce(max_rows, 200), 1), 500);
  max_estimated_cost constant numeric := 100000;
begin
  perform set_config('app.gateway_org_id', target_organization_id::text, true);
  perform set_config('search_path', 'ai, pg_catalog', true);
  perform set_config('statement_timeout', '8000', true);

  execute format(
    'explain (format json, costs true) select * from (%s) gateway_inner',
    query_sql
  ) into plan;

  estimated_total_cost := nullif(
    plan->0->'Plan'->>'Total Cost',
    ''
  )::numeric;

  if coalesce(estimated_total_cost, 0) > max_estimated_cost then
    return jsonb_build_object(
      'error', 'estimated_query_cost_exceeded',
      'estimated_cost', estimated_total_cost,
      'max_estimated_cost', max_estimated_cost
    );
  end if;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(gateway_row)), ''[]''::jsonb)
     from (select * from (%s) gateway_inner limit %s) gateway_row',
    query_sql,
    effective_rows
  ) into result;

  return jsonb_build_object(
    'rows', result,
    'row_limit', effective_rows,
    'estimated_cost', estimated_total_cost
  );
exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$$;

revoke all on function public.agent_sql_gateway(uuid, text, integer) from public;
revoke all on function public.agent_sql_gateway(uuid, text, integer) from anon;
revoke all on function public.agent_sql_gateway(uuid, text, integer) from authenticated;
grant execute on function public.agent_sql_gateway(uuid, text, integer) to service_role;

comment on function public.agent_sql_gateway is
  'Ejecuta SELECT validado por el API con tenant forzado, timeout, limite de filas y guard de coste EXPLAIN sin ANALYZE. Solo service_role.';
