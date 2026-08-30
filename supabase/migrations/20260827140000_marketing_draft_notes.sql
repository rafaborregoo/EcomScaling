-- AI-11: objeciones / observaciones del consultor sobre un borrador de
-- marketing del cliente. El consultor ve "como un espejo" lo que el cliente
-- crea y deja objeciones sin tener que rechazar el borrador.
--
-- Insert solo via API (service client) con la misma frontera de roles que el
-- resto de mutaciones de marketing: consultor asignado o platform_admin. El
-- select sigue el patron workspace (owner/manager tambien las ven, para poder
-- actuar sobre ellas).

create table public.marketing_content_draft_notes (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null
    references public.marketing_content_drafts (id) on delete cascade,
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  author_user_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);

create index marketing_content_draft_notes_draft_idx
  on public.marketing_content_draft_notes (draft_id, created_at);
create index marketing_content_draft_notes_org_idx
  on public.marketing_content_draft_notes (organization_id, created_at desc);

alter table public.marketing_content_draft_notes enable row level security;

create policy "marketing_content_draft_notes_select_workspace"
on public.marketing_content_draft_notes for select to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
  or private.current_member_role(organization_id) in ('owner', 'manager')
);

grant select on public.marketing_content_draft_notes to authenticated;

comment on table public.marketing_content_draft_notes is
  'AI-11: objeciones/observaciones del consultor sobre un borrador de marketing. Insert solo via API (service role) con frontera consultor/platform_admin; select workspace (owner/manager tambien).';
