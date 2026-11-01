-- Reuniones: disponibilidad del consultor, tipos de reunión y reservas.
--
-- Las reuniones viven en la base de datos (no en un calendario externo), así que
-- el choque entre dos reservas lo impide la propia base: una restricción de
-- exclusión sobre el rango [inicio, fin + colchón) del consultor. Dos clientes
-- que pulsan a la vez no pueden coger el mismo hueco.
--
-- Las escrituras van por la API con service role; RLS solo deja leer lo propio
-- (el cliente lee por la API, que oculta las notas internas del consultor).
--
-- Idempotente: se puede reaplicar si el esquema se ha tocado por fuera.

create extension if not exists btree_gist;

create table if not exists public.meeting_settings (
  consultant_user_id uuid primary key references public.profiles (id) on delete cascade,
  timezone varchar(64) not null default 'Europe/Madrid',
  slot_step_minutes smallint not null default 30,
  default_location_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_settings_step_valid check (slot_step_minutes in (10, 15, 20, 30, 60))
);

create table if not exists public.meeting_availability_rules (
  id uuid primary key default gen_random_uuid(),
  consultant_user_id uuid not null references public.profiles (id) on delete cascade,
  weekday smallint not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint meeting_availability_rules_weekday_valid check (weekday between 1 and 7),
  constraint meeting_availability_rules_range_valid check (end_time > start_time)
);
create index if not exists meeting_availability_rules_consultant_idx
  on public.meeting_availability_rules (consultant_user_id, weekday);

create table if not exists public.meeting_availability_blocks (
  id uuid primary key default gen_random_uuid(),
  consultant_user_id uuid not null references public.profiles (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason varchar(255),
  created_at timestamptz not null default now(),
  constraint meeting_availability_blocks_range_valid check (ends_at > starts_at)
);
create index if not exists meeting_availability_blocks_consultant_idx
  on public.meeting_availability_blocks (consultant_user_id, starts_at);

create table if not exists public.meeting_types (
  id uuid primary key default gen_random_uuid(),
  consultant_user_id uuid not null references public.profiles (id) on delete cascade,
  name varchar(120) not null,
  description text,
  duration_minutes smallint not null default 30,
  buffer_minutes smallint not null default 0,
  min_notice_hours smallint not null default 12,
  max_days_ahead smallint not null default 45,
  max_per_day smallint,
  kind varchar(20) not null default 'video',
  location_url text,
  is_active boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_types_duration_valid check (duration_minutes between 10 and 240),
  constraint meeting_types_buffer_valid check (buffer_minutes between 0 and 120),
  constraint meeting_types_notice_valid check (min_notice_hours between 0 and 720),
  constraint meeting_types_ahead_valid check (max_days_ahead between 1 and 365),
  constraint meeting_types_per_day_valid check (max_per_day is null or max_per_day between 1 and 20),
  constraint meeting_types_kind_valid check (kind in ('video', 'phone', 'in_person'))
);
create index if not exists meeting_types_consultant_idx
  on public.meeting_types (consultant_user_id, is_active, position);

create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  consultant_user_id uuid not null references public.profiles (id) on delete cascade,
  booked_by uuid references public.profiles (id) on delete set null,
  meeting_type_id uuid references public.meeting_types (id) on delete set null,
  title varchar(255) not null,
  kind varchar(20) not null default 'video',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  -- fin + colchón: lo que la reserva ocupa de la agenda del consultor.
  blocked_until timestamptz not null,
  status varchar(20) not null default 'scheduled',
  location_url text,
  client_note text,
  consultant_note text,
  milestone_id uuid references public.strategic_plan_milestones (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancel_reason text,
  -- Análisis de la llamada (se rellena después de celebrarla).
  transcript text,
  summary text,
  action_items jsonb not null default '[]'::jsonb,
  analysis jsonb,
  analyzed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meetings_range_valid check (ends_at > starts_at and blocked_until >= ends_at),
  constraint meetings_status_valid check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  constraint meetings_kind_valid check (kind in ('video', 'phone', 'in_person'))
);

alter table public.meetings drop constraint if exists meetings_no_overlap;
alter table public.meetings
  add constraint meetings_no_overlap
  exclude using gist (
    consultant_user_id with =,
    tstzrange(starts_at, blocked_until) with &&
  ) where (status = 'scheduled');

create index if not exists meetings_consultant_start_idx on public.meetings (consultant_user_id, starts_at);
create index if not exists meetings_org_start_idx on public.meetings (organization_id, starts_at);

drop trigger if exists set_meeting_settings_updated_at on public.meeting_settings;
create trigger set_meeting_settings_updated_at before update on public.meeting_settings
for each row execute function private.set_updated_at();
drop trigger if exists set_meeting_types_updated_at on public.meeting_types;
create trigger set_meeting_types_updated_at before update on public.meeting_types
for each row execute function private.set_updated_at();
drop trigger if exists set_meetings_updated_at on public.meetings;
create trigger set_meetings_updated_at before update on public.meetings
for each row execute function private.set_updated_at();

alter table public.meeting_settings enable row level security;
alter table public.meeting_availability_rules enable row level security;
alter table public.meeting_availability_blocks enable row level security;
alter table public.meeting_types enable row level security;
alter table public.meetings enable row level security;

drop policy if exists "meeting_settings_select_own" on public.meeting_settings;
create policy "meeting_settings_select_own" on public.meeting_settings for select to authenticated
using (consultant_user_id = (select auth.uid()) or private.is_platform_admin());

drop policy if exists "meeting_availability_rules_select_own" on public.meeting_availability_rules;
create policy "meeting_availability_rules_select_own" on public.meeting_availability_rules for select to authenticated
using (consultant_user_id = (select auth.uid()) or private.is_platform_admin());

drop policy if exists "meeting_availability_blocks_select_own" on public.meeting_availability_blocks;
create policy "meeting_availability_blocks_select_own" on public.meeting_availability_blocks for select to authenticated
using (consultant_user_id = (select auth.uid()) or private.is_platform_admin());

drop policy if exists "meeting_types_select_own" on public.meeting_types;
create policy "meeting_types_select_own" on public.meeting_types for select to authenticated
using (consultant_user_id = (select auth.uid()) or private.is_platform_admin());

drop policy if exists "meetings_select_consultant" on public.meetings;
create policy "meetings_select_consultant" on public.meetings for select to authenticated
using (consultant_user_id = (select auth.uid()) or private.is_platform_admin());

grant select on public.meeting_settings to authenticated;
grant select on public.meeting_availability_rules to authenticated;
grant select on public.meeting_availability_blocks to authenticated;
grant select on public.meeting_types to authenticated;
grant select on public.meetings to authenticated;

comment on table public.meetings is 'Reservas consultor-cliente. La restricción meetings_no_overlap impide solapes en la agenda del consultor.';
comment on column public.meetings.blocked_until is 'Fin de la reunión más el colchón del tipo: lo que ocupa de la agenda.';

-- Avisos de reuniones (ADR-0028): categoría de preferencias de los tipos nuevos.
-- Misma tabla que `notification-catalog.ts`.
create or replace function private.notification_category(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_type in ('alert', 'alert_critical', 'task_assigned', 'message', 'campaign_review') then p_type
    when p_type in ('integration_error', 'integration_expiring') then 'integration'
    when p_type in ('client_linked', 'client_settings', 'client_decided_ai_output') then 'client'
    when p_type in ('task_comment', 'task_completed', 'daily_today', 'ai_pending', 'camino_objective',
                    'meeting_booked', 'meeting_rescheduled', 'meeting_cancelled') then 'task_assigned'
    else 'other'
  end;
$$;
