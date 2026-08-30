-- AI-11: el workspace de campañas también pertenece al owner/manager de la
-- organización. Los consultores asignados y platform_admin mantienen acceso
-- transversal. La creación/edición/aprobación sigue pasando por el API, que
-- aplica la misma frontera de roles antes de usar el service client.

drop policy if exists "marketing_content_drafts_select_consultants"
  on public.marketing_content_drafts;

create policy "marketing_content_drafts_select_workspace"
on public.marketing_content_drafts for select to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
  or private.current_member_role(organization_id) in ('owner', 'manager')
);

drop policy if exists "marketing_content_draft_versions_select_consultants"
  on public.marketing_content_draft_versions;

create policy "marketing_content_draft_versions_select_workspace"
on public.marketing_content_draft_versions for select to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
  or private.current_member_role(organization_id) in ('owner', 'manager')
);

comment on policy "marketing_content_drafts_select_workspace"
  on public.marketing_content_drafts is
  'AI-11: el owner/manager ve los borradores de su organización; consultores asignados y platform_admin mantienen acceso transversal.';

comment on policy "marketing_content_draft_versions_select_workspace"
  on public.marketing_content_draft_versions is
  'AI-11: el owner/manager ve el historial de su organización; consultores asignados y platform_admin mantienen acceso transversal.';
