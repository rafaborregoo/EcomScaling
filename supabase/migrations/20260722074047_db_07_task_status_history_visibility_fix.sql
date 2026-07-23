-- DB-07 fix (R-022): reconstruye localmente una migracion aplicada
-- directamente a produccion via MCP el 2026-07-22 que nunca se escribio en
-- este directorio -- drift real entre supabase/migrations/ y el esquema
-- remoto, encontrado al auditar AI-07. Contenido verificado contra la
-- definicion viva de la policy (pg_get_expr) para que coincida exactamente.
--
-- Bug: la policy de select de task_status_history solo comprobaba
-- can_access_org/is_platform_admin/is_assigned_consultant, sin mirar
-- is_visible_to_client de la tarea referenciada -- un cliente podia ver el
-- historial de estado de una tarea que la propia tarea le ocultaba.

drop policy if exists "task_status_history_select_authorized" on public.task_status_history;

create policy "task_status_history_select_authorized"
on public.task_status_history for select to authenticated
using (
  private.can_access_org(organization_id)
  and (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
    or exists (
      select 1 from public.tasks t
      where t.id = task_status_history.task_id
        and t.is_visible_to_client
    )
  )
);
