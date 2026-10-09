-- ADR-0025: campaña de mailing orquestada con LangGraph.
--
-- 1. marketing_mailing_sequences.orchestrator: que orquestador lleva la
--    secuencia ('browser' = bucle actual del navegador, 'graph' = LangGraph).
--    Una secuencia empezada en un modo termina en ese modo.
-- 2. mailing_campaign_checkpoints / _writes: checkpointer propio del grafo
--    (thread_id = sequence_id). Llevan organization_id y store_id, se borran
--    en cascada con la organizacion y solo el service role escribe.
-- 3. marketing_mailing_campaign_emails: proyeccion legible del estado de cada
--    email (lo que lee la pantalla). No es fuente de verdad de la aprobacion:
--    esa sigue en marketing_content_drafts + agent_approvals.
--
-- Idempotente: si el esquema se toca por fuera, db:push la reaplica sin dano.

alter table public.marketing_mailing_sequences
  add column if not exists orchestrator varchar(16) not null default 'browser';

alter table public.marketing_mailing_sequences
  drop constraint if exists marketing_mailing_sequences_orchestrator_check;
alter table public.marketing_mailing_sequences
  add constraint marketing_mailing_sequences_orchestrator_check
  check (orchestrator in ('browser', 'graph'));

create table if not exists public.mailing_campaign_checkpoints (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  parent_checkpoint_id text,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  sequence_id uuid not null references public.marketing_mailing_sequences (id) on delete cascade,
  checkpoint_type text not null,
  checkpoint text not null,
  metadata_type text not null,
  metadata text not null,
  created_at timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, checkpoint_id)
);

create index if not exists mailing_campaign_checkpoints_org_idx
  on public.mailing_campaign_checkpoints (organization_id, sequence_id);

create table if not exists public.mailing_campaign_checkpoint_writes (
  thread_id text not null,
  checkpoint_ns text not null default '',
  checkpoint_id text not null,
  task_id text not null,
  idx integer not null,
  channel text not null,
  value_type text not null,
  value text not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  sequence_id uuid not null references public.marketing_mailing_sequences (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

create index if not exists mailing_campaign_checkpoint_writes_org_idx
  on public.mailing_campaign_checkpoint_writes (organization_id, sequence_id);

create table if not exists public.marketing_mailing_campaign_emails (
  sequence_id uuid not null references public.marketing_mailing_sequences (id) on delete cascade,
  sequence_number smallint not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid references public.shopify_stores (id) on delete cascade,
  title text not null,
  scheduled_for timestamptz not null,
  status varchar(32) not null default 'queued',
  attempt smallint not null default 0,
  draft_id uuid references public.marketing_content_drafts (id) on delete set null,
  auto_review_passed boolean,
  rejections jsonb not null default '[]'::jsonb,
  last_error text,
  decided_by uuid references public.profiles (id) on delete set null,
  decided_role varchar(16),
  consultant_review_decision varchar(16),
  consultant_review_reason text,
  consultant_reviewed_by uuid references public.profiles (id) on delete set null,
  consultant_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sequence_id, sequence_number),
  constraint marketing_mailing_campaign_emails_status_check check (status in (
    'queued', 'drafting', 'reviewing', 'awaiting_approval', 'awaiting_consultant_review',
    'approved', 'scheduled', 'rejected', 'failed'
  )),
  constraint marketing_mailing_campaign_emails_attempt_check check (attempt between 0 and 2),
  constraint marketing_mailing_campaign_emails_role_check
    check (decided_role is null or decided_role in ('consultant', 'platform', 'client')),
  constraint marketing_mailing_campaign_emails_review_check
    check (consultant_review_decision is null or consultant_review_decision in ('approved', 'rejected'))
);

create index if not exists marketing_mailing_campaign_emails_org_store_idx
  on public.marketing_mailing_campaign_emails (organization_id, store_id, sequence_id);
create index if not exists marketing_mailing_campaign_emails_draft_idx
  on public.marketing_mailing_campaign_emails (draft_id)
  where draft_id is not null;

drop trigger if exists set_marketing_mailing_campaign_emails_updated_at
  on public.marketing_mailing_campaign_emails;
create trigger set_marketing_mailing_campaign_emails_updated_at
before update on public.marketing_mailing_campaign_emails
for each row execute function private.set_updated_at();

-- RLS: lectura para miembros con acceso a la organizacion; escritura solo
-- service role (ADR-0006 §7). Los checkpoints no se exponen a authenticated:
-- son serializaciones internas del grafo.
alter table public.mailing_campaign_checkpoints enable row level security;
alter table public.mailing_campaign_checkpoint_writes enable row level security;
alter table public.marketing_mailing_campaign_emails enable row level security;

revoke all on table public.mailing_campaign_checkpoints from public, anon, authenticated;
revoke all on table public.mailing_campaign_checkpoint_writes from public, anon, authenticated;
revoke all on table public.marketing_mailing_campaign_emails from public, anon, authenticated;
grant select, insert, update, delete on table public.mailing_campaign_checkpoints to service_role;
grant select, insert, update, delete on table public.mailing_campaign_checkpoint_writes to service_role;
grant select, insert, update, delete on table public.marketing_mailing_campaign_emails to service_role;
grant select on table public.marketing_mailing_campaign_emails to authenticated;

drop policy if exists "marketing_mailing_campaign_emails_select_authorized"
  on public.marketing_mailing_campaign_emails;
create policy "marketing_mailing_campaign_emails_select_authorized"
  on public.marketing_mailing_campaign_emails for select to authenticated
  using (private.can_access_org(organization_id));

comment on table public.mailing_campaign_checkpoints is
  'ADR-0025: checkpoints de LangGraph de la campaña de mailing (thread_id = sequence_id). Solo service role.';
comment on table public.mailing_campaign_checkpoint_writes is
  'ADR-0025: escrituras pendientes de LangGraph por tarea. Solo service role.';
comment on table public.marketing_mailing_campaign_emails is
  'ADR-0025: estado visible de cada email de una campaña orquestada por el grafo. La aprobacion vive en marketing_content_drafts + agent_approvals.';
