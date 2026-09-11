create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name varchar(180),
  avatar_url text,
  phone varchar(40),
  platform_role public.platform_role not null default 'user',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  legal_name varchar(200),
  display_name varchar(200) not null,
  slug varchar(120) not null unique,
  tax_id varchar(40),
  website_url text,
  ecommerce_url text,
  timezone varchar(80) not null default 'Europe/Madrid',
  currency_code varchar(3) not null default 'EUR',
  status public.organization_status not null default 'onboarding',
  onboarding_completed_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_currency_code_format check (currency_code ~ '^[A-Z]{3}$')
);

create table if not exists public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'member',
  is_active boolean not null default true,
  invited_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_unique_user unique (organization_id, user_id)
);

create table if not exists public.consultant_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  consultant_user_id uuid not null references public.profiles (id) on delete cascade,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  ended_at timestamptz,
  constraint consultant_assignments_unique_consultant unique (organization_id, consultant_user_id)
);

create unique index if not exists consultant_assignments_one_primary_active_per_org on public.consultant_assignments (organization_id)
where is_primary and is_active;

create table if not exists public.service_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_code varchar(50) not null,
  status public.subscription_status not null default 'pending',
  starts_at timestamptz,
  ends_at timestamptz,
  cancelled_at timestamptz,
  external_subscription_id varchar(200),
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_subscriptions_valid_period check (ends_at is null or starts_at is null or ends_at > starts_at)
);

create unique index if not exists service_subscriptions_one_current_per_org on public.service_subscriptions (organization_id)
where status in ('trial', 'active');

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.notification_status not null default 'unread',
  type varchar(120) not null,
  title varchar(255) not null,
  message text,
  action_url text,
  entity_type varchar(100),
  entity_id uuid,
  read_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action varchar(160) not null,
  entity_type varchar(100),
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  request_id varchar(255),
  ip_address varchar(64),
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists profiles_platform_role_idx on public.profiles (platform_role);
create index if not exists profiles_is_active_idx on public.profiles (is_active);
create index if not exists organizations_status_idx on public.organizations (status);
create index if not exists organization_members_organization_id_idx on public.organization_members (organization_id);
create index if not exists organization_members_user_id_idx on public.organization_members (user_id);
create index if not exists organization_members_active_idx on public.organization_members (organization_id, user_id) where is_active;
create index if not exists consultant_assignments_organization_id_idx on public.consultant_assignments (organization_id);
create index if not exists consultant_assignments_consultant_user_id_idx on public.consultant_assignments (consultant_user_id);
create index if not exists consultant_assignments_active_idx on public.consultant_assignments (organization_id, consultant_user_id) where is_active;
create index if not exists service_subscriptions_organization_id_idx on public.service_subscriptions (organization_id);
create index if not exists service_subscriptions_status_idx on public.service_subscriptions (status);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_organization_id_idx on public.notifications (organization_id);
create index if not exists notifications_status_idx on public.notifications (status);
create index if not exists notifications_created_at_idx on public.notifications (created_at);
create index if not exists audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index if not exists audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create or replace function private.prevent_profile_privilege_escalation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() = old.id
    and (
      new.platform_role is distinct from old.platform_role
      or new.is_active is distinct from old.is_active
    )
  then
    raise exception 'profiles.platform_role and profiles.is_active cannot be changed by the profile owner';
  end if;

  return new;
end;
$$;

revoke all on function private.prevent_profile_privilege_escalation() from public;

drop trigger if exists prevent_profile_privilege_escalation on public.profiles;
create trigger prevent_profile_privilege_escalation
before update on public.profiles
for each row execute function private.prevent_profile_privilege_escalation();

drop trigger if exists set_organizations_updated_at on public.organizations;
create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

drop trigger if exists set_organization_members_updated_at on public.organization_members;
create trigger set_organization_members_updated_at
before update on public.organization_members
for each row execute function private.set_updated_at();

drop trigger if exists set_service_subscriptions_updated_at on public.service_subscriptions;
create trigger set_service_subscriptions_updated_at
before update on public.service_subscriptions
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public;
grant execute on function private.handle_new_auth_user() to postgres;
grant execute on function private.handle_new_auth_user() to service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.platform_role = 'platform_admin'
      and p.is_active
  );
$$;

create or replace function private.is_active_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.organization_id = target_organization_id
      and om.user_id = auth.uid()
      and om.is_active
      and o.status in ('onboarding', 'active')
  );
$$;

