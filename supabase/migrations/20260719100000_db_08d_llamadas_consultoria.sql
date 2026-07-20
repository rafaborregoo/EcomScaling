-- DB-08d: llamadas de consultoria (parte pendiente del spec DB-08; las tablas
-- de runtime IA ya existen en db_08a). Flujo BE-05: el consultor registra la
-- llamada con su enlace Loom/Fathom, pega la transcripcion (manual hasta
-- INT-04), redacta o genera el resumen, y NADA se publica al cliente sin
-- aprobacion. Los criterios de cierre DB-08:
--   - Solo una transcripcion actual por llamada (indice unico parcial).
--   - Resumen requiere aprobacion antes de publicar (status + RLS: el cliente
--     solo ve resumenes published).
--   - Trazabilidad IA queda en agent_runs (A01 llegara en AI-01 y escribira
--     call_ai_summaries con run_id).

create type public.call_status as enum ('scheduled', 'held', 'cancelled');
create type public.call_summary_status as enum ('draft', 'pending_approval', 'published', 'rejected');

create table public.consulting_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  consultant_user_id uuid references public.profiles (id) on delete set null,
  title varchar(255) not null,
  call_type varchar(40) not null default 'monthly_review',
  status public.call_status not null default 'scheduled',
  scheduled_at timestamptz,
  held_at timestamptz,
  duration_minutes integer,
  recording_url text,
  recording_provider varchar(40),
  is_visible_to_client boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint consulting_calls_call_type check (
    call_type in ('monthly_review', 'onboarding', 'strategy', 'ad_hoc')
  ),
  constraint consulting_calls_recording_provider check (
    recording_provider is null or recording_provider in ('loom', 'fathom', 'meet', 'zoom', 'other')
  ),
  constraint consulting_calls_duration check (duration_minutes is null or duration_minutes > 0)
);

create table public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.consulting_calls (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  content text not null,
  source varchar(40) not null default 'manual',
  version integer not null default 1,
  is_current boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint call_transcripts_source check (source in ('manual', 'loom', 'fathom', 'import')),
  constraint call_transcripts_unique_version unique (call_id, version)
);

-- Criterio de cierre: solo una transcripcion actual por llamada.
create unique index call_transcripts_unique_current
on public.call_transcripts (call_id)
where is_current;

create table public.call_ai_summaries (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.consulting_calls (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  run_id uuid references public.agent_runs (id) on delete set null,
  summary text not null,
  key_points jsonb,
  agreed_actions jsonb,
  status public.call_summary_status not null default 'draft',
  authored_by uuid references public.profiles (id) on delete set null,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  published_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Notas internas en tabla separada (mismo patron que milestone_internal_notes):
-- la RLS por filas no oculta columnas, asi que lo solo-consultor vive aparte.
create table public.call_internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  call_id uuid not null references public.consulting_calls (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.call_task_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  call_id uuid not null references public.consulting_calls (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint call_task_links_unique unique (call_id, task_id)
);

create index consulting_calls_organization_id_idx on public.consulting_calls (organization_id);
create index consulting_calls_held_at_idx on public.consulting_calls (organization_id, held_at);
create index call_transcripts_call_id_idx on public.call_transcripts (call_id);
create index call_transcripts_organization_id_idx on public.call_transcripts (organization_id);
create index call_ai_summaries_call_id_idx on public.call_ai_summaries (call_id);
create index call_ai_summaries_organization_id_idx on public.call_ai_summaries (organization_id);
create index call_internal_notes_call_id_idx on public.call_internal_notes (call_id);
create index call_internal_notes_organization_id_idx on public.call_internal_notes (organization_id);
create index call_task_links_organization_id_idx on public.call_task_links (organization_id);
create index call_task_links_task_id_idx on public.call_task_links (task_id);

create trigger set_consulting_calls_updated_at
before update on public.consulting_calls
for each row execute function private.set_updated_at();

create trigger set_call_ai_summaries_updated_at
before update on public.call_ai_summaries
for each row execute function private.set_updated_at();

alter table public.consulting_calls enable row level security;
alter table public.call_transcripts enable row level security;
alter table public.call_ai_summaries enable row level security;
alter table public.call_internal_notes enable row level security;
alter table public.call_task_links enable row level security;

-- Cliente: solo llamadas marcadas visibles; consultor/admin: todas.
create policy "consulting_calls_select_authorized"
on public.consulting_calls for select to authenticated
using (
  private.can_access_org(organization_id)
  and (
    is_visible_to_client
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

create policy "call_transcripts_select_authorized"
on public.call_transcripts for select to authenticated
using (
  private.can_access_org(organization_id)
  and exists (
    select 1 from public.consulting_calls c
    where c.id = call_transcripts.call_id
      and (
        c.is_visible_to_client
        or private.is_platform_admin()
        or private.is_assigned_consultant(c.organization_id)
      )
  )
);

-- Criterio de cierre: el cliente no ve borradores; solo resumenes publicados.
create policy "call_ai_summaries_select_authorized"
on public.call_ai_summaries for select to authenticated
using (
  private.can_access_org(organization_id)
  and (
    status = 'published'
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

-- Notas internas: nunca para el cliente (FE-04).
create policy "call_internal_notes_select_consultants"
on public.call_internal_notes for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

create policy "call_task_links_select_authorized"
on public.call_task_links for select to authenticated
using (private.can_access_org(organization_id));

grant select on public.consulting_calls to authenticated;
grant select on public.call_internal_notes to authenticated;
grant select on public.call_transcripts to authenticated;
grant select on public.call_ai_summaries to authenticated;
grant select on public.call_task_links to authenticated;

comment on table public.consulting_calls is 'Llamadas de consultoria con enlace Loom/Fathom; notas internas solo visibles para consultores via API.';
comment on table public.call_transcripts is 'Transcripciones versionadas; el indice parcial garantiza una sola actual por llamada.';
comment on table public.call_ai_summaries is 'Resumenes (manuales hoy, A01 en AI-01); el cliente solo ve status published.';
