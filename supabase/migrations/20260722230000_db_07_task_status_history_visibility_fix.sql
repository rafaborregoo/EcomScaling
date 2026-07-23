-- FE-03 (gap encontrado 2026-07-22 al documentar la matriz de visibilidad):
-- tasks_select_authorized ya oculta tareas internas del consultor
-- (is_visible_to_client = false) a los clientes, pero
-- task_status_history_select_authorized solo comprobaba can_access_org,
-- sin mirar la visibilidad de la tarea referenciada. Un cliente que
-- consultara task_status_history directamente (no via tasks) podia ver
-- previous_status/new_status/reason/changed_by de tareas internas que no
-- deberia ver en absoluto -- mismo criterio que ya se aplica a
-- task_comments (is_internal).
drop policy "task_status_history_select_authorized" on public.task_status_history;

create policy "task_status_history_select_authorized"
on public.task_status_history
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
    or exists (
      select 1
      from public.tasks t
      where t.id = task_status_history.task_id
        and t.is_visible_to_client
    )
  )
);
