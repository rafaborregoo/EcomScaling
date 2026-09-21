-- F9: tenant-scoped experience and learning assessments.
-- The table stores evaluations of observed evidence; it never executes actions,
-- promotes knowledge automatically, or rewrites the F8 closure history.
create table if not exists public.continuous_learning_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  block_code text not null,
  experience_id text not null,
  intervention_id text,
  recommendation_id text,
  output_id uuid references public.agent_outputs (id) on delete set null,
  as_of timestamptz not null,
  evaluated_at timestamptz not null,
  input_fingerprint text not null,
  status text not null,
  classification text not null,
  confidence text not null,
  gate boolean not null default false,
  input_envelope jsonb not null,
  result jsonb not null,
  rationale jsonb not null default '[]'::jsonb,
  learning jsonb not null default '[]'::jsonb,
  next_evidence_needed jsonb not null default '[]'::jsonb,
  unresolved_unknowns jsonb not null default '[]'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint continuous_learning_runs_block check (block_code in ('9.00','9.01','9.03','9.04','9.05','9.06','9.07','9.08','9.09','9.10','9.11','9.12','9.13','9.14','9.15','9.16','9.17','9.18','9.19','9.20','9.22','9.23','9.24','9.25','9.26','9.27','9.28','9.29','9.30','9.31','9.32','9.33','9.34','9.35','9.36','9.37','9.38','9.39','9.40','9.41')),
  constraint continuous_learning_runs_status check (status in ('READY','WAITING_FOR_EVIDENCE','BLOCKED','REVIEW_REQUIRED')),
  constraint continuous_learning_runs_classification check (classification in ('POSITIVE','NEGATIVE','NEUTRAL','INCONCLUSIVE','MIXED')),
  constraint continuous_learning_runs_confidence check (confidence in ('LOW','MEDIUM','HIGH')),
  constraint continuous_learning_runs_unique_input unique (organization_id, block_code, input_fingerprint)
);

create index if not exists continuous_learning_runs_org_idx on public.continuous_learning_runs (organization_id, evaluated_at desc);
create index if not exists continuous_learning_runs_block_idx on public.continuous_learning_runs (organization_id, block_code, status, evaluated_at desc);
create index if not exists continuous_learning_runs_gate_idx on public.continuous_learning_runs (organization_id, gate, classification);

alter table public.continuous_learning_runs enable row level security;
drop policy if exists "continuous_learning_runs_select_consultants" on public.continuous_learning_runs;
create policy "continuous_learning_runs_select_consultants" on public.continuous_learning_runs
for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));
grant select on public.continuous_learning_runs to authenticated;

comment on table public.continuous_learning_runs is 'F9: trazabilidad tenant-scoped de experiences, evidencia y gates de learning; no ejecuta ni autoriza acciones.';