create or replace function private.current_member_role(target_organization_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select om.role
  from public.organization_members om
  where om.organization_id = target_organization_id
    and om.user_id = auth.uid()
    and om.is_active
  limit 1;
$$;

create or replace function private.is_assigned_consultant(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.consultant_assignments ca
    join public.profiles p on p.id = ca.consultant_user_id
    join public.organizations o on o.id = ca.organization_id
    where ca.organization_id = target_organization_id
      and ca.consultant_user_id = auth.uid()
      and ca.is_active
      and p.is_active
      and p.platform_role in ('consultant', 'platform_admin')
      and o.status in ('onboarding', 'active')
  );
$$;

create or replace function private.has_valid_subscription(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.service_subscriptions ss
    where ss.organization_id = target_organization_id
      and ss.status in ('trial', 'active')
      and (ss.starts_at is null or ss.starts_at <= now())
      and (ss.ends_at is null or ss.ends_at > now())
  );
$$;

create or replace function private.can_access_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or private.is_assigned_consultant(target_organization_id)
    or (
      private.is_active_org_member(target_organization_id)
      and private.has_valid_subscription(target_organization_id)
    );
$$;

create or replace function private.can_manage_org(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_platform_admin()
    or private.current_member_role(target_organization_id) in ('owner', 'manager');
$$;

revoke all on function private.is_platform_admin() from public;
revoke all on function private.is_active_org_member(uuid) from public;
revoke all on function private.current_member_role(uuid) from public;
revoke all on function private.is_assigned_consultant(uuid) from public;
revoke all on function private.has_valid_subscription(uuid) from public;
revoke all on function private.can_access_org(uuid) from public;
revoke all on function private.can_manage_org(uuid) from public;

grant execute on function private.is_platform_admin() to authenticated;
grant execute on function private.is_active_org_member(uuid) to authenticated;
grant execute on function private.current_member_role(uuid) to authenticated;
grant execute on function private.is_assigned_consultant(uuid) to authenticated;
grant execute on function private.has_valid_subscription(uuid) to authenticated;
grant execute on function private.can_access_org(uuid) to authenticated;
grant execute on function private.can_manage_org(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.consultant_assignments enable row level security;
alter table public.service_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists "profiles_select_self_or_admin" on public.profiles;
create policy "profiles_select_self_or_admin" on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or private.is_platform_admin());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self" on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

drop policy if exists "organizations_select_authorized" on public.organizations;
create policy "organizations_select_authorized" on public.organizations
for select
to authenticated
using (private.can_access_org(id));

drop policy if exists "organizations_insert_platform_admin" on public.organizations;
create policy "organizations_insert_platform_admin" on public.organizations
for insert
to authenticated
with check (private.is_platform_admin());

drop policy if exists "organizations_update_managers" on public.organizations;
create policy "organizations_update_managers" on public.organizations
for update
to authenticated
using (private.can_manage_org(id))
with check (private.can_manage_org(id));

drop policy if exists "organization_members_select_authorized_org" on public.organization_members;
create policy "organization_members_select_authorized_org" on public.organization_members
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "organization_members_insert_managers" on public.organization_members;
create policy "organization_members_insert_managers" on public.organization_members
for insert
to authenticated
with check (private.can_manage_org(organization_id));

drop policy if exists "organization_members_update_managers" on public.organization_members;
create policy "organization_members_update_managers" on public.organization_members
for update
to authenticated
using (private.can_manage_org(organization_id))
with check (private.can_manage_org(organization_id));

drop policy if exists "consultant_assignments_select_authorized" on public.consultant_assignments;
create policy "consultant_assignments_select_authorized" on public.consultant_assignments
for select
to authenticated
using (
  private.is_platform_admin()
  or consultant_user_id = (select auth.uid())
  or private.can_access_org(organization_id)
);

drop policy if exists "consultant_assignments_write_platform_admin" on public.consultant_assignments;
create policy "consultant_assignments_write_platform_admin" on public.consultant_assignments
for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

drop policy if exists "service_subscriptions_select_authorized" on public.service_subscriptions;
create policy "service_subscriptions_select_authorized" on public.service_subscriptions
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "service_subscriptions_write_platform_admin" on public.service_subscriptions;
create policy "service_subscriptions_write_platform_admin" on public.service_subscriptions
for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists "audit_logs_select_authorized" on public.audit_logs;
create policy "audit_logs_select_authorized" on public.audit_logs
for select
to authenticated
using (
  private.is_platform_admin()
  or (
    organization_id is not null
    and private.is_assigned_consultant(organization_id)
  )
);

comment on table public.profiles is 'Perfil publico asociado a auth.users. No crear auth.users manualmente.';
comment on table public.organizations is 'Cliente/tenant de EcomScaling IA.';
comment on table public.organization_members is 'Usuarios de una organizacion y rol dentro del tenant.';
comment on table public.consultant_assignments is 'Consultores autorizados para una organizacion.';
comment on table public.service_subscriptions is 'Acceso comercial reflejado en la app.';
comment on table public.notifications is 'Notificaciones por usuario.';
comment on table public.audit_logs is 'Auditoria de cambios y accesos sensibles.';

grant usage on schema public to anon;
grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update on public.organization_members to authenticated;
grant select, insert, update on public.consultant_assignments to authenticated;
grant select, insert, update on public.service_subscriptions to authenticated;
grant select, update on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;
