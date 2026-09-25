-- D12: presupuesto de revision y su efecto en D11.
--
-- Decision de producto del 2026-09-24: como mucho 2 reaperturas por caso
-- (REVISION_BUDGET en packages/contracts/src/adversarial.ts). D12 PROPONE
-- reabrir D06-D09 y el consultor confirma o descarta. Agotado el presupuesto,
-- el caso queda como no concluyente. D11 lee `revision_state` y no afirma nada
-- por encima de bajo mientras la revision este abierta.
--
-- Idempotente (CLAUDE.md).

alter table public.diagnostic_robustness
  add column if not exists revision_state varchar(20) not null default 'none';

alter table public.diagnostic_robustness
  drop constraint if exists diagnostic_robustness_estado_revision;
alter table public.diagnostic_robustness
  add constraint diagnostic_robustness_estado_revision check (
    revision_state in ('none', 'proposed', 'confirmed', 'budget_exhausted')
  );

create table if not exists public.diagnostic_revision_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  case_id uuid not null references public.diagnostic_cases (id) on delete cascade,
  robustness_id uuid references public.diagnostic_robustness (id) on delete set null,
  reopened_blocks text[] not null default '{}',
  attempt integer not null,
  status varchar(12) not null default 'proposed',
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  constraint diagnostic_revision_requests_estado check (status in ('proposed', 'confirmed', 'declined')),
  constraint diagnostic_revision_requests_intento check (attempt >= 1),
  constraint diagnostic_revision_requests_decision check (
    (status = 'proposed') = (decided_at is null)
  )
);

comment on table public.diagnostic_revision_requests is
  'D12: propuestas de reabrir D06-D09 para un caso y la decision del consultor. Las confirmadas consumen presupuesto de revision (maximo 2 por caso).';

-- Una sola propuesta abierta por caso.
create unique index if not exists diagnostic_revision_requests_una_abierta_idx
  on public.diagnostic_revision_requests (case_id)
  where status = 'proposed';

create index if not exists diagnostic_revision_requests_org_idx
  on public.diagnostic_revision_requests (organization_id, status);

alter table public.diagnostic_revision_requests enable row level security;

drop policy if exists "diagnostic_revision_requests_select_staff" on public.diagnostic_revision_requests;
create policy "diagnostic_revision_requests_select_staff" on public.diagnostic_revision_requests
  for select to authenticated
  using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  );

grant select on public.diagnostic_revision_requests to authenticated;

-- D11: el techo que pone D12 tiene su propio origen.
alter table public.confidence_caps
  drop constraint if exists confidence_caps_origen;
alter table public.confidence_caps
  add constraint confidence_caps_origen check (cap_source in (
    'data_quality','insufficient_coverage','weak_temporal_fit','scope_mismatch',
    'external_cause_unobserved','inadequate_horizon','broad_structural_claim',
    'measurement_change','sample_too_small','dependent_evidence','stale_knowledge',
    'adversarial_review'
  ));
