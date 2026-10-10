-- Silenciar un cliente concreto en la campana. Las preferencias por categoria
-- (20261201000000) son globales: un consultor con doce clientes no podia callar
-- uno sin apagar el tipo de aviso para todos. Se aplica en el mismo trigger
-- BEFORE INSERT, asi ningun generador de notificaciones se lo salta. La Mesa del
-- consultor no lee notificaciones, asi que el trabajo de ese cliente sigue ahi.

create table if not exists public.notification_muted_organizations (
  user_id uuid not null references public.profiles (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, organization_id)
);

alter table public.notification_muted_organizations enable row level security;

drop policy if exists notification_muted_organizations_select_own on public.notification_muted_organizations;
create policy notification_muted_organizations_select_own on public.notification_muted_organizations
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists notification_muted_organizations_insert_own on public.notification_muted_organizations;
create policy notification_muted_organizations_insert_own on public.notification_muted_organizations
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists notification_muted_organizations_delete_own on public.notification_muted_organizations;
create policy notification_muted_organizations_delete_own on public.notification_muted_organizations
  for delete to authenticated using (user_id = (select auth.uid()));

grant select, insert, delete on public.notification_muted_organizations to authenticated;

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
  if new.organization_id is not null and exists (
    select 1
    from public.notification_muted_organizations muted
    where muted.user_id = new.user_id
      and muted.organization_id = new.organization_id
  ) then
    return null;
  end if;
  return new;
end;
$$;

revoke all on function private.skip_muted_notification() from public, anon, authenticated;
