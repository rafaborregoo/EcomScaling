-- Canal de mensajería consultor <-> cliente: un hilo por organización. Hasta
-- ahora solo existía el copiloto IA (consultor <-> IA) y los comentarios
-- internos de tareas; no había conversación humana consultor <-> cliente.
--
-- ADR-0006 pto 7: escrituras vía SUPABASE_SERVICE_ROLE_KEY + chequeo manual de
-- rol en la API; la RLS de estas tablas solo permite `select` a `authenticated`.
-- Los adjuntos viven en un bucket PRIVADO (`consultant-messages`): las lecturas
-- se sirven con URL firmada generada por la API, no hay URL pública.

create table public.consultant_client_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  author_user_id uuid references public.profiles (id) on delete set null,
  author_kind text not null check (author_kind in ('consultant', 'client', 'platform', 'system')),
  body text not null default '',
  -- [{ storage_path, filename, content_type, byte_size }]
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  constraint consultant_client_messages_not_empty
    check (length(btrim(body)) > 0 or jsonb_array_length(attachments) > 0)
);

create index consultant_client_messages_org_created_idx
  on public.consultant_client_messages (organization_id, created_at desc);

create table public.consultant_client_message_reads (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.consultant_client_messages enable row level security;
alter table public.consultant_client_message_reads enable row level security;

-- Ven el hilo: admin de plataforma, consultor asignado, o miembro
-- owner/manager de la organización. Mismo criterio que el hilo de notas de
-- marketing (marketing_content_draft_notes).
create policy "consultant_client_messages_select_workspace"
on public.consultant_client_messages for select to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
  or private.current_member_role(organization_id) in ('owner', 'manager')
);

create policy "consultant_client_message_reads_select_own"
on public.consultant_client_message_reads for select to authenticated
using (user_id = (select auth.uid()));

grant select on public.consultant_client_messages to authenticated;
grant select on public.consultant_client_message_reads to authenticated;

-- Bucket privado para los adjuntos del hilo (imágenes y archivos). Sin
-- políticas de storage para `authenticated`: subida por service role, lectura
-- por URL firmada. 15 MiB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consultant-messages',
  'consultant-messages',
  false,
  15728640,
  array[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf', 'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
