-- Hilo transversal de revisión humana para cualquier salida de agente.
-- Las escrituras pasan por la API (service role), que valida workspace y output.
create table if not exists public.agent_output_notes (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.agent_outputs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  author_user_id uuid references public.profiles(id) on delete set null,
  author_kind text not null check (author_kind in ('consultant','client','platform','ai')),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists agent_output_notes_thread_idx
  on public.agent_output_notes(output_id, created_at asc);
create index if not exists agent_output_notes_org_idx
  on public.agent_output_notes(organization_id, created_at desc);

alter table public.agent_output_notes enable row level security;
drop policy if exists agent_output_notes_select_workspace on public.agent_output_notes;
create policy agent_output_notes_select_workspace on public.agent_output_notes
  for select to authenticated using (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
    or private.current_member_role(organization_id) in ('owner','manager')
  );
grant select on public.agent_output_notes to authenticated;
comment on table public.agent_output_notes is
  'Notas humanas/IA sobre una salida de agente; API valida que la salida pertenece a la organización antes de leer o escribir.';
;
