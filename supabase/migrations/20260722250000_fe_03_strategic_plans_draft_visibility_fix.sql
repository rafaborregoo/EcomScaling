-- FE-03: `strategic_plans`/`_phases`/`_milestones`/`milestone_task_links` no
-- distinguian por `status` -- un plan en `draft` (no presentado/aprobado
-- todavia para el cliente) era visible igual que uno `active`, mismo patron
-- de gap que ya se habia corregido en `task_status_history` (ver DB-07 fix,
-- 2026-07-22). Se cierra con el mismo criterio que `tasks`/`task_comments`:
-- platform_admin y consultor asignado ven todo; el cliente solo ve planes
-- que ya salieron de `draft`.

drop policy if exists "strategic_plans_select_authorized" on public.strategic_plans;

create policy "strategic_plans_select_authorized"
on public.strategic_plans
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    status != 'draft'
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

drop policy if exists "strategic_plan_phases_select_authorized" on public.strategic_plan_phases;

create policy "strategic_plan_phases_select_authorized"
on public.strategic_plan_phases
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
    or exists (
      select 1 from public.strategic_plans p
      where p.id = strategic_plan_phases.plan_id
        and p.status != 'draft'
    )
  )
);

drop policy if exists "strategic_plan_milestones_select_authorized" on public.strategic_plan_milestones;

create policy "strategic_plan_milestones_select_authorized"
on public.strategic_plan_milestones
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
    or exists (
      select 1 from public.strategic_plan_phases ph
      join public.strategic_plans p on p.id = ph.plan_id
      where ph.id = strategic_plan_milestones.phase_id
        and p.status != 'draft'
    )
  )
);

drop policy if exists "milestone_task_links_select_authorized" on public.milestone_task_links;

create policy "milestone_task_links_select_authorized"
on public.milestone_task_links
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
    or exists (
      select 1 from public.strategic_plan_milestones m
      join public.strategic_plan_phases ph on ph.id = m.phase_id
      join public.strategic_plans p on p.id = ph.plan_id
      where m.id = milestone_task_links.milestone_id
        and p.status != 'draft'
    )
  )
);

comment on policy "strategic_plans_select_authorized" on public.strategic_plans is 'Cliente solo ve planes fuera de draft; consultor asignado y platform_admin ven todo (FE-03, 2026-07-22).';
