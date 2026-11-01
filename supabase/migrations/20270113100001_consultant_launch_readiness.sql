-- Delivery state is separate from PDF generation. Only confirmed sends advance last_period_end.
alter table public.report_schedules
  add column if not exists pending_report_id uuid references public.copilot_reports(id) on delete set null,
  add column if not exists pending_period_end date,
  add column if not exists last_delivery_error text,
  add column if not exists last_delivery_attempt_at timestamptz,
  add column if not exists delivery_attempts integer not null default 0,
  add column if not exists delivery_lease_id uuid,
  add column if not exists delivery_lease_until timestamptz;

alter table public.report_schedules drop constraint if exists report_schedules_organization_id_template_id_key;
create unique index if not exists report_schedules_org_template_store_key
  on public.report_schedules (organization_id, template_id, store_id) nulls not distinct;

-- A deleted store must never turn its schedule into an organization-wide send.
alter table public.report_schedules drop constraint if exists report_schedules_store_id_fkey;
alter table public.report_schedules add constraint report_schedules_store_id_fkey
  foreign key (store_id) references public.shopify_stores(id) on delete cascade;

-- Permissive SELECT policies combine with OR. Keep draft visibility as an AND
-- restriction, including for all child tables that read their parent through RLS.
drop policy if exists strategic_plans_draft_visibility_guard on public.strategic_plans;
create policy strategic_plans_draft_visibility_guard on public.strategic_plans
as restrictive for select to authenticated
using (
  status <> 'draft'::public.plan_status
  or (select private.is_platform_admin())
  or organization_id in (select private.assigned_consultant_org_ids())
);

create or replace function private.consultant_owned_client_org_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $fn$
  select m.organization_id
  from public.organization_members m
  join public.organizations o on o.id = m.organization_id
  join public.profiles p on p.id = m.user_id
  where m.user_id = (select auth.uid())
    and m.is_active and m.role = 'owner'
    and coalesce(m.access_scope, 'organization') = 'organization'
    and p.is_active and private.is_consultant(m.user_id)
    and o.kind = 'client' and o.status in ('onboarding', 'active');
$fn$;
revoke all on function private.consultant_owned_client_org_ids() from public, anon;
grant execute on function private.consultant_owned_client_org_ids() to authenticated;

drop policy if exists consultant_client_review_events_select_own on public.consultant_client_review_events;
create policy consultant_client_review_events_select_own
on public.consultant_client_review_events for select to authenticated
using (
  consultant_user_id = (select auth.uid())
  and (
    (select private.is_platform_admin())
    or organization_id in (select private.assigned_consultant_org_ids())
    or organization_id in (select private.consultant_owned_client_org_ids())
  )
);
