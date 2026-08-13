-- AI-11 Fase A: edición humana y versionado auditable de drafts.
-- Editar cualquier campo reinicia la aprobación; no existe publicación/envío aquí.

alter table public.marketing_content_drafts
  add column version integer not null default 1,
  add column last_edited_by uuid references public.profiles (id) on delete set null,
  add column last_edited_at timestamptz;

alter table public.marketing_content_drafts
  add constraint marketing_content_drafts_version_positive check (version > 0);

create table public.marketing_content_draft_versions (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null references public.marketing_content_drafts (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  version integer not null,
  change_type varchar(20) not null,
  edited_by uuid references public.profiles (id) on delete set null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint marketing_content_draft_versions_version_positive check (version > 0),
  constraint marketing_content_draft_versions_change_type check (change_type in ('generated', 'manual')),
  constraint marketing_content_draft_versions_unique_version unique (draft_id, version)
);

create index marketing_content_draft_versions_org_created_idx
  on public.marketing_content_draft_versions (organization_id, created_at desc);
create index marketing_content_draft_versions_draft_version_idx
  on public.marketing_content_draft_versions (draft_id, version desc);

alter table public.marketing_content_draft_versions enable row level security;

create policy "marketing_content_draft_versions_select_consultants"
on public.marketing_content_draft_versions for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.marketing_content_draft_versions to authenticated;

comment on table public.marketing_content_draft_versions is
  'AI-11: snapshot inmutable de cada draft generado o editado; toda edición requiere nueva aprobación.';
