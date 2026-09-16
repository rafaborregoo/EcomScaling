-- F4/P06-P12: snapshots de las dimensiones finales de decisión.
create table if not exists public.decision_risk_assessments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, candidate_ref uuid not null, as_of timestamptz not null, assessed_at timestamptz not null default now(), input_fingerprint varchar(80) not null, risk_assessment varchar(16) not null, input_envelope jsonb not null, result jsonb not null, unresolved_unknowns jsonb not null default '[]'::jsonb, reason_codes jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, constraint decision_risk_values check(risk_assessment in('HIGH','MEDIUM','LOW','UNKNOWN')), constraint decision_risk_unique unique(organization_id,input_fingerprint));
create table if not exists public.decision_allocation_assessments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, candidate_ref uuid not null, as_of timestamptz not null, assessed_at timestamptz not null default now(), input_fingerprint varchar(80) not null, allocation_assessment varchar(24) not null, input_envelope jsonb not null, result jsonb not null, unresolved_unknowns jsonb not null default '[]'::jsonb, reason_codes jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, constraint decision_allocation_unique unique(organization_id,input_fingerprint));
create table if not exists public.decision_strategic_fit_assessments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, candidate_ref uuid not null, as_of timestamptz not null, assessed_at timestamptz not null default now(), input_fingerprint varchar(80) not null, strategic_assessment varchar(16) not null, input_envelope jsonb not null, result jsonb not null, unresolved_unknowns jsonb not null default '[]'::jsonb, reason_codes jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, constraint decision_fit_unique unique(organization_id,input_fingerprint));
create table if not exists public.decision_rankings (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, as_of timestamptz not null, assessed_at timestamptz not null default now(), input_fingerprint varchar(80) not null, ranking_status varchar(16) not null, input_envelope jsonb not null, result jsonb not null, unresolved_unknowns jsonb not null default '[]'::jsonb, reason_codes jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, constraint decision_ranking_unique unique(organization_id,input_fingerprint));
create table if not exists public.decision_portfolio_assessments (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, as_of timestamptz not null, assessed_at timestamptz not null default now(), input_fingerprint varchar(80) not null, portfolio_status varchar(24) not null, input_envelope jsonb not null, result jsonb not null, unresolved_unknowns jsonb not null default '[]'::jsonb, reason_codes jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, constraint decision_portfolio_unique unique(organization_id,input_fingerprint));
create table if not exists public.decision_outputs (id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade, candidate_ref uuid not null, as_of timestamptz not null, assessed_at timestamptz not null default now(), input_fingerprint varchar(80) not null, decision_status varchar(24) not null, input_envelope jsonb not null, result jsonb not null, reason_codes jsonb not null default '[]'::jsonb, source_refs jsonb not null default '[]'::jsonb, constraint decision_output_unique unique(organization_id,input_fingerprint));

create index if not exists decision_risk_assessments_org_idx on public.decision_risk_assessments (organization_id, assessed_at desc);
create index if not exists decision_allocation_assessments_org_idx on public.decision_allocation_assessments (organization_id, assessed_at desc);
create index if not exists decision_strategic_fit_assessments_org_idx on public.decision_strategic_fit_assessments (organization_id, assessed_at desc);
create index if not exists decision_rankings_org_idx on public.decision_rankings (organization_id, assessed_at desc);
create index if not exists decision_portfolio_assessments_org_idx on public.decision_portfolio_assessments (organization_id, assessed_at desc);
create index if not exists decision_outputs_org_idx on public.decision_outputs (organization_id, assessed_at desc);

alter table public.decision_risk_assessments enable row level security;
alter table public.decision_allocation_assessments enable row level security;
alter table public.decision_strategic_fit_assessments enable row level security;
alter table public.decision_rankings enable row level security;
alter table public.decision_portfolio_assessments enable row level security;
alter table public.decision_outputs enable row level security;

grant select on public.decision_risk_assessments, public.decision_allocation_assessments, public.decision_strategic_fit_assessments, public.decision_rankings, public.decision_portfolio_assessments, public.decision_outputs to authenticated;

drop policy if exists decision_risk_assessments_select_consultant on public.decision_risk_assessments;
create policy decision_risk_assessments_select_consultant on public.decision_risk_assessments
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
drop policy if exists decision_allocation_assessments_select_consultant on public.decision_allocation_assessments;
create policy decision_allocation_assessments_select_consultant on public.decision_allocation_assessments
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
drop policy if exists decision_strategic_fit_assessments_select_consultant on public.decision_strategic_fit_assessments;
create policy decision_strategic_fit_assessments_select_consultant on public.decision_strategic_fit_assessments
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
drop policy if exists decision_rankings_select_consultant on public.decision_rankings;
create policy decision_rankings_select_consultant on public.decision_rankings
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
drop policy if exists decision_portfolio_assessments_select_consultant on public.decision_portfolio_assessments;
create policy decision_portfolio_assessments_select_consultant on public.decision_portfolio_assessments
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
drop policy if exists decision_outputs_select_consultant on public.decision_outputs;
create policy decision_outputs_select_consultant on public.decision_outputs
  for select to authenticated
  using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
