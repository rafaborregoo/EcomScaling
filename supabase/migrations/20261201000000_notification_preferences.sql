-- Preferencias de notificacion por persona. Hoy todo aviso llega a la campana;
-- esto deja apagar por categoria. La regla se aplica en un trigger BEFORE INSERT
-- sobre `notifications` (y no en cada sitio de Node que inserta) para que ningun
-- generador, presente o futuro, se salte la preferencia.
--
-- Solo existe el canal "en la app": no hay emisor de email para notificaciones,
-- asi que ofrecer un interruptor de email seria prometer un envio que no ocurre.

create table if not exists public.notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('alert', 'task_assigned', 'other')),
  in_app boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.notification_preferences enable row level security;

drop policy if exists notification_preferences_select_own on public.notification_preferences;
create policy notification_preferences_select_own on public.notification_preferences
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notification_preferences_insert_own on public.notification_preferences;
create policy notification_preferences_insert_own on public.notification_preferences
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists notification_preferences_update_own on public.notification_preferences;
create policy notification_preferences_update_own on public.notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update on public.notification_preferences to authenticated;

-- Tipo de notificacion -> categoria de preferencia. Lo que no tiene categoria
-- propia cae en 'other', asi un tipo nuevo tambien se puede silenciar.
create or replace function private.notification_category(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_type in ('alert', 'task_assigned') then p_type else 'other' end;
$$;

create or replace function private.skip_muted_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.notification_preferences preference
    where preference.user_id = new.user_id
      and preference.category = private.notification_category(new.type)
      and preference.in_app = false
  ) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function private.skip_muted_notification() from public, anon, authenticated;

drop trigger if exists notifications_respect_preferences on public.notifications;
create trigger notifications_respect_preferences
  before insert on public.notifications
  for each row execute function private.skip_muted_notification();
