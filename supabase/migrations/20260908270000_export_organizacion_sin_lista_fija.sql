-- La exportacion de datos de una organizacion deja de depender de una lista
-- escrita a mano.
--
-- Problema real: `private.export_organization_data` llevaba un array fijo de 60
-- tablas escrito en agosto. Desde entonces se han anadido tablas con datos del
-- cliente que NO estaban en esa lista y por tanto no se exportaban -- entre
-- ellas `klaviyo_tracking_profiles`, `klaviyo_tracking_events` y
-- `klaviyo_tracking_consents`, que contienen datos de los clientes DEL cliente,
-- que es exactamente lo que una exportacion de portabilidad tiene que incluir.
-- Tambien faltaban las de los modulos de Meta y Klaviyo posteriores.
--
-- Anadir los nombres que faltan hoy solo aplaza el problema: la lista se
-- volveria a quedar corta con la siguiente tabla. Asi que el conjunto se deriva:
-- TODA tabla base de `public` con columna `organization_id` es, por definicion,
-- datos de esa organizacion.
--
-- Lo que NO cambia, y es lo importante:
--   - Credentials remain excluded by design: `private.integration_credentials`
--     no se lee nunca. El esquema `private` queda fuera entero.
--   - Solo tablas base: las vistas se derivan de ellas y duplicarian datos.
--   - El filtro sigue siendo `organization_id = p_organization_id`.

create or replace function private.export_organization_data(p_organization_id uuid)
returns jsonb
language plpgsql
set search_path = pg_catalog, public, private
as $$
declare
  current_table_name text;
  table_rows jsonb;
  export_payload jsonb := jsonb_build_object(
    'schema_version', 'v2',
    'organization_id', p_organization_id,
    'exported_at', clock_timestamp(),
    'tables', '{}'::jsonb
  );
begin
  if p_organization_id is null then
    raise exception 'organization_id_required';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization_not_found';
  end if;

  for current_table_name in
    select c.table_name
    from information_schema.columns as c
    join information_schema.tables as t
      on t.table_schema = c.table_schema
     and t.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'organization_id'
      and t.table_type = 'BASE TABLE'
    order by c.table_name
  loop
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(row)), ''[]''::jsonb) from public.%I row where row.organization_id = $1',
      current_table_name
    )
    into table_rows
    using p_organization_id;

    export_payload := jsonb_set(
      export_payload,
      array['tables', current_table_name],
      table_rows
    );
  end loop;

  -- `organizations` no tiene columna organization_id: es la fila raiz y se
  -- anade aparte para que la exportacion sea legible por si sola.
  select coalesce(jsonb_agg(to_jsonb(row)), '[]'::jsonb)
  into table_rows
  from public.organizations row
  where row.id = p_organization_id;

  export_payload := jsonb_set(
    export_payload,
    array['tables', 'organizations'],
    table_rows
  );

  return export_payload;
end;
$$;

comment on function private.export_organization_data is
  'Exportacion de portabilidad de una organizacion. El conjunto de tablas se DERIVA (toda tabla base de public con organization_id) en vez de mantenerse a mano, que es como se quedo corta. Credentials remain excluded by design: el esquema private no se lee.';
