-- R-008/RB-008 fix (R-022): reconstruye localmente una migracion aplicada
-- directamente a produccion via MCP el 2026-07-22 que nunca se escribio en
-- este directorio -- mismo drift que el fix de DB-07 de al lado, encontrado
-- al auditar AI-07. Contenido verificado contra la definicion viva de la
-- funcion (pg_get_functiondef) para que coincida exactamente.
--
-- Bug real: purgeExpiredDeletions fallaba en silencio para cualquier
-- organizacion con configuracion financiera. El DELETE en cascada borraba la
-- organizacion antes que sus filas de configuracion financiera en algunos
-- ordenes de ejecucion, y el trigger de auditoria intentaba insertar en
-- audit_logs referenciando un organization_id que ya no existia, violando el
-- FK. Fix: si es un DELETE y la organizacion referenciada ya no existe,
-- omitir el insert de auditoria (no hay nada que auditar sobre datos que se
-- estan borrando en cascada con su organizacion).

create or replace function private.log_financial_change()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if tg_op = 'DELETE' and not exists (
    select 1 from public.organizations o where o.id = old.organization_id
  ) then
    return old;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    tg_table_name || '_' || lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$function$;
