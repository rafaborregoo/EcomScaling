-- DB-01: helper de solo lectura para que los tests puedan verificar que un
-- enum no gano/perdio valores sin una migracion explicita (criterio de cierre
-- pendiente: "no hay tests que verifiquen los valores existentes"). No expone
-- datos de negocio, solo metadatos de tipo -- pero igual se restringe a
-- service_role (no anon/authenticated) porque es informacion de esquema
-- interna, no una necesidad de la app.
create or replace function private.enum_labels(enum_type_name text)
returns text[]
language plpgsql
stable
security invoker
as $$
declare
  result text[];
begin
  execute format('select enum_range(null::public.%I)::text[]', enum_type_name) into result;
  return result;
end;
$$;

revoke all on function private.enum_labels(text) from public;
revoke all on function private.enum_labels(text) from anon;
revoke all on function private.enum_labels(text) from authenticated;
grant execute on function private.enum_labels(text) to service_role;
