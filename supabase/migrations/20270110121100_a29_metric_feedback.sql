create table if not exists public.metric_analysis_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid references public.shopify_stores(id) on delete set null,
  run_id uuid references public.agent_runs(id) on delete set null,
  output_id uuid not null references public.agent_outputs(id) on delete cascade,
  metric_id text not null check (metric_id in ('mer', 'cac_new', 'conversion', 'meta_roas', 'email_open_rate')),
  user_id uuid not null references auth.users(id) on delete cascade,
  rating text not null check (rating in ('helpful', 'incorrect')),
  correction text check (correction is null or length(correction) <= 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, output_id, user_id)
);

create index if not exists metric_analysis_feedback_org_created_idx
  on public.metric_analysis_feedback (organization_id, created_at desc);
create index if not exists metric_analysis_feedback_metric_created_idx
  on public.metric_analysis_feedback (metric_id, created_at desc);

alter table public.metric_analysis_feedback enable row level security;
revoke all on public.metric_analysis_feedback from public, anon, authenticated;
grant all on public.metric_analysis_feedback to service_role;

do $a29_feedback_policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'metric_analysis_feedback'
      and policyname = 'metric_analysis_feedback_select_own_org'
  ) then
    create policy metric_analysis_feedback_select_own_org
      on public.metric_analysis_feedback for select to authenticated
      using (exists (
        select 1 from public.organization_members m
        where m.organization_id = metric_analysis_feedback.organization_id
          and m.user_id = auth.uid() and m.is_active = true
      ));
  end if;
end
$a29_feedback_policy$;
