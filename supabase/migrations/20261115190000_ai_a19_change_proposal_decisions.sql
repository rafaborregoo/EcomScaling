-- A19-5: historial humano por propuesta. Aceptar/rechazar no muta el árbol;
-- completar se marca después de aplicar el cambio desde los editores existentes.
create table if not exists public.strategic_plan_change_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.strategic_plans(id) on delete cascade,
  weekly_review_id uuid not null references public.strategic_plan_weekly_reviews(id) on delete cascade,
  source_output_id uuid references public.agent_outputs(id) on delete set null,
  proposal_index integer not null check (proposal_index >= 0),
  proposal jsonb not null,
  created_at timestamptz not null default now(),
  constraint strategic_plan_change_proposals_unique unique (weekly_review_id, proposal_index)
);

create table if not exists public.strategic_plan_change_proposal_events (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.strategic_plan_change_proposals(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null,
  actor_user_id uuid not null references public.profiles(id) on delete restrict,
  actor_role text not null check (actor_role in ('consultant', 'client')),
  reason text,
  edited_proposal jsonb,
  created_at timestamptz not null default now(),
  constraint strategic_plan_change_proposal_events_action check (action in ('accepted', 'rejected', 'edited', 'completed')),
  constraint strategic_plan_change_proposal_events_edited_payload check (action <> 'edited' or edited_proposal is not null)
);

create index if not exists strategic_plan_change_proposals_plan_created_idx
  on public.strategic_plan_change_proposals (plan_id, created_at desc);
create index if not exists strategic_plan_change_proposals_org_idx
  on public.strategic_plan_change_proposals (organization_id, created_at desc);
create index if not exists strategic_plan_change_proposal_events_proposal_idx
  on public.strategic_plan_change_proposal_events (proposal_id, created_at desc);
create index if not exists strategic_plan_change_proposal_events_org_idx
  on public.strategic_plan_change_proposal_events (organization_id, created_at desc);

alter table public.strategic_plan_change_proposals enable row level security;
drop policy if exists strategic_plan_change_proposals_select_authorized on public.strategic_plan_change_proposals;
create policy strategic_plan_change_proposals_select_authorized
  on public.strategic_plan_change_proposals for select to authenticated
  using (private.can_access_org(organization_id));
grant select on public.strategic_plan_change_proposals to authenticated;
alter table public.strategic_plan_change_proposal_events enable row level security;
drop policy if exists strategic_plan_change_proposal_events_select_authorized on public.strategic_plan_change_proposal_events;
create policy strategic_plan_change_proposal_events_select_authorized
  on public.strategic_plan_change_proposal_events for select to authenticated
  using (private.can_access_org(organization_id));
grant select on public.strategic_plan_change_proposal_events to authenticated;

comment on table public.strategic_plan_change_proposals is
  'A19: propuesta de cambio inmutable del agente; las decisiones humanas/versiones editadas se guardan en strategic_plan_change_proposal_events. Aceptar/rechazar no muta el plan.';
comment on table public.strategic_plan_change_proposal_events is
  'Historial append-only de aceptación, rechazo, edición y finalización humana de cada propuesta A19, con autoría y motivo.';
;
