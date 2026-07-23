-- BE-07/AI-03: agent_sql_gateway ya fijaba statement_timeout (8s) pero no
-- lock_timeout -- una consulta que espera un lock (ej. contra una tabla
-- bloqueada por una migracion o un UPDATE largo en curso) podia quedar
-- esperando fuera del presupuesto de 8s pensado para el propio calculo.
-- 3s es deliberadamente mas corto que statement_timeout: si hay que esperar
-- un lock, es preferible fallar rapido y que el agente reintente.
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
  perform set_config('lock_timeout', '3000', true);

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
