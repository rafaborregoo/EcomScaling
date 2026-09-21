-- Mesa de trabajo diaria, F3: "desde mi ultima revision".
--
-- Sin esta tabla, "que ha cambiado desde la ultima vez que mire a este
-- cliente" solo se puede aproximar con una ventana de tiempo fija (7/30/90
-- dias), que no es la pregunta: dos consultores que abren el mismo cliente el
-- mismo dia no han mirado lo mismo. El hito lo pone una persona, a proposito.
--
-- Deliberadamente minima: no sustituye tareas, llamadas ni comentarios. Solo
-- delimita desde cuando comparar. La nota es opcional y corta; no es un canal
-- de mensajeria (para eso estan consultant_client_messages).
create table if not exists public.consultant_client_review_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  consultant_user_id uuid not null references public.profiles (id) on delete cascade,
  reviewed_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now(),
  constraint consultant_client_review_events_note_length check (
    note is null or char_length(note) <= 500
  )
);

-- La unica lectura que hace la mesa: "mi ultima revision de este cliente".
create index if not exists consultant_client_review_events_lookup_idx
  on public.consultant_client_review_events (
    organization_id,
    consultant_user_id,
    reviewed_at desc
  );

alter table public.consultant_client_review_events enable row level security;

-- Un consultor ve SUS revisiones de las organizaciones que tiene asignadas;
-- platform_admin ve las suyas de cualquiera. Un miembro del cliente no entra:
-- esto es el cuaderno del consultor, no algo que el cliente deba leer (por eso
-- no se usa can_access_org, que si dejaria pasar a owner/manager del workspace).
drop policy if exists "consultant_client_review_events_select_own"
  on public.consultant_client_review_events;
create policy "consultant_client_review_events_select_own"
  on public.consultant_client_review_events
for select to authenticated
using (
  consultant_user_id = (select auth.uid())
  and (
    private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

-- Las escrituras van con service role desde la API, que comprueba rol y
-- pertenencia a la cartera antes de insertar (mismo patron que el resto de
-- modulos: la RLS de la tabla solo abre `select` a authenticated).
grant select on public.consultant_client_review_events to authenticated;

comment on table public.consultant_client_review_events is
  'Hito explicito "he revisado a este cliente", puesto por el consultor. Acota la comparacion de la mesa de trabajo diaria; no sustituye tareas ni llamadas.';
