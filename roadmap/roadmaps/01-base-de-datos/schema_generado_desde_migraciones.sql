-- =============================================================================
-- SCHEMA GENERADO DESDE MIGRACIONES REALES -- fuente ejecutable de verdad.
-- Regenerado manualmente el 2026-07-20 concatenando supabase/migrations/*.sql
-- en orden cronologico (34 archivos). Automatizar esta regeneracion + un check de
-- drift en CI sigue pendiente (ver ESTADO_GLOBAL.md, item P2).
-- NO editar este archivo a mano: para cambiar el esquema, anadir una migracion nueva
-- en supabase/migrations/ y regenerar.
-- =============================================================================

-- =============================================================================
-- Migracion: 20260715123324_db_00_infraestructura.sql
-- =============================================================================
create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;
grant usage on schema private to postgres;
grant usage on schema private to service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public;
grant execute on function private.set_updated_at() to postgres;
grant execute on function private.set_updated_at() to service_role;

-- =============================================================================
-- Migracion: 20260715123328_db_01_enums_core.sql
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'platform_role' and typnamespace = 'public'::regnamespace) then
    create type public.platform_role as enum (
      'user',
      'consultant',
      'platform_admin'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organization_status' and typnamespace = 'public'::regnamespace) then
    create type public.organization_status as enum (
      'onboarding',
      'active',
      'suspended',
      'cancelled'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'member_role' and typnamespace = 'public'::regnamespace) then
    create type public.member_role as enum (
      'owner',
      'manager',
      'member',
      'readonly'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'subscription_status' and typnamespace = 'public'::regnamespace) then
    create type public.subscription_status as enum (
      'pending',
      'trial',
      'active',
      'paused',
      'cancelled',
      'expired'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'notification_status' and typnamespace = 'public'::regnamespace) then
    create type public.notification_status as enum (
      'unread',
      'read',
      'archived'
    );
  end if;
end;
$$;

-- =============================================================================
-- Migracion: 20260715123333_db_02_auth_multitenant_rls.sql
-- =============================================================================
create table public.profiles (
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

create table public.organizations (
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

create table public.organization_members (
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

create table public.consultant_assignments (
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

create unique index consultant_assignments_one_primary_active_per_org
on public.consultant_assignments (organization_id)
where is_primary and is_active;

create table public.service_subscriptions (
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

create unique index service_subscriptions_one_current_per_org
on public.service_subscriptions (organization_id)
where status in ('trial', 'active');

create table public.notifications (
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

create table public.audit_logs (
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

create index profiles_platform_role_idx on public.profiles (platform_role);
create index profiles_is_active_idx on public.profiles (is_active);
create index organizations_status_idx on public.organizations (status);
create index organization_members_organization_id_idx on public.organization_members (organization_id);
create index organization_members_user_id_idx on public.organization_members (user_id);
create index organization_members_active_idx on public.organization_members (organization_id, user_id) where is_active;
create index consultant_assignments_organization_id_idx on public.consultant_assignments (organization_id);
create index consultant_assignments_consultant_user_id_idx on public.consultant_assignments (consultant_user_id);
create index consultant_assignments_active_idx on public.consultant_assignments (organization_id, consultant_user_id) where is_active;
create index service_subscriptions_organization_id_idx on public.service_subscriptions (organization_id);
create index service_subscriptions_status_idx on public.service_subscriptions (status);
create index notifications_user_id_idx on public.notifications (user_id);
create index notifications_organization_id_idx on public.notifications (organization_id);
create index notifications_status_idx on public.notifications (status);
create index notifications_created_at_idx on public.notifications (created_at);
create index audit_logs_organization_id_idx on public.audit_logs (organization_id);
create index audit_logs_actor_user_id_idx on public.audit_logs (actor_user_id);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at);

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

create trigger prevent_profile_privilege_escalation
before update on public.profiles
for each row execute function private.prevent_profile_privilege_escalation();

create trigger set_organizations_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger set_organization_members_updated_at
before update on public.organization_members
for each row execute function private.set_updated_at();

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

create policy "profiles_select_self_or_admin"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()) or private.is_platform_admin());

create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "organizations_select_authorized"
on public.organizations
for select
to authenticated
using (private.can_access_org(id));

create policy "organizations_insert_platform_admin"
on public.organizations
for insert
to authenticated
with check (private.is_platform_admin());

create policy "organizations_update_managers"
on public.organizations
for update
to authenticated
using (private.can_manage_org(id))
with check (private.can_manage_org(id));

create policy "organization_members_select_authorized_org"
on public.organization_members
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "organization_members_insert_managers"
on public.organization_members
for insert
to authenticated
with check (private.can_manage_org(organization_id));

create policy "organization_members_update_managers"
on public.organization_members
for update
to authenticated
using (private.can_manage_org(organization_id))
with check (private.can_manage_org(organization_id));

create policy "consultant_assignments_select_authorized"
on public.consultant_assignments
for select
to authenticated
using (
  private.is_platform_admin()
  or consultant_user_id = (select auth.uid())
  or private.can_access_org(organization_id)
);

create policy "consultant_assignments_write_platform_admin"
on public.consultant_assignments
for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "service_subscriptions_select_authorized"
on public.service_subscriptions
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "service_subscriptions_write_platform_admin"
on public.service_subscriptions
for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (user_id = (select auth.uid()));

create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "audit_logs_select_authorized"
on public.audit_logs
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

-- =============================================================================
-- Migracion: 20260715151041_db_04_integraciones_comunes.sql
-- =============================================================================
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider varchar(40) not null,
  provider_account_id varchar(255),
  provider_account_name varchar(255),
  status varchar(40) not null default 'pending',
  scopes text[] not null default '{}',
  api_version varchar(40),
  sync_cursor jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles (id) on delete set null,
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error_at timestamptz,
  last_error_message text,
  disconnected_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_provider_check check (
    provider in ('shopify', 'meta_ads', 'klaviyo', 'instagram', 'fathom', 'loom')
  ),
  constraint integration_connections_status_check check (
    status in ('pending', 'connected', 'syncing', 'error', 'disconnected', 'revoked')
  ),
  constraint integration_connections_unique_provider unique (organization_id, provider, provider_account_id)
);

create table private.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  credential_kind varchar(60) not null,
  encrypted_payload text not null,
  encryption_key_version varchar(40) not null default 'v1',
  expires_at timestamptz,
  rotated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_credentials_unique_kind unique (connection_id, credential_kind)
);

create table public.integration_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider varchar(40) not null,
  sync_type varchar(60) not null,
  status varchar(40) not null default 'queued',
  idempotency_key varchar(255) not null,
  external_operation_id varchar(255),
  cursor_before jsonb,
  cursor_after jsonb,
  records_read integer not null default 0,
  records_written integer not null default 0,
  records_failed integer not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  next_retry_at timestamptz,
  attempt_count integer not null default 0,
  error_code varchar(120),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_sync_runs_provider_check check (
    provider in ('shopify', 'meta_ads', 'klaviyo', 'instagram', 'fathom', 'loom')
  ),
  constraint integration_sync_runs_status_check check (
    status in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'retrying')
  ),
  constraint integration_sync_runs_sync_type_check check (
    sync_type in ('oauth', 'initial_import', 'incremental', 'reconciliation', 'webhook', 'manual')
  ),
  constraint integration_sync_runs_attempt_count_check check (attempt_count >= 0),
  constraint integration_sync_runs_counts_check check (
    records_read >= 0 and records_written >= 0 and records_failed >= 0
  ),
  constraint integration_sync_runs_unique_idempotency unique (provider, idempotency_key)
);

create table private.webhook_events (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid references public.integration_connections (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete cascade,
  provider varchar(40) not null,
  topic varchar(160) not null,
  external_event_id varchar(255),
  fingerprint text not null,
  signature_valid boolean not null default false,
  status varchar(40) not null default 'received',
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  payload jsonb not null,
  headers jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  constraint webhook_events_provider_check check (
    provider in ('shopify', 'meta_ads', 'klaviyo', 'instagram', 'fathom', 'loom')
  ),
  constraint webhook_events_status_check check (
    status in ('received', 'ignored_duplicate', 'queued', 'processed', 'failed')
  )
);

create unique index webhook_events_unique_external_id
on private.webhook_events (provider, external_event_id)
where external_event_id is not null;

create unique index webhook_events_unique_fingerprint
on private.webhook_events (provider, fingerprint);

create index integration_connections_organization_id_idx
on public.integration_connections (organization_id);

create index integration_connections_provider_status_idx
on public.integration_connections (provider, status);

create index integration_sync_runs_connection_id_idx
on public.integration_sync_runs (connection_id);

create index integration_sync_runs_organization_id_idx
on public.integration_sync_runs (organization_id);

create index integration_sync_runs_status_idx
on public.integration_sync_runs (status, next_retry_at);

create index integration_credentials_connection_id_idx
on private.integration_credentials (connection_id);

create index webhook_events_connection_id_idx
on private.webhook_events (connection_id);

create index webhook_events_status_idx
on private.webhook_events (status, received_at);

create trigger set_integration_connections_updated_at
before update on public.integration_connections
for each row execute function private.set_updated_at();

create trigger set_integration_credentials_updated_at
before update on private.integration_credentials
for each row execute function private.set_updated_at();

create trigger set_integration_sync_runs_updated_at
before update on public.integration_sync_runs
for each row execute function private.set_updated_at();

alter table public.integration_connections enable row level security;
alter table public.integration_sync_runs enable row level security;
alter table private.integration_credentials enable row level security;
alter table private.webhook_events enable row level security;

create policy "integration_connections_select_authorized"
on public.integration_connections
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "integration_connections_write_managers"
on public.integration_connections
for all
to authenticated
using (private.can_manage_org(organization_id))
with check (private.can_manage_org(organization_id));

create policy "integration_sync_runs_select_authorized"
on public.integration_sync_runs
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "integration_sync_runs_write_platform_admin"
on public.integration_sync_runs
for all
to authenticated
using (private.is_platform_admin())
with check (private.is_platform_admin());

comment on table public.integration_connections is 'Estado publico no secreto de conexiones con proveedores externos.';
comment on table private.integration_credentials is 'Credenciales cifradas por conexion. Nunca exponer al frontend.';
comment on table public.integration_sync_runs is 'Ejecuciones de sincronizacion, importacion, reconciliacion y webhooks.';
comment on table private.webhook_events is 'Payloads crudos de webhooks con deduplicacion y replay seguro.';

grant select, insert, update on public.integration_connections to authenticated;
grant select on public.integration_sync_runs to authenticated;

grant select, insert, update, delete on private.integration_credentials to service_role;
grant select, insert, update, delete on private.webhook_events to service_role;

-- =============================================================================
-- Migracion: 20260715173726_db_05_shopify_vertical_slice.sql
-- =============================================================================
create table public.shopify_stores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  external_shop_id varchar(255) not null,
  myshopify_domain varchar(255) not null,
  primary_domain varchar(255),
  shop_name varchar(255) not null,
  currency_code varchar(3),
  timezone varchar(100),
  plan_display_name varchar(120),
  weight_unit varchar(30),
  taxes_included boolean,
  is_active boolean not null default true,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_stores_unique_connection unique (connection_id),
  constraint shopify_stores_unique_external_shop unique (external_shop_id),
  constraint shopify_stores_unique_domain unique (myshopify_domain)
);

create table public.shopify_locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_location_id varchar(255) not null,
  name varchar(255) not null,
  is_active boolean not null default true,
  fulfills_online_orders boolean,
  address_data jsonb,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_locations_unique_external unique (store_id, external_location_id)
);

create table public.shopify_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_product_id varchar(255) not null,
  title varchar(255) not null,
  handle varchar(255),
  vendor varchar(180),
  product_type varchar(180),
  status varchar(50),
  published_at timestamptz,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_products_unique_external unique (store_id, external_product_id)
);

create table public.shopify_variants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  product_id uuid not null references public.shopify_products (id) on delete cascade,
  external_variant_id varchar(255) not null,
  title varchar(255),
  barcode varchar(180),
  current_price numeric(14,2),
  compare_at_price numeric(14,2),
  position int,
  taxable boolean,
  inventory_policy varchar(50),
  is_active boolean not null default true,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_variants_unique_external unique (product_id, external_variant_id)
);

create table public.shopify_inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  variant_id uuid not null unique references public.shopify_variants (id) on delete cascade,
  external_inventory_item_id varchar(255) not null unique,
  sku varchar(180),
  tracked boolean not null default false,
  requires_shipping boolean not null default true,
  current_unit_cost numeric(14,4),
  cost_currency_code varchar(3),
  country_code_of_origin varchar(2),
  province_code_of_origin varchar(10),
  harmonized_system_code varchar(20),
  measurement_data jsonb,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shopify_inventory_level_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_item_id uuid not null references public.shopify_inventory_items (id) on delete cascade,
  location_id uuid not null references public.shopify_locations (id) on delete cascade,
  external_inventory_level_id varchar(255),
  available_quantity integer,
  on_hand_quantity integer,
  committed_quantity integer,
  incoming_quantity integer,
  quantities_data jsonb,
  is_active boolean not null default true,
  captured_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint shopify_inventory_levels_unique_capture unique (inventory_item_id, location_id, captured_at)
);

create table public.shopify_order_facts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_order_id varchar(255) not null,
  order_name varchar(100),
  customer_reference_hash varchar(255),
  financial_status varchar(80),
  fulfillment_status varchar(80),
  source_name varchar(100),
  currency_code varchar(3),
  presentment_currency_code varchar(3),
  gross_sales numeric(14,2) not null default 0,
  discounts numeric(14,2) not null default 0,
  refunds numeric(14,2) not null default 0,
  net_sales numeric(14,2) not null default 0,
  current_subtotal_price numeric(14,2) not null default 0,
  current_shipping_price numeric(14,2) not null default 0,
  current_total_tax numeric(14,2) not null default 0,
  current_total_price numeric(14,2) not null default 0,
  total_items integer not null default 0,
  is_first_customer_order boolean,
  is_test_order boolean not null default false,
  external_created_at timestamptz,
  processed_at timestamptz,
  external_updated_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason varchar(120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_orders_unique_external unique (store_id, external_order_id)
);

create table public.shopify_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.shopify_order_facts (id) on delete cascade,
  product_id uuid references public.shopify_products (id) on delete set null,
  variant_id uuid references public.shopify_variants (id) on delete set null,
  external_line_item_id varchar(255) not null,
  title varchar(255) not null,
  sku_snapshot varchar(180),
  vendor_snapshot varchar(180),
  quantity_original integer not null default 0,
  quantity_current integer not null default 0,
  unit_price numeric(14,2) not null default 0,
  original_line_total numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  current_line_total numeric(14,2) not null default 0,
  refunded_quantity integer not null default 0,
  refunded_amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_order_items_unique_external unique (order_id, external_line_item_id)
);

create table public.shopify_refunds (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null references public.shopify_order_facts (id) on delete cascade,
  external_refund_id varchar(255) not null,
  total_refunded numeric(14,2) not null default 0,
  currency_code varchar(3),
  external_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_refunds_unique_external unique (order_id, external_refund_id)
);

create table public.shopify_refund_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  refund_id uuid not null references public.shopify_refunds (id) on delete cascade,
  order_item_id uuid not null references public.shopify_order_items (id) on delete cascade,
  location_id uuid references public.shopify_locations (id) on delete set null,
  external_refund_line_item_id varchar(255),
  quantity integer not null,
  subtotal numeric(14,2) not null default 0,
  total_tax numeric(14,2) not null default 0,
  restock_type varchar(80),
  created_at timestamptz not null default now(),
  constraint shopify_refund_items_unique_external unique (refund_id, external_refund_line_item_id)
);

create table public.product_costs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_item_id uuid not null references public.shopify_inventory_items (id) on delete cascade,
  unit_cost numeric(14,4) not null,
  currency_code varchar(3) not null default 'EUR',
  source varchar(40) not null,
  is_override boolean not null default false,
  valid_from date not null,
  valid_until date,
  created_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint product_costs_source_check check (source in ('shopify', 'manual', 'import'))
);

create index shopify_stores_organization_id_idx on public.shopify_stores (organization_id);
create index shopify_stores_connection_id_idx on public.shopify_stores (connection_id);
create index shopify_stores_domain_idx on public.shopify_stores (myshopify_domain);
create index shopify_locations_organization_id_idx on public.shopify_locations (organization_id);
create index shopify_locations_store_id_idx on public.shopify_locations (store_id);
create index shopify_products_organization_id_idx on public.shopify_products (organization_id);
create index shopify_products_store_id_idx on public.shopify_products (store_id);
create index shopify_variants_organization_id_idx on public.shopify_variants (organization_id);
create index shopify_variants_product_id_idx on public.shopify_variants (product_id);
create index shopify_inventory_items_organization_id_idx on public.shopify_inventory_items (organization_id);
create index shopify_inventory_items_sku_idx on public.shopify_inventory_items (sku);
create index shopify_inventory_level_snapshots_organization_id_idx on public.shopify_inventory_level_snapshots (organization_id);
create index shopify_inventory_level_snapshots_inventory_item_id_idx on public.shopify_inventory_level_snapshots (inventory_item_id);
create index shopify_inventory_level_snapshots_location_id_idx on public.shopify_inventory_level_snapshots (location_id);
create index shopify_inventory_level_snapshots_captured_at_idx on public.shopify_inventory_level_snapshots (captured_at);
create index shopify_order_facts_organization_id_idx on public.shopify_order_facts (organization_id);
create index shopify_order_facts_store_id_idx on public.shopify_order_facts (store_id);
create index shopify_order_facts_processed_at_idx on public.shopify_order_facts (processed_at);
create index shopify_order_items_organization_id_idx on public.shopify_order_items (organization_id);
create index shopify_order_items_order_id_idx on public.shopify_order_items (order_id);
create index shopify_order_items_product_id_idx on public.shopify_order_items (product_id);
create index shopify_order_items_variant_id_idx on public.shopify_order_items (variant_id);
create index shopify_refunds_organization_id_idx on public.shopify_refunds (organization_id);
create index shopify_refunds_order_id_idx on public.shopify_refunds (order_id);
create index shopify_refund_items_organization_id_idx on public.shopify_refund_items (organization_id);
create index shopify_refund_items_refund_id_idx on public.shopify_refund_items (refund_id);
create index shopify_refund_items_order_item_id_idx on public.shopify_refund_items (order_item_id);
create index product_costs_organization_id_idx on public.product_costs (organization_id);
create index product_costs_inventory_item_id_idx on public.product_costs (inventory_item_id);

create trigger set_shopify_stores_updated_at
before update on public.shopify_stores
for each row execute function private.set_updated_at();

create trigger set_shopify_locations_updated_at
before update on public.shopify_locations
for each row execute function private.set_updated_at();

create trigger set_shopify_products_updated_at
before update on public.shopify_products
for each row execute function private.set_updated_at();

create trigger set_shopify_variants_updated_at
before update on public.shopify_variants
for each row execute function private.set_updated_at();

create trigger set_shopify_inventory_items_updated_at
before update on public.shopify_inventory_items
for each row execute function private.set_updated_at();

create trigger set_shopify_order_facts_updated_at
before update on public.shopify_order_facts
for each row execute function private.set_updated_at();

create trigger set_shopify_order_items_updated_at
before update on public.shopify_order_items
for each row execute function private.set_updated_at();

create trigger set_shopify_refunds_updated_at
before update on public.shopify_refunds
for each row execute function private.set_updated_at();

create trigger set_product_costs_updated_at
before update on public.product_costs
for each row execute function private.set_updated_at();

alter table public.shopify_stores enable row level security;
alter table public.shopify_locations enable row level security;
alter table public.shopify_products enable row level security;
alter table public.shopify_variants enable row level security;
alter table public.shopify_inventory_items enable row level security;
alter table public.shopify_inventory_level_snapshots enable row level security;
alter table public.shopify_order_facts enable row level security;
alter table public.shopify_order_items enable row level security;
alter table public.shopify_refunds enable row level security;
alter table public.shopify_refund_items enable row level security;
alter table public.product_costs enable row level security;

create policy "shopify_stores_select_authorized"
on public.shopify_stores
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_locations_select_authorized"
on public.shopify_locations
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_products_select_authorized"
on public.shopify_products
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_variants_select_authorized"
on public.shopify_variants
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_inventory_items_select_authorized"
on public.shopify_inventory_items
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_inventory_level_snapshots_select_authorized"
on public.shopify_inventory_level_snapshots
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_order_facts_select_authorized"
on public.shopify_order_facts
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_order_items_select_authorized"
on public.shopify_order_items
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_refunds_select_authorized"
on public.shopify_refunds
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shopify_refund_items_select_authorized"
on public.shopify_refund_items
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "product_costs_select_authorized"
on public.product_costs
for select
to authenticated
using (private.can_access_org(organization_id));

comment on table public.shopify_stores is 'Tienda Shopify conectada a una organizacion.';
comment on table public.shopify_products is 'Productos sincronizados desde Shopify.';
comment on table public.shopify_variants is 'Variantes sincronizadas desde Shopify.';
comment on table public.shopify_inventory_items is 'InventoryItem sincronizado 1:1 con variante.';
comment on table public.shopify_locations is 'Ubicaciones de inventario y fulfillment.';
comment on table public.shopify_inventory_level_snapshots is 'Foto historica de stock por item y location.';
comment on table public.shopify_order_facts is 'Pedido Shopify sincronizado sin PII innecesaria.';
comment on table public.shopify_order_items is 'Linea economica del pedido.';
comment on table public.shopify_refunds is 'Cabecera de reembolso.';
comment on table public.shopify_refund_items is 'Linea concreta del reembolso.';
comment on table public.product_costs is 'Coste por inventory item para margen y beneficio.';

grant select on public.shopify_stores to authenticated;
grant select on public.shopify_locations to authenticated;
grant select on public.shopify_products to authenticated;
grant select on public.shopify_variants to authenticated;
grant select on public.shopify_inventory_items to authenticated;
grant select on public.shopify_inventory_level_snapshots to authenticated;
grant select on public.shopify_order_facts to authenticated;
grant select on public.shopify_order_items to authenticated;
grant select on public.shopify_refunds to authenticated;
grant select on public.shopify_refund_items to authenticated;
grant select on public.product_costs to authenticated;

-- =============================================================================
-- Migracion: 20260715180000_db_05a_shopify_sync_blocks.sql
-- =============================================================================
-- DB-05a: track Shopify sync progress per data block (catalog, inventory, orders, refunds)
-- instead of a single monolithic sync run, so partial failures are isolated and visible.

alter table public.integration_sync_runs
  add column if not exists sync_scope varchar(40);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_sync_runs_sync_scope_check'
      and conrelid = 'public.integration_sync_runs'::regclass
  ) then
    alter table public.integration_sync_runs
      add constraint integration_sync_runs_sync_scope_check check (
        sync_scope is null
        or sync_scope in ('catalog', 'inventory', 'orders', 'refunds', 'customers')
      );
  end if;
end $$;

create index if not exists integration_sync_runs_scope_idx
on public.integration_sync_runs (connection_id, sync_scope, created_at desc);

-- =============================================================================
-- Migracion: 20260715190000_db_05c_shopify_metrics.sql
-- =============================================================================
-- DB-05c: Shopify dashboard metrics - current stock view plus org-scoped
-- aggregation functions (sales summary, top products, stock summary).
-- Functions run as SECURITY INVOKER (the default) so RLS on the underlying
-- tables still restricts rows to organizations the caller can access, even
-- if target_organization_id is spoofed.

create or replace view public.shopify_inventory_current_levels as
select distinct on (inventory_item_id, location_id)
  id,
  organization_id,
  inventory_item_id,
  location_id,
  external_inventory_level_id,
  available_quantity,
  on_hand_quantity,
  committed_quantity,
  incoming_quantity,
  quantities_data,
  is_active,
  captured_at
from public.shopify_inventory_level_snapshots
order by inventory_item_id, location_id, captured_at desc;

grant select on public.shopify_inventory_current_levels to authenticated;

create or replace function public.shopify_sales_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  orders_count bigint,
  gross_sales numeric,
  net_sales numeric,
  discounts numeric,
  refunds numeric,
  units_sold bigint,
  aov numeric
)
language sql
stable
as $$
  select
    count(*) as orders_count,
    coalesce(sum(gross_sales), 0) as gross_sales,
    coalesce(sum(net_sales), 0) as net_sales,
    coalesce(sum(discounts), 0) as discounts,
    coalesce(sum(refunds), 0) as refunds,
    coalesce(sum(total_items), 0) as units_sold,
    case when count(*) > 0 then round(coalesce(sum(net_sales), 0) / count(*), 2) else 0 end as aov
  from public.shopify_order_facts
  where organization_id = target_organization_id
    and is_test_order = false
    and cancelled_at is null
    and coalesce(processed_at, external_created_at) between period_start and period_end;
$$;

grant execute on function public.shopify_sales_summary(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.shopify_top_products(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  result_limit integer default 10
)
returns table (
  product_id uuid,
  title varchar,
  quantity_sold bigint,
  revenue numeric
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.title,
    coalesce(sum(oi.quantity_current), 0) as quantity_sold,
    coalesce(sum(oi.current_line_total), 0) as revenue
  from public.shopify_order_items oi
  join public.shopify_order_facts o on o.id = oi.order_id
  join public.shopify_products p on p.id = oi.product_id
  where o.organization_id = target_organization_id
    and o.is_test_order = false
    and o.cancelled_at is null
    and coalesce(o.processed_at, o.external_created_at) between period_start and period_end
  group by p.id, p.title
  order by revenue desc
  limit result_limit;
$$;

grant execute on function public.shopify_top_products(uuid, timestamptz, timestamptz, integer) to authenticated;

create or replace function public.shopify_stock_summary(
  target_organization_id uuid,
  low_stock_threshold integer default 5
)
returns table (
  tracked_items bigint,
  total_available bigint,
  low_stock_items bigint,
  out_of_stock_items bigint
)
language sql
stable
as $$
  select
    count(*) as tracked_items,
    coalesce(sum(available_quantity), 0) as total_available,
    count(*) filter (where available_quantity is not null and available_quantity > 0 and available_quantity <= low_stock_threshold) as low_stock_items,
    count(*) filter (where coalesce(available_quantity, 0) <= 0) as out_of_stock_items
  from public.shopify_inventory_current_levels
  where organization_id = target_organization_id
    and is_active = true;
$$;

grant execute on function public.shopify_stock_summary(uuid, integer) to authenticated;

-- =============================================================================
-- Migracion: 20260715191500_db_05d_shopify_metrics_all_time.sql
-- =============================================================================
-- DB-05d: allow Shopify sales metrics to cover "all time" by treating a
-- null period_start as no lower bound, instead of capping the UI at 365 days.

create or replace function public.shopify_sales_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  orders_count bigint,
  gross_sales numeric,
  net_sales numeric,
  discounts numeric,
  refunds numeric,
  units_sold bigint,
  aov numeric
)
language sql
stable
as $$
  select
    count(*) as orders_count,
    coalesce(sum(gross_sales), 0) as gross_sales,
    coalesce(sum(net_sales), 0) as net_sales,
    coalesce(sum(discounts), 0) as discounts,
    coalesce(sum(refunds), 0) as refunds,
    coalesce(sum(total_items), 0) as units_sold,
    case when count(*) > 0 then round(coalesce(sum(net_sales), 0) / count(*), 2) else 0 end as aov
  from public.shopify_order_facts
  where organization_id = target_organization_id
    and is_test_order = false
    and cancelled_at is null
    and (period_start is null or coalesce(processed_at, external_created_at) >= period_start)
    and coalesce(processed_at, external_created_at) <= period_end;
$$;

create or replace function public.shopify_top_products(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  result_limit integer default 10
)
returns table (
  product_id uuid,
  title varchar,
  quantity_sold bigint,
  revenue numeric
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.title,
    coalesce(sum(oi.quantity_current), 0) as quantity_sold,
    coalesce(sum(oi.current_line_total), 0) as revenue
  from public.shopify_order_items oi
  join public.shopify_order_facts o on o.id = oi.order_id
  join public.shopify_products p on p.id = oi.product_id
  where o.organization_id = target_organization_id
    and o.is_test_order = false
    and o.cancelled_at is null
    and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
    and coalesce(o.processed_at, o.external_created_at) <= period_end
  group by p.id, p.title
  order by revenue desc
  limit result_limit;
$$;

-- =============================================================================
-- Migracion: 20260715193000_db_05e_shopify_performance.sql
-- =============================================================================
-- DB-05e: Shopify module performance pass.
--
-- 1) shopify_order_facts had no index matching the predicate used by the
--    sales metrics functions (organization_id + coalesce(processed_at,
--    external_created_at) + is_test_order/cancelled_at filters), forcing a
--    full table scan on every dashboard load as order history grows.
--
-- 2) shopify_inventory_level_snapshots is append-only: every full sync AND
--    every inventory_levels/update webhook inserted a brand new row, so the
--    table grows unbounded (potentially thousands of rows per day per
--    store) even though only the *latest* row per (inventory_item,
--    location) is ever read. shopify_inventory_current_levels then had to
--    DISTINCT ON the entire history on every stock query, getting slower
--    over time. shopify_inventory_current_state replaces that with a single
--    upserted row per SKU/location - O(1) writes and reads regardless of
--    how long the store has been syncing.

create index if not exists shopify_order_facts_org_processed_idx
on public.shopify_order_facts (organization_id, coalesce(processed_at, external_created_at))
where is_test_order = false and cancelled_at is null;

create table public.shopify_inventory_current_state (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  inventory_item_id uuid not null references public.shopify_inventory_items (id) on delete cascade,
  location_id uuid not null references public.shopify_locations (id) on delete cascade,
  external_inventory_level_id varchar(255),
  available_quantity integer,
  on_hand_quantity integer,
  committed_quantity integer,
  incoming_quantity integer,
  quantities_data jsonb,
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint shopify_inventory_current_state_unique unique (inventory_item_id, location_id)
);

create index shopify_inventory_current_state_organization_id_idx
on public.shopify_inventory_current_state (organization_id);

alter table public.shopify_inventory_current_state enable row level security;

create policy "shopify_inventory_current_state_select_authorized"
on public.shopify_inventory_current_state
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.shopify_inventory_current_state to authenticated;

create trigger set_shopify_inventory_current_state_updated_at
before update on public.shopify_inventory_current_state
for each row execute function private.set_updated_at();

insert into public.shopify_inventory_current_state (
  organization_id, inventory_item_id, location_id, external_inventory_level_id,
  available_quantity, on_hand_quantity, committed_quantity, incoming_quantity,
  quantities_data, is_active, updated_at
)
select
  organization_id, inventory_item_id, location_id, external_inventory_level_id,
  available_quantity, on_hand_quantity, committed_quantity, incoming_quantity,
  quantities_data, is_active, captured_at
from public.shopify_inventory_current_levels
on conflict (inventory_item_id, location_id) do nothing;

create or replace function public.shopify_stock_summary(
  target_organization_id uuid,
  low_stock_threshold integer default 5
)
returns table (
  tracked_items bigint,
  total_available bigint,
  low_stock_items bigint,
  out_of_stock_items bigint
)
language sql
stable
as $$
  select
    count(*) as tracked_items,
    coalesce(sum(available_quantity), 0) as total_available,
    count(*) filter (where available_quantity is not null and available_quantity > 0 and available_quantity <= low_stock_threshold) as low_stock_items,
    count(*) filter (where coalesce(available_quantity, 0) <= 0) as out_of_stock_items
  from public.shopify_inventory_current_state
  where organization_id = target_organization_id
    and is_active = true;
$$;

comment on table public.shopify_inventory_current_state is 'Estado de stock actual por item+location (upsert), reemplaza el uso de shopify_inventory_level_snapshots para lecturas de "stock ahora mismo".';

-- =============================================================================
-- Migracion: 20260715194500_db_05f_shopify_margin.sql
-- =============================================================================
-- DB-05f: gross margin metric, using whatever product_costs rows exist for
-- the period. Costs are optional per SKU (valid_from/valid_until ranges), so
-- the function also reports how many line items had a matching cost, since
-- margin_pct is only meaningful once most items are priced.

create or replace function public.shopify_margin_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  revenue numeric,
  cogs numeric,
  gross_margin numeric,
  margin_pct numeric,
  items_with_cost bigint,
  items_without_cost bigint
)
language sql
stable
as $$
  with priced_items as (
    select
      oi.id as order_item_id,
      greatest(oi.quantity_current - oi.refunded_quantity, 0) as net_quantity,
      oi.current_line_total - oi.discount_total as item_revenue,
      (
        select pc.unit_cost
        from public.product_costs pc
        where pc.inventory_item_id = ii.id
          and pc.valid_from <= coalesce(o.processed_at, o.external_created_at)::date
          and (pc.valid_until is null or pc.valid_until >= coalesce(o.processed_at, o.external_created_at)::date)
        order by pc.valid_from desc
        limit 1
      ) as unit_cost
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id
    left join public.shopify_inventory_items ii on ii.variant_id = oi.variant_id
    where o.organization_id = target_organization_id
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  )
  select
    coalesce(sum(item_revenue), 0) as revenue,
    coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0) as cogs,
    coalesce(sum(item_revenue) filter (where unit_cost is not null), 0)
      - coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0) as gross_margin,
    case
      when coalesce(sum(item_revenue) filter (where unit_cost is not null), 0) > 0 then round(
        (
          coalesce(sum(item_revenue) filter (where unit_cost is not null), 0)
          - coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0)
        ) / sum(item_revenue) filter (where unit_cost is not null) * 100,
        2
      )
      else 0
    end as margin_pct,
    count(*) filter (where unit_cost is not null) as items_with_cost,
    count(*) filter (where unit_cost is null) as items_without_cost
  from priced_items;
$$;

grant execute on function public.shopify_margin_summary(uuid, timestamptz, timestamptz) to authenticated;

comment on function public.shopify_margin_summary is 'Margen bruto calculado solo sobre lineas de pedido que tienen un product_costs vigente en la fecha del pedido; margin_pct ignora lineas sin coste cargado (ver items_without_cost).';

-- =============================================================================
-- Migracion: 20260715200000_db_06_shopify_customers.sql
-- =============================================================================
-- DB-06: Shopify customers block. Reference implementation of the
-- integration-module pattern (see ADR-0006): its own sync_scope, upsert
-- in-place (current state, not append-only), no raw PII (mirrors
-- shopify_order_facts.customer_reference_hash - behavioral fields only).

alter table public.integration_sync_runs
  drop constraint integration_sync_runs_sync_scope_check;

alter table public.integration_sync_runs
  add constraint integration_sync_runs_sync_scope_check check (
    sync_scope is null
    or sync_scope in ('catalog', 'inventory', 'orders', 'refunds', 'customers')
  );

create table public.shopify_customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  external_customer_id varchar(255) not null,
  customer_reference_hash varchar(255) not null,
  number_of_orders integer not null default 0,
  amount_spent numeric(14,2) not null default 0,
  currency_code varchar(3),
  state varchar(40),
  tags text[] not null default '{}',
  is_active boolean not null default true,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_customers_unique_external unique (store_id, external_customer_id)
);

create index shopify_customers_organization_id_idx on public.shopify_customers (organization_id);
create index shopify_customers_store_id_idx on public.shopify_customers (store_id);
create index shopify_customers_reference_hash_idx on public.shopify_customers (customer_reference_hash);

alter table public.shopify_customers enable row level security;

create policy "shopify_customers_select_authorized"
on public.shopify_customers
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.shopify_customers to authenticated;

create trigger set_shopify_customers_updated_at
before update on public.shopify_customers
for each row execute function private.set_updated_at();

comment on table public.shopify_customers is 'Clientes Shopify sin PII: solo hash de referencia y metricas de comportamiento (pedidos, gasto, estado, tags).';

-- =============================================================================
-- Migracion: 20260716102738_db_06a_security_invoker_views.sql
-- =============================================================================
-- DB-06a: force RLS to apply through public views.
--
-- In Postgres/Supabase, views can bypass underlying table RLS unless they are
-- created with security_invoker=true. This view is granted to authenticated
-- users, so it must execute with the caller's permissions.

alter view public.shopify_inventory_current_levels
set (security_invoker = true);

-- =============================================================================
-- Migracion: 20260716113848_db_05g_shopify_metrics_store_scope.sql
-- =============================================================================
-- DB-05g: allow Shopify metrics to be scoped to one connected store.
-- Existing org-level function signatures remain available for backwards
-- compatibility. The API calls these overloads when a connection/store is
-- selected from the UI.

create or replace function public.shopify_sales_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  orders_count bigint,
  gross_sales numeric,
  net_sales numeric,
  discounts numeric,
  refunds numeric,
  units_sold bigint,
  aov numeric
)
language sql
stable
as $$
  select
    count(*) as orders_count,
    coalesce(sum(gross_sales), 0) as gross_sales,
    coalesce(sum(net_sales), 0) as net_sales,
    coalesce(sum(discounts), 0) as discounts,
    coalesce(sum(refunds), 0) as refunds,
    coalesce(sum(total_items), 0) as units_sold,
    case when count(*) > 0 then round(coalesce(sum(net_sales), 0) / count(*), 2) else 0 end as aov
  from public.shopify_order_facts
  where organization_id = target_organization_id
    and (target_store_id is null or store_id = target_store_id)
    and is_test_order = false
    and cancelled_at is null
    and (period_start is null or coalesce(processed_at, external_created_at) >= period_start)
    and coalesce(processed_at, external_created_at) <= period_end;
$$;

grant execute on function public.shopify_sales_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

create or replace function public.shopify_top_products(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  result_limit integer,
  target_store_id uuid
)
returns table (
  product_id uuid,
  title varchar,
  quantity_sold bigint,
  revenue numeric
)
language sql
stable
as $$
  select
    p.id as product_id,
    p.title,
    coalesce(sum(oi.quantity_current), 0) as quantity_sold,
    coalesce(sum(oi.current_line_total), 0) as revenue
  from public.shopify_order_items oi
  join public.shopify_order_facts o on o.id = oi.order_id
  join public.shopify_products p on p.id = oi.product_id
  where o.organization_id = target_organization_id
    and (target_store_id is null or o.store_id = target_store_id)
    and (target_store_id is null or p.store_id = target_store_id)
    and o.is_test_order = false
    and o.cancelled_at is null
    and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
    and coalesce(o.processed_at, o.external_created_at) <= period_end
  group by p.id, p.title
  order by revenue desc
  limit result_limit;
$$;

grant execute on function public.shopify_top_products(uuid, timestamptz, timestamptz, integer, uuid) to authenticated;

create or replace function public.shopify_stock_summary(
  target_organization_id uuid,
  low_stock_threshold integer,
  target_store_id uuid
)
returns table (
  tracked_items bigint,
  total_available bigint,
  low_stock_items bigint,
  out_of_stock_items bigint
)
language sql
stable
as $$
  select
    count(*) as tracked_items,
    coalesce(sum(s.available_quantity), 0) as total_available,
    count(*) filter (
      where s.available_quantity is not null
        and s.available_quantity > 0
        and s.available_quantity <= low_stock_threshold
    ) as low_stock_items,
    count(*) filter (where coalesce(s.available_quantity, 0) <= 0) as out_of_stock_items
  from public.shopify_inventory_current_state s
  join public.shopify_inventory_items ii on ii.id = s.inventory_item_id
  join public.shopify_variants v on v.id = ii.variant_id
  join public.shopify_products p on p.id = v.product_id
  where s.organization_id = target_organization_id
    and (target_store_id is null or p.store_id = target_store_id)
    and s.is_active = true;
$$;

grant execute on function public.shopify_stock_summary(uuid, integer, uuid) to authenticated;

create or replace function public.shopify_margin_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  revenue numeric,
  cogs numeric,
  gross_margin numeric,
  margin_pct numeric,
  items_with_cost bigint,
  items_without_cost bigint
)
language sql
stable
as $$
  with priced_items as (
    select
      oi.id as order_item_id,
      greatest(oi.quantity_current - oi.refunded_quantity, 0) as net_quantity,
      oi.current_line_total - oi.discount_total as item_revenue,
      (
        select pc.unit_cost
        from public.product_costs pc
        where pc.inventory_item_id = ii.id
          and pc.valid_from <= coalesce(o.processed_at, o.external_created_at)::date
          and (pc.valid_until is null or pc.valid_until >= coalesce(o.processed_at, o.external_created_at)::date)
        order by pc.valid_from desc
        limit 1
      ) as unit_cost
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id
    left join public.shopify_inventory_items ii on ii.variant_id = oi.variant_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  )
  select
    coalesce(sum(item_revenue), 0) as revenue,
    coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0) as cogs,
    coalesce(sum(item_revenue) filter (where unit_cost is not null), 0)
      - coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0) as gross_margin,
    case
      when coalesce(sum(item_revenue) filter (where unit_cost is not null), 0) > 0 then round(
        (
          coalesce(sum(item_revenue) filter (where unit_cost is not null), 0)
          - coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null), 0)
        ) / sum(item_revenue) filter (where unit_cost is not null) * 100,
        2
      )
      else 0
    end as margin_pct,
    count(*) filter (where unit_cost is not null) as items_with_cost,
    count(*) filter (where unit_cost is null) as items_without_cost
  from priced_items;
$$;

grant execute on function public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_sales_summary(uuid, timestamptz, timestamptz, uuid) is 'Resumen de ventas Shopify filtrable por store_id; null mantiene lectura a nivel organizacion.';
comment on function public.shopify_top_products(uuid, timestamptz, timestamptz, integer, uuid) is 'Top productos Shopify filtrable por store_id; null mantiene lectura a nivel organizacion.';
comment on function public.shopify_stock_summary(uuid, integer, uuid) is 'Resumen de stock Shopify filtrable por store_id; null mantiene lectura a nivel organizacion.';
comment on function public.shopify_margin_summary(uuid, timestamptz, timestamptz, uuid) is 'Resumen de margen Shopify filtrable por store_id; null mantiene lectura a nivel organizacion.';

-- =============================================================================
-- Migracion: 20260717073000_db_08_shopify_expiring_tokens.sql
-- =============================================================================
alter table private.integration_credentials
  add column refresh_token_expires_at timestamptz,
  add column refresh_locked_at timestamptz;

comment on column private.integration_credentials.expires_at is
  'Expiracion del access token. Para tokens Shopify offline expiring=1, se refresca antes de este instante.';
comment on column private.integration_credentials.refresh_token_expires_at is
  'Expiracion del refresh token asociado. Cuando pasa, ya no se puede renovar y hace falta reconectar.';
comment on column private.integration_credentials.refresh_locked_at is
  'Claim temporal para evitar que dos procesos renueven el mismo token a la vez. Se limpia tras renovar o expira sola a los 20s.';

-- =============================================================================
-- Migracion: 20260717160000_db_03_configuracion_financiera.sql
-- =============================================================================
-- DB-03: configuracion financiera manual (settings, gastos fijos, reglas de
-- envio y objetivos) para calcular beneficio neto y break-even sin hojas
-- externas. Lectura via RLS (can_access_org); escritura solo via API con
-- service role + chequeo manual de rol owner/manager, igual que product_costs.
-- Cambios quedan auditados en audit_logs via trigger.

create table public.organization_financial_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  currency_code varchar(3) not null default 'EUR',
  payment_fee_pct numeric(5, 2) not null default 0,
  payment_fee_fixed numeric(10, 2) not null default 0,
  default_shipping_cost numeric(10, 2) not null default 0,
  vat_pct numeric(5, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_financial_settings_unique_org unique (organization_id),
  constraint organization_financial_settings_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint organization_financial_settings_payment_fee_pct_range check (payment_fee_pct >= 0 and payment_fee_pct <= 100),
  constraint organization_financial_settings_payment_fee_fixed_range check (payment_fee_fixed >= 0),
  constraint organization_financial_settings_shipping_range check (default_shipping_cost >= 0),
  constraint organization_financial_settings_vat_pct_range check (vat_pct >= 0 and vat_pct <= 100)
);

create table public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name varchar(160) not null,
  category varchar(80),
  amount numeric(12, 2) not null,
  currency_code varchar(3) not null default 'EUR',
  billing_period varchar(20) not null default 'monthly',
  valid_from date not null default current_date,
  valid_until date,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_expenses_amount_range check (amount >= 0),
  constraint fixed_expenses_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint fixed_expenses_billing_period_values check (billing_period in ('monthly', 'yearly')),
  constraint fixed_expenses_valid_period check (valid_until is null or valid_until > valid_from)
);

create table public.shipping_cost_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name varchar(160) not null,
  country_code varchar(2),
  cost_per_order numeric(10, 2) not null,
  currency_code varchar(3) not null default 'EUR',
  min_order_total numeric(12, 2) not null default 0,
  max_order_total numeric(12, 2),
  valid_from date not null default current_date,
  valid_until date,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_cost_rules_cost_range check (cost_per_order >= 0),
  constraint shipping_cost_rules_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint shipping_cost_rules_country_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint shipping_cost_rules_order_total_range check (max_order_total is null or max_order_total > min_order_total),
  constraint shipping_cost_rules_min_total_range check (min_order_total >= 0),
  constraint shipping_cost_rules_valid_period check (valid_until is null or valid_until > valid_from)
);

create table public.organization_metric_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  metric_key varchar(80) not null,
  target_value numeric(14, 2) not null,
  period varchar(20) not null default 'monthly',
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_metric_targets_period_values check (period in ('monthly', 'quarterly', 'yearly')),
  constraint organization_metric_targets_valid_period check (valid_until is null or valid_until > valid_from),
  constraint organization_metric_targets_unique_active unique (organization_id, metric_key, period, valid_from)
);

create index organization_financial_settings_org_idx on public.organization_financial_settings (organization_id);
create index fixed_expenses_org_idx on public.fixed_expenses (organization_id);
create index fixed_expenses_org_active_idx on public.fixed_expenses (organization_id, valid_from, valid_until) where is_active;
create index shipping_cost_rules_org_idx on public.shipping_cost_rules (organization_id);
create index shipping_cost_rules_org_active_idx on public.shipping_cost_rules (organization_id, valid_from, valid_until) where is_active;
create index organization_metric_targets_org_idx on public.organization_metric_targets (organization_id);
create index organization_metric_targets_lookup_idx on public.organization_metric_targets (organization_id, metric_key, valid_from);

create trigger set_organization_financial_settings_updated_at
before update on public.organization_financial_settings
for each row execute function private.set_updated_at();

create trigger set_fixed_expenses_updated_at
before update on public.fixed_expenses
for each row execute function private.set_updated_at();

create trigger set_shipping_cost_rules_updated_at
before update on public.shipping_cost_rules
for each row execute function private.set_updated_at();

create trigger set_organization_metric_targets_updated_at
before update on public.organization_metric_targets
for each row execute function private.set_updated_at();

-- Auditoria: cualquier cambio financiero relevante queda en audit_logs con
-- old/new completos. security definer porque el insert lo dispara el service
-- role de la API y audit_logs no tiene policy de insert para authenticated.
create or replace function private.log_financial_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    tg_table_name || '_' || lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.log_financial_change() from public;

create trigger audit_organization_financial_settings
after insert or update or delete on public.organization_financial_settings
for each row execute function private.log_financial_change();

create trigger audit_fixed_expenses
after insert or update or delete on public.fixed_expenses
for each row execute function private.log_financial_change();

create trigger audit_shipping_cost_rules
after insert or update or delete on public.shipping_cost_rules
for each row execute function private.log_financial_change();

create trigger audit_organization_metric_targets
after insert or update or delete on public.organization_metric_targets
for each row execute function private.log_financial_change();

alter table public.organization_financial_settings enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.shipping_cost_rules enable row level security;
alter table public.organization_metric_targets enable row level security;

create policy "organization_financial_settings_select_authorized"
on public.organization_financial_settings
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "fixed_expenses_select_authorized"
on public.fixed_expenses
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shipping_cost_rules_select_authorized"
on public.shipping_cost_rules
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "organization_metric_targets_select_authorized"
on public.organization_metric_targets
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.organization_financial_settings to authenticated;
grant select on public.fixed_expenses to authenticated;
grant select on public.shipping_cost_rules to authenticated;
grant select on public.organization_metric_targets to authenticated;

comment on table public.organization_financial_settings is 'Parametros financieros manuales por organizacion (comisiones de pago, envio por defecto, IVA). Una fila por organizacion, upsert in-place.';
comment on table public.fixed_expenses is 'Gastos fijos con vigencia temporal para el calculo de beneficio neto y break-even.';
comment on table public.shipping_cost_rules is 'Reglas de coste de envio por pais/tramo de pedido. default_shipping_cost de settings actua como fallback.';
comment on table public.organization_metric_targets is 'Objetivos de metricas por organizacion y periodo.';

-- Motor financiero MVP: beneficio neto estimado y break-even mensual.
-- security invoker (default): las RLS de las tablas subyacentes limitan filas
-- aunque target_organization_id venga falseado. Misma convencion de scope por
-- tienda que db_05g.
create or replace function public.shopify_financial_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  net_sales numeric,
  orders_count bigint,
  cogs numeric,
  gross_margin numeric,
  payment_fees numeric,
  shipping_costs numeric,
  fixed_costs numeric,
  net_profit numeric,
  net_margin_pct numeric,
  monthly_fixed_costs numeric,
  break_even_monthly_revenue numeric,
  has_settings boolean,
  fixed_expenses_count bigint,
  items_without_cost bigint
)
language sql
stable
as $$
  with period as (
    select
      coalesce(
        period_start,
        (
          select min(coalesce(o.processed_at, o.external_created_at))
          from public.shopify_order_facts o
          where o.organization_id = target_organization_id
            and (target_store_id is null or o.store_id = target_store_id)
        ),
        period_end
      ) as effective_start,
      period_end as effective_end
  ),
  sales as (
    select
      coalesce(sum(o.net_sales), 0) as net_sales,
      count(*) as orders_count
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  margin as (
    select m.cogs, m.items_without_cost
    from public.shopify_margin_summary(target_organization_id, period_start, period_end, target_store_id) m
  ),
  settings as (
    select s.payment_fee_pct, s.payment_fee_fixed, s.default_shipping_cost
    from public.organization_financial_settings s
    where s.organization_id = target_organization_id
  ),
  fixed as (
    select
      coalesce(
        sum(
          (case when fe.billing_period = 'yearly' then fe.amount / 12 else fe.amount end)
          * greatest(
              extract(
                epoch from (
                  least(coalesce(fe.valid_until::timestamptz, p.effective_end), p.effective_end)
                  - greatest(fe.valid_from::timestamptz, p.effective_start)
                )
              ) / 86400.0,
              0
            )
          / 30.44
        ),
        0
      ) as fixed_costs_period,
      coalesce(
        sum(case when fe.billing_period = 'yearly' then fe.amount / 12 else fe.amount end)
          filter (
            where fe.valid_from <= current_date
              and (fe.valid_until is null or fe.valid_until >= current_date)
          ),
        0
      ) as monthly_fixed_costs,
      count(*) as fixed_expenses_count
    from public.fixed_expenses fe
    cross join period p
    where fe.organization_id = target_organization_id
      and fe.is_active
  )
  select
    s.net_sales,
    s.orders_count,
    m.cogs,
    s.net_sales - m.cogs as gross_margin,
    round(s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0), 2) as payment_fees,
    round(s.orders_count * coalesce(st.default_shipping_cost, 0), 2) as shipping_costs,
    round(f.fixed_costs_period, 2) as fixed_costs,
    round(
      s.net_sales - m.cogs
      - (s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0))
      - s.orders_count * coalesce(st.default_shipping_cost, 0)
      - f.fixed_costs_period,
      2
    ) as net_profit,
    case
      when s.net_sales > 0 then round(
        (
          s.net_sales - m.cogs
          - (s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0))
          - s.orders_count * coalesce(st.default_shipping_cost, 0)
          - f.fixed_costs_period
        ) / s.net_sales * 100,
        2
      )
      else 0
    end as net_margin_pct,
    round(f.monthly_fixed_costs, 2) as monthly_fixed_costs,
    case
      when s.net_sales > 0
        and (
          s.net_sales - m.cogs
          - (s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0))
          - s.orders_count * coalesce(st.default_shipping_cost, 0)
        ) > 0
      then round(
        f.monthly_fixed_costs / (
          (
            s.net_sales - m.cogs
            - (s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0))
            - s.orders_count * coalesce(st.default_shipping_cost, 0)
          ) / s.net_sales
        ),
        2
      )
      else null
    end as break_even_monthly_revenue,
    exists (select 1 from settings) as has_settings,
    f.fixed_expenses_count,
    m.items_without_cost
  from sales s
  cross join margin m
  cross join fixed f
  left join settings st on true;
$$;

grant execute on function public.shopify_financial_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_financial_summary is 'Beneficio neto estimado del periodo: ventas netas - COGS (solo lineas con coste, ver items_without_cost) - comisiones de pago - envio estimado por pedido - gastos fijos prorrateados. break_even_monthly_revenue = gastos fijos mensuales / ratio de margen de contribucion; null si el margen de contribucion no es positivo.';

-- =============================================================================
-- Migracion: 20260717170000_db_06_meta_ads.sql
-- =============================================================================
-- DB-06: esquema Meta Ads segun el contrato DBML v0.2. Activos publicitarios
-- (business, pages, ad accounts, campaigns, ad sets, ads, creatives), insights
-- diarios normalizados (fila base + arrays de acciones + KPIs calculados) y
-- seguimiento de report runs asincronos. Tokens por activo van a private.
-- Lectura via RLS (can_access_org); escritura solo via service role (worker/API),
-- igual que el resto de modulos de integracion (ADR-0006).

create type public.meta_insight_level as enum ('account', 'campaign', 'adset', 'ad');

create type public.meta_creative_asset_type as enum (
  'image',
  'video',
  'primary_text',
  'headline',
  'description',
  'call_to_action',
  'link_url',
  'thumbnail',
  'other'
);

create type public.meta_report_status as enum ('pending', 'running', 'completed', 'failed', 'cancelled');

create table public.meta_business_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  external_business_id varchar(255) not null,
  name varchar(255) not null,
  verification_status varchar(80),
  vertical varchar(120),
  is_selected boolean not null default true,
  is_active boolean not null default true,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_business_accounts_unique_external unique (connection_id, external_business_id)
);

create table public.meta_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  business_account_id uuid references public.meta_business_accounts (id) on delete set null,
  external_page_id varchar(255) not null,
  name varchar(255) not null,
  category varchar(180),
  tasks jsonb,
  picture_url text,
  is_selected boolean not null default true,
  is_active boolean not null default true,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_pages_unique_external unique (connection_id, external_page_id)
);

create table private.meta_asset_tokens (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  asset_type varchar(80) not null,
  external_asset_id varchar(255) not null,
  access_token_encrypted text not null,
  scopes jsonb,
  token_expires_at timestamptz,
  encryption_key_version varchar(50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_asset_tokens_unique_asset unique (connection_id, asset_type, external_asset_id)
);

create table public.meta_ad_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  business_account_id uuid references public.meta_business_accounts (id) on delete set null,
  external_ad_account_id varchar(255) not null,
  account_name varchar(255) not null,
  account_status_code int,
  disable_reason_code int,
  currency_code varchar(3),
  timezone_name varchar(100),
  timezone_offset_hours_utc numeric(6, 2),
  amount_spent numeric(16, 2),
  balance numeric(16, 2),
  spend_cap numeric(16, 2),
  minimum_daily_budget numeric(16, 2),
  is_selected boolean not null default true,
  is_active boolean not null default true,
  raw_data jsonb,
  last_synced_at timestamptz,
  external_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_ad_accounts_unique_external unique (connection_id, external_ad_account_id),
  constraint meta_ad_accounts_currency_format check (currency_code is null or currency_code ~ '^[A-Z]{3}$')
);

create table public.meta_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  external_campaign_id varchar(255) not null,
  name varchar(255) not null,
  objective varchar(120),
  buying_type varchar(80),
  configured_status varchar(80),
  effective_status varchar(80),
  special_ad_categories jsonb,
  daily_budget numeric(16, 2),
  lifetime_budget numeric(16, 2),
  budget_remaining numeric(16, 2),
  bid_strategy varchar(120),
  starts_at timestamptz,
  ends_at timestamptz,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_campaigns_unique_external unique (ad_account_id, external_campaign_id)
);

create table public.meta_ad_sets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null references public.meta_campaigns (id) on delete cascade,
  external_ad_set_id varchar(255) not null,
  name varchar(255) not null,
  configured_status varchar(80),
  effective_status varchar(80),
  optimization_goal varchar(120),
  billing_event varchar(120),
  bid_strategy varchar(120),
  bid_amount numeric(16, 2),
  daily_budget numeric(16, 2),
  lifetime_budget numeric(16, 2),
  budget_remaining numeric(16, 2),
  destination_type varchar(120),
  promoted_object jsonb,
  targeting_data jsonb,
  attribution_spec jsonb,
  is_dynamic_creative boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_ad_sets_unique_external unique (campaign_id, external_ad_set_id)
);

create table public.meta_creatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  external_creative_id varchar(255) not null,
  name varchar(255),
  object_type varchar(100),
  object_story_id varchar(255),
  effective_object_story_id varchar(255),
  call_to_action_type varchar(100),
  primary_text text,
  headline varchar(500),
  description text,
  link_url text,
  thumbnail_url text,
  image_hash varchar(255),
  external_video_id varchar(255),
  url_tags text,
  object_story_spec jsonb,
  asset_feed_spec jsonb,
  degrees_of_freedom_spec jsonb,
  raw_data jsonb,
  last_synced_at timestamptz,
  external_created_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_creatives_unique_external unique (ad_account_id, external_creative_id)
);

create table public.meta_creative_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creative_id uuid not null references public.meta_creatives (id) on delete cascade,
  asset_type public.meta_creative_asset_type not null,
  position int not null default 0,
  external_asset_id varchar(255),
  asset_hash varchar(255),
  text_value text,
  media_url text,
  thumbnail_url text,
  link_url text,
  asset_label varchar(180),
  is_primary boolean not null default false,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.meta_ads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_set_id uuid not null references public.meta_ad_sets (id) on delete cascade,
  current_creative_id uuid references public.meta_creatives (id) on delete set null,
  external_ad_id varchar(255) not null,
  name varchar(255) not null,
  configured_status varchar(80),
  effective_status varchar(80),
  parsed_angle varchar(180),
  parsed_format varchar(120),
  parsed_hook varchar(255),
  naming_parser_version varchar(50),
  parsed_naming_data jsonb,
  tracking_specs jsonb,
  conversion_specs jsonb,
  review_feedback jsonb,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_ads_unique_external unique (ad_set_id, external_ad_id)
);

create table public.meta_ad_creative_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_id uuid not null references public.meta_ads (id) on delete cascade,
  creative_id uuid not null references public.meta_creatives (id) on delete cascade,
  valid_from timestamptz not null,
  valid_until timestamptz,
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint meta_ad_creative_assignments_valid_period check (valid_until is null or valid_until > valid_from)
);

create table public.meta_insight_rows_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  campaign_id uuid references public.meta_campaigns (id) on delete set null,
  ad_set_id uuid references public.meta_ad_sets (id) on delete set null,
  ad_id uuid references public.meta_ads (id) on delete set null,
  level public.meta_insight_level not null,
  external_entity_id varchar(255) not null,
  metric_date date not null,
  publisher_platform varchar(80),
  platform_position varchar(120),
  device_platform varchar(80),
  breakdowns jsonb,
  breakdown_hash varchar(64) not null default 'none',
  attribution_windows jsonb,
  attribution_hash varchar(64) not null default 'default',
  action_report_time varchar(50) not null default 'default',
  spend numeric(18, 4) not null default 0,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  frequency numeric(12, 6),
  clicks bigint not null default 0,
  unique_clicks bigint not null default 0,
  inline_link_clicks bigint not null default 0,
  outbound_clicks bigint not null default 0,
  cpm numeric(18, 6),
  cpc numeric(18, 6),
  ctr numeric(12, 6),
  cpp numeric(18, 6),
  raw_data jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_insight_rows_daily_unique_row unique (
    ad_account_id,
    level,
    external_entity_id,
    metric_date,
    breakdown_hash,
    attribution_hash,
    action_report_time
  ),
  constraint meta_insight_rows_daily_level_refs check (
    (level = 'account' and campaign_id is null and ad_set_id is null and ad_id is null)
    or (level = 'campaign' and ad_set_id is null and ad_id is null)
    or (level = 'adset' and ad_id is null)
    or level = 'ad'
  )
);

create table public.meta_insight_action_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  insight_row_id uuid not null references public.meta_insight_rows_daily (id) on delete cascade,
  metric_name varchar(120) not null,
  action_type varchar(180) not null default 'none',
  attribution_window varchar(80) not null default 'default',
  value numeric(20, 6),
  raw_value jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_insight_action_metrics_unique_metric unique (
    insight_row_id,
    metric_name,
    action_type,
    attribution_window
  )
);

create table public.meta_calculated_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  insight_row_id uuid not null references public.meta_insight_rows_daily (id) on delete cascade,
  metric_code varchar(120) not null,
  value numeric(20, 8),
  formula_code varchar(120) not null,
  formula_version varchar(50) not null,
  input_data jsonb,
  calculated_at timestamptz not null default now(),
  constraint meta_calculated_metrics_daily_unique_metric unique (insight_row_id, metric_code, formula_version)
);

create table public.meta_insight_report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  ad_account_id uuid not null references public.meta_ad_accounts (id) on delete cascade,
  sync_run_id uuid references public.integration_sync_runs (id) on delete set null,
  external_report_run_id varchar(255) not null,
  level public.meta_insight_level not null,
  status public.meta_report_status not null default 'pending',
  percent_complete numeric(6, 2) not null default 0,
  request_params jsonb not null,
  error_code varchar(120),
  error_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meta_insight_report_runs_unique_external unique (external_report_run_id)
);

create index meta_business_accounts_organization_id_idx on public.meta_business_accounts (organization_id);
create index meta_business_accounts_connection_id_idx on public.meta_business_accounts (connection_id);
create index meta_pages_organization_id_idx on public.meta_pages (organization_id);
create index meta_pages_business_account_id_idx on public.meta_pages (business_account_id);
create index meta_asset_tokens_connection_id_idx on private.meta_asset_tokens (connection_id);
create index meta_asset_tokens_token_expires_at_idx on private.meta_asset_tokens (token_expires_at);
create index meta_ad_accounts_organization_id_idx on public.meta_ad_accounts (organization_id);
create index meta_ad_accounts_business_account_id_idx on public.meta_ad_accounts (business_account_id);
create index meta_ad_accounts_account_status_code_idx on public.meta_ad_accounts (account_status_code);
create index meta_campaigns_organization_id_idx on public.meta_campaigns (organization_id);
create index meta_campaigns_ad_account_id_idx on public.meta_campaigns (ad_account_id);
create index meta_campaigns_effective_status_idx on public.meta_campaigns (effective_status);
create index meta_campaigns_objective_idx on public.meta_campaigns (objective);
create index meta_ad_sets_organization_id_idx on public.meta_ad_sets (organization_id);
create index meta_ad_sets_campaign_id_idx on public.meta_ad_sets (campaign_id);
create index meta_ad_sets_effective_status_idx on public.meta_ad_sets (effective_status);
create index meta_ad_sets_optimization_goal_idx on public.meta_ad_sets (optimization_goal);
create index meta_creatives_organization_id_idx on public.meta_creatives (organization_id);
create index meta_creatives_ad_account_id_idx on public.meta_creatives (ad_account_id);
create index meta_creatives_external_video_id_idx on public.meta_creatives (external_video_id);
create index meta_creatives_image_hash_idx on public.meta_creatives (image_hash);
create index meta_creative_assets_organization_id_idx on public.meta_creative_assets (organization_id);
create index meta_creative_assets_creative_id_idx on public.meta_creative_assets (creative_id);
create index meta_creative_assets_asset_type_idx on public.meta_creative_assets (asset_type);
create index meta_creative_assets_external_asset_id_idx on public.meta_creative_assets (external_asset_id);
create index meta_creative_assets_asset_hash_idx on public.meta_creative_assets (asset_hash);
create index meta_ads_organization_id_idx on public.meta_ads (organization_id);
create index meta_ads_ad_set_id_idx on public.meta_ads (ad_set_id);
create index meta_ads_current_creative_id_idx on public.meta_ads (current_creative_id);
create index meta_ads_effective_status_idx on public.meta_ads (effective_status);
create index meta_ads_parsed_angle_idx on public.meta_ads (parsed_angle);
create index meta_ads_parsed_format_idx on public.meta_ads (parsed_format);
create index meta_ad_creative_assignments_organization_id_idx on public.meta_ad_creative_assignments (organization_id);
create index meta_ad_creative_assignments_ad_id_idx on public.meta_ad_creative_assignments (ad_id);
create index meta_ad_creative_assignments_creative_id_idx on public.meta_ad_creative_assignments (creative_id);
create index meta_ad_creative_assignments_valid_from_idx on public.meta_ad_creative_assignments (valid_from);
create index meta_insight_rows_daily_organization_id_idx on public.meta_insight_rows_daily (organization_id);
create index meta_insight_rows_daily_ad_account_id_idx on public.meta_insight_rows_daily (ad_account_id);
create index meta_insight_rows_daily_campaign_id_idx on public.meta_insight_rows_daily (campaign_id);
create index meta_insight_rows_daily_ad_set_id_idx on public.meta_insight_rows_daily (ad_set_id);
create index meta_insight_rows_daily_ad_id_idx on public.meta_insight_rows_daily (ad_id);
create index meta_insight_rows_daily_level_idx on public.meta_insight_rows_daily (level);
create index meta_insight_rows_daily_metric_date_idx on public.meta_insight_rows_daily (metric_date);
create index meta_insight_rows_daily_publisher_platform_idx on public.meta_insight_rows_daily (publisher_platform);
create index meta_insight_rows_daily_platform_position_idx on public.meta_insight_rows_daily (platform_position);
-- Indice que calza con el predicado tipico del dashboard: gasto por org y rango de fechas.
create index meta_insight_rows_daily_org_date_idx on public.meta_insight_rows_daily (organization_id, metric_date);
create index meta_insight_action_metrics_organization_id_idx on public.meta_insight_action_metrics (organization_id);
create index meta_insight_action_metrics_insight_row_id_idx on public.meta_insight_action_metrics (insight_row_id);
create index meta_insight_action_metrics_metric_name_idx on public.meta_insight_action_metrics (metric_name);
create index meta_insight_action_metrics_action_type_idx on public.meta_insight_action_metrics (action_type);
create index meta_calculated_metrics_daily_organization_id_idx on public.meta_calculated_metrics_daily (organization_id);
create index meta_calculated_metrics_daily_insight_row_id_idx on public.meta_calculated_metrics_daily (insight_row_id);
create index meta_calculated_metrics_daily_metric_code_idx on public.meta_calculated_metrics_daily (metric_code);
create index meta_insight_report_runs_organization_id_idx on public.meta_insight_report_runs (organization_id);
create index meta_insight_report_runs_ad_account_id_idx on public.meta_insight_report_runs (ad_account_id);
create index meta_insight_report_runs_status_idx on public.meta_insight_report_runs (status);

create trigger set_meta_business_accounts_updated_at
before update on public.meta_business_accounts
for each row execute function private.set_updated_at();

create trigger set_meta_pages_updated_at
before update on public.meta_pages
for each row execute function private.set_updated_at();

create trigger set_meta_asset_tokens_updated_at
before update on private.meta_asset_tokens
for each row execute function private.set_updated_at();

create trigger set_meta_ad_accounts_updated_at
before update on public.meta_ad_accounts
for each row execute function private.set_updated_at();

create trigger set_meta_campaigns_updated_at
before update on public.meta_campaigns
for each row execute function private.set_updated_at();

create trigger set_meta_ad_sets_updated_at
before update on public.meta_ad_sets
for each row execute function private.set_updated_at();

create trigger set_meta_creatives_updated_at
before update on public.meta_creatives
for each row execute function private.set_updated_at();

create trigger set_meta_creative_assets_updated_at
before update on public.meta_creative_assets
for each row execute function private.set_updated_at();

create trigger set_meta_ads_updated_at
before update on public.meta_ads
for each row execute function private.set_updated_at();

create trigger set_meta_insight_rows_daily_updated_at
before update on public.meta_insight_rows_daily
for each row execute function private.set_updated_at();

create trigger set_meta_insight_action_metrics_updated_at
before update on public.meta_insight_action_metrics
for each row execute function private.set_updated_at();

create trigger set_meta_insight_report_runs_updated_at
before update on public.meta_insight_report_runs
for each row execute function private.set_updated_at();

alter table public.meta_business_accounts enable row level security;
alter table public.meta_pages enable row level security;
alter table private.meta_asset_tokens enable row level security;
alter table public.meta_ad_accounts enable row level security;
alter table public.meta_campaigns enable row level security;
alter table public.meta_ad_sets enable row level security;
alter table public.meta_creatives enable row level security;
alter table public.meta_creative_assets enable row level security;
alter table public.meta_ads enable row level security;
alter table public.meta_ad_creative_assignments enable row level security;
alter table public.meta_insight_rows_daily enable row level security;
alter table public.meta_insight_action_metrics enable row level security;
alter table public.meta_calculated_metrics_daily enable row level security;
alter table public.meta_insight_report_runs enable row level security;

create policy "meta_business_accounts_select_authorized"
on public.meta_business_accounts
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_pages_select_authorized"
on public.meta_pages
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_ad_accounts_select_authorized"
on public.meta_ad_accounts
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_campaigns_select_authorized"
on public.meta_campaigns
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_ad_sets_select_authorized"
on public.meta_ad_sets
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_creatives_select_authorized"
on public.meta_creatives
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_creative_assets_select_authorized"
on public.meta_creative_assets
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_ads_select_authorized"
on public.meta_ads
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_ad_creative_assignments_select_authorized"
on public.meta_ad_creative_assignments
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_insight_rows_daily_select_authorized"
on public.meta_insight_rows_daily
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_insight_action_metrics_select_authorized"
on public.meta_insight_action_metrics
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_calculated_metrics_daily_select_authorized"
on public.meta_calculated_metrics_daily
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "meta_insight_report_runs_select_authorized"
on public.meta_insight_report_runs
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.meta_business_accounts to authenticated;
grant select on public.meta_pages to authenticated;
grant select on public.meta_ad_accounts to authenticated;
grant select on public.meta_campaigns to authenticated;
grant select on public.meta_ad_sets to authenticated;
grant select on public.meta_creatives to authenticated;
grant select on public.meta_creative_assets to authenticated;
grant select on public.meta_ads to authenticated;
grant select on public.meta_ad_creative_assignments to authenticated;
grant select on public.meta_insight_rows_daily to authenticated;
grant select on public.meta_insight_action_metrics to authenticated;
grant select on public.meta_calculated_metrics_daily to authenticated;
grant select on public.meta_insight_report_runs to authenticated;

comment on table public.meta_business_accounts is 'Business Manager o portfolio empresarial de Meta accesible mediante la autorizacion.';
comment on table public.meta_pages is 'Pagina de Facebook vinculada a una cuenta profesional de Instagram.';
comment on table private.meta_asset_tokens is 'Tokens especificos de Pagina, sistema u otros activos Meta. Nunca accesible desde el frontend.';
comment on table public.meta_ad_accounts is 'Cuenta publicitaria Meta seleccionada por el cliente.';
comment on table public.meta_creatives is 'Cabecera de la creatividad. Las variantes de imagenes, videos y textos se guardan en meta_creative_assets.';
comment on table public.meta_creative_assets is 'Activos individuales de una creatividad clasica o dinamica.';
comment on table public.meta_ad_creative_assignments is 'Historico de creatividades asociadas a un anuncio para no perder la relacion temporal.';
comment on table public.meta_insight_rows_daily is 'Fila base de Ads Insights. Las acciones, valores, ROAS y metricas de video se normalizan aparte.';
comment on table public.meta_insight_action_metrics is 'Valores de arrays de Ads Insights: actions, action_values, purchase_roas, costes por accion y metricas de video.';
comment on table public.meta_calculated_metrics_daily is 'KPIs calculados por EcomScaling: hook_rate, hold_rate, canonical_roas, cac o creative_fatigue.';
comment on table public.meta_insight_report_runs is 'Seguimiento de informes asincronos de Ads Insights.';

-- =============================================================================
-- Migracion: 20260717180000_db_06b_meta_spend_summary.sql
-- =============================================================================
-- DB-06b: resumen de adquisicion Meta para el dashboard. Agrega gasto y
-- metricas base desde meta_insight_rows_daily (nivel ad, sin breakdowns) y
-- compras/valor de compra desde meta_insight_action_metrics. security invoker:
-- RLS limita filas a organizaciones accesibles.

create or replace function public.meta_spend_summary(
  target_organization_id uuid,
  period_start date,
  period_end date
)
returns table (
  spend numeric,
  impressions bigint,
  clicks bigint,
  purchases numeric,
  purchase_value numeric,
  roas numeric,
  cac numeric,
  days_with_data bigint
)
language sql
stable
as $$
  with base_rows as (
    select r.id, r.spend, r.impressions, r.clicks, r.metric_date
    from public.meta_insight_rows_daily r
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      and (period_start is null or r.metric_date >= period_start)
      and r.metric_date <= period_end
  ),
  purchase_actions as (
    select
      coalesce(sum(m.value) filter (where m.metric_name = 'actions'), 0) as purchases,
      coalesce(sum(m.value) filter (where m.metric_name = 'action_values'), 0) as purchase_value
    from public.meta_insight_action_metrics m
    join base_rows b on b.id = m.insight_row_id
    where m.action_type in ('purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase')
  )
  select
    coalesce(sum(b.spend), 0) as spend,
    coalesce(sum(b.impressions), 0)::bigint as impressions,
    coalesce(sum(b.clicks), 0)::bigint as clicks,
    p.purchases,
    p.purchase_value,
    case when coalesce(sum(b.spend), 0) > 0 then round(p.purchase_value / sum(b.spend), 4) else null end as roas,
    case when p.purchases > 0 then round(coalesce(sum(b.spend), 0) / p.purchases, 2) else null end as cac,
    count(distinct b.metric_date)::bigint as days_with_data
  from base_rows b
  cross join purchase_actions p
  group by p.purchases, p.purchase_value;
$$;

grant execute on function public.meta_spend_summary(uuid, date, date) to authenticated;

comment on function public.meta_spend_summary is 'Gasto, compras atribuidas, ROAS y CAC del periodo desde insights diarios nivel ad. Compras suman action_types purchase/omni_purchase/fb_pixel_purchase (posible solape si Meta reporta varios; documentado como limitacion de atribucion). Devuelve fila unica; null en roas/cac cuando no hay gasto o compras.';

-- =============================================================================
-- Migracion: 20260717190000_db_07_alertas_tareas_plan.sql
-- =============================================================================
-- DB-07: alertas, tareas y plan estrategico (Mi Camino) segun contrato DBML v0.2.
-- Reglas globales (templates) + overrides por organizacion, alertas idempotentes
-- por fingerprint, tareas con historial de estados automatico y visibilidad
-- cliente/consultor, y estructura de planes con notas internas solo-consultor.
-- Lectura via RLS; escritura via API con service role + chequeo de rol.

create type public.task_status as enum ('pending', 'in_progress', 'completed', 'ignored', 'cancelled');
create type public.task_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.task_source as enum ('manual', 'alert', 'consulting_call', 'strategic_plan', 'ai_consultant', 'system');
create type public.alert_status as enum ('open', 'acknowledged', 'resolved', 'dismissed');
create type public.alert_severity as enum ('info', 'low', 'medium', 'high', 'critical');
create type public.plan_status as enum ('draft', 'active', 'completed', 'archived');
create type public.plan_phase_status as enum ('locked', 'pending', 'active', 'completed');
create type public.milestone_status as enum ('locked', 'pending', 'in_progress', 'completed', 'skipped');

create table public.alert_rule_templates (
  id uuid primary key default gen_random_uuid(),
  code varchar(120) not null unique,
  name varchar(255) not null,
  description text,
  metric_code varchar(120),
  default_severity public.alert_severity not null,
  default_lookback_days int,
  default_condition jsonb not null,
  alert_title_template text not null,
  alert_message_template text not null,
  task_title_template text,
  task_description_template text,
  is_active boolean not null default true,
  phase int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_alert_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null references public.alert_rule_templates (id) on delete cascade,
  is_enabled boolean not null default true,
  severity_override public.alert_severity,
  condition_override jsonb,
  configured_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_alert_rules_unique unique (organization_id, template_id)
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  rule_template_id uuid references public.alert_rule_templates (id) on delete set null,
  organization_rule_id uuid references public.organization_alert_rules (id) on delete set null,
  source_entity_type varchar(100),
  source_entity_id uuid,
  status public.alert_status not null default 'open',
  severity public.alert_severity not null,
  title varchar(255) not null,
  message text not null,
  metric_code varchar(120),
  metric_value numeric(16, 4),
  threshold_value numeric(16, 4),
  context_data jsonb,
  fingerprint varchar(255),
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  acknowledged_by uuid references public.profiles (id) on delete set null,
  acknowledged_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  alert_id uuid references public.alerts (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  source public.task_source not null,
  status public.task_status not null default 'pending',
  priority public.task_priority not null default 'medium',
  title varchar(255) not null,
  description text,
  due_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  ignored_at timestamptz,
  ignored_reason text,
  is_visible_to_client boolean not null default true,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  previous_status public.task_status,
  new_status public.task_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  reason text,
  changed_at timestamptz not null default now()
);

create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategic_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name varchar(255) not null,
  description text,
  status public.plan_status not null default 'draft',
  version int not null default 1,
  starts_on date,
  completed_on date,
  created_by uuid not null references public.profiles (id) on delete restrict,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategic_plan_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  plan_id uuid not null references public.strategic_plans (id) on delete cascade,
  name varchar(255) not null,
  description text,
  position int not null,
  status public.plan_phase_status not null default 'locked',
  activated_at timestamptz,
  completed_at timestamptz,
  activated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategic_plan_phases_unique_position unique (plan_id, position)
);

create table public.strategic_plan_milestones (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  phase_id uuid not null references public.strategic_plan_phases (id) on delete cascade,
  name varchar(255) not null,
  description text,
  position int not null,
  status public.milestone_status not null default 'locked',
  target_date date,
  activated_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategic_plan_milestones_unique_position unique (phase_id, position)
);

create table public.milestone_task_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  milestone_id uuid not null references public.strategic_plan_milestones (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint milestone_task_links_unique unique (milestone_id, task_id)
);

create table public.milestone_internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  milestone_id uuid not null references public.strategic_plan_milestones (id) on delete cascade,
  author_user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organization_alert_rules_organization_id_idx on public.organization_alert_rules (organization_id);
create index alerts_organization_id_idx on public.alerts (organization_id);
create index alerts_status_idx on public.alerts (status);
create index alerts_severity_idx on public.alerts (severity);
create index alerts_fingerprint_idx on public.alerts (fingerprint);
create index alerts_org_status_severity_idx on public.alerts (organization_id, status, severity);
-- Idempotencia del motor de reglas: una alerta viva por fingerprint y organizacion.
create unique index alerts_unique_live_fingerprint
on public.alerts (organization_id, fingerprint)
where fingerprint is not null and status in ('open', 'acknowledged');
create index tasks_organization_id_idx on public.tasks (organization_id);
create index tasks_assigned_to_idx on public.tasks (assigned_to);
create index tasks_status_idx on public.tasks (status);
create index tasks_priority_idx on public.tasks (priority);
create index tasks_due_at_idx on public.tasks (due_at);
create index tasks_org_status_priority_idx on public.tasks (organization_id, status, priority);
-- Una alerta genera como maximo una tarea (criterio de cierre DB-07/BE-05).
create unique index tasks_unique_alert on public.tasks (alert_id) where alert_id is not null;
create index task_status_history_task_id_idx on public.task_status_history (task_id);
create index task_status_history_organization_id_idx on public.task_status_history (organization_id);
create index task_comments_task_id_idx on public.task_comments (task_id);
create index task_comments_organization_id_idx on public.task_comments (organization_id);
create index strategic_plans_organization_id_idx on public.strategic_plans (organization_id);
create index strategic_plans_status_idx on public.strategic_plans (status);
create index strategic_plan_phases_organization_id_idx on public.strategic_plan_phases (organization_id);
create index strategic_plan_milestones_organization_id_idx on public.strategic_plan_milestones (organization_id);
create index milestone_task_links_organization_id_idx on public.milestone_task_links (organization_id);
create index milestone_internal_notes_milestone_id_idx on public.milestone_internal_notes (milestone_id);
create index milestone_internal_notes_organization_id_idx on public.milestone_internal_notes (organization_id);

create trigger set_alert_rule_templates_updated_at
before update on public.alert_rule_templates
for each row execute function private.set_updated_at();

create trigger set_organization_alert_rules_updated_at
before update on public.organization_alert_rules
for each row execute function private.set_updated_at();

create trigger set_alerts_updated_at
before update on public.alerts
for each row execute function private.set_updated_at();

create trigger set_tasks_updated_at
before update on public.tasks
for each row execute function private.set_updated_at();

create trigger set_task_comments_updated_at
before update on public.task_comments
for each row execute function private.set_updated_at();

create trigger set_strategic_plans_updated_at
before update on public.strategic_plans
for each row execute function private.set_updated_at();

create trigger set_strategic_plan_phases_updated_at
before update on public.strategic_plan_phases
for each row execute function private.set_updated_at();

create trigger set_strategic_plan_milestones_updated_at
before update on public.strategic_plan_milestones
for each row execute function private.set_updated_at();

create trigger set_milestone_internal_notes_updated_at
before update on public.milestone_internal_notes
for each row execute function private.set_updated_at();

-- Integridad cross-org (criterio: no enlazar tarea de A con alerta/hito/plan de B).
create or replace function private.enforce_task_alert_same_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.alert_id is not null then
    if not exists (
      select 1 from public.alerts a
      where a.id = new.alert_id and a.organization_id = new.organization_id
    ) then
      raise exception 'task alert must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_task_alert_same_org() from public;

create trigger enforce_task_alert_same_org
before insert or update of alert_id on public.tasks
for each row execute function private.enforce_task_alert_same_org();

create or replace function private.enforce_milestone_task_link_same_org()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.strategic_plan_milestones m
    where m.id = new.milestone_id and m.organization_id = new.organization_id
  ) then
    raise exception 'milestone must belong to the same organization';
  end if;

  if not exists (
    select 1 from public.tasks t
    where t.id = new.task_id and t.organization_id = new.organization_id
  ) then
    raise exception 'task must belong to the same organization';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_milestone_task_link_same_org() from public;

create trigger enforce_milestone_task_link_same_org
before insert or update on public.milestone_task_links
for each row execute function private.enforce_milestone_task_link_same_org();

-- Historial automatico de estados: cualquier cambio de tasks.status deja fila,
-- venga del API, del motor de reglas o de un update manual con service role.
create or replace function private.record_task_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.task_status_history (organization_id, task_id, previous_status, new_status, changed_by)
    values (new.organization_id, new.id, null, new.status, coalesce(auth.uid(), new.created_by));
  elsif new.status is distinct from old.status then
    insert into public.task_status_history (organization_id, task_id, previous_status, new_status, changed_by)
    values (new.organization_id, new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function private.record_task_status_change() from public;

create trigger record_task_status_change
after insert or update of status on public.tasks
for each row execute function private.record_task_status_change();

alter table public.alert_rule_templates enable row level security;
alter table public.organization_alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;
alter table public.task_comments enable row level security;
alter table public.strategic_plans enable row level security;
alter table public.strategic_plan_phases enable row level security;
alter table public.strategic_plan_milestones enable row level security;
alter table public.milestone_task_links enable row level security;
alter table public.milestone_internal_notes enable row level security;

create policy "alert_rule_templates_select_all"
on public.alert_rule_templates
for select
to authenticated
using (true);

create policy "organization_alert_rules_select_authorized"
on public.organization_alert_rules
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "alerts_select_authorized"
on public.alerts
for select
to authenticated
using (private.can_access_org(organization_id));

-- Tareas internas del consultor no se exponen al cliente (criterio FE-03).
create policy "tasks_select_authorized"
on public.tasks
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    is_visible_to_client
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

create policy "task_status_history_select_authorized"
on public.task_status_history
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "task_comments_select_authorized"
on public.task_comments
for select
to authenticated
using (
  private.can_access_org(organization_id)
  and (
    not is_internal
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

create policy "strategic_plans_select_authorized"
on public.strategic_plans
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "strategic_plan_phases_select_authorized"
on public.strategic_plan_phases
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "strategic_plan_milestones_select_authorized"
on public.strategic_plan_milestones
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "milestone_task_links_select_authorized"
on public.milestone_task_links
for select
to authenticated
using (private.can_access_org(organization_id));

-- Notas internas de hitos: solo consultores asignados y platform admins.
create policy "milestone_internal_notes_select_consultants"
on public.milestone_internal_notes
for select
to authenticated
using (
  private.is_platform_admin()
  or private.is_assigned_consultant(organization_id)
);

grant select on public.alert_rule_templates to authenticated;
grant select on public.organization_alert_rules to authenticated;
grant select on public.alerts to authenticated;
grant select on public.tasks to authenticated;
grant select on public.task_status_history to authenticated;
grant select on public.task_comments to authenticated;
grant select on public.strategic_plans to authenticated;
grant select on public.strategic_plan_phases to authenticated;
grant select on public.strategic_plan_milestones to authenticated;
grant select on public.milestone_task_links to authenticated;
grant select on public.milestone_internal_notes to authenticated;

comment on table public.alert_rule_templates is 'Reglas globales: ROAS bajo, stock cero, sin campana, flow sin envios, etc.';
comment on table public.milestone_internal_notes is 'Solo visibles para consultores y administradores.';

-- Plantillas iniciales del motor de reglas (fase 1: solo datos Shopify + sync).
insert into public.alert_rule_templates
  (code, name, description, metric_code, default_severity, default_lookback_days, default_condition, alert_title_template, alert_message_template, task_title_template, task_description_template)
values
  (
    'shopify_stock_out',
    'Productos sin stock',
    'Detecta items activos con stock 0 en Shopify.',
    'out_of_stock_items',
    'high',
    null,
    '{"operator": ">", "threshold": 0}',
    'Tienes {metric_value} productos sin stock',
    'Hay {metric_value} items activos con stock 0. Cada dia sin stock es venta perdida y hunde el ranking del producto.',
    'Reponer productos sin stock',
    'Revisa los {metric_value} items agotados en la seccion Shopify y decide reposicion o pausa de campanas que apunten a ellos.'
  ),
  (
    'integration_sync_failed',
    'Sincronizacion fallida',
    'Detecta conexiones de integracion en estado de error.',
    'failed_connections',
    'critical',
    null,
    '{"operator": ">", "threshold": 0}',
    'Una integracion ha dejado de sincronizar',
    'La conexion {context_provider} esta en error: los datos del dashboard pueden estar desactualizados. Motivo: {context_error}',
    'Reconectar integracion {context_provider}',
    'Entra en Integraciones y reautoriza la conexion. Si el error persiste, contacta con soporte.'
  ),
  (
    'shopify_revenue_drop',
    'Caida de facturacion',
    'Compara la facturacion neta de los ultimos 7 dias contra los 7 anteriores.',
    'net_sales_wow_change_pct',
    'medium',
    14,
    '{"operator": "<", "threshold": -30}',
    'La facturacion ha caido un {metric_value_abs}% semana contra semana',
    'Ventas netas de los ultimos 7 dias: {context_current}. Semana anterior: {context_previous}. Caida superior al {threshold_abs}% configurado.',
    'Investigar caida de facturacion',
    'Revisa campanas activas, stock de los productos top y posibles incidencias de la tienda. Documenta la causa en los comentarios.'
  );

-- =============================================================================
-- Migracion: 20260717200000_db_08a_runtime_agentes.sql
-- =============================================================================
-- DB-08a: runtime inicial de agentes IA (AI-00). Solo la parte de runtime del
-- spec DB-08; las tablas de llamadas (consulting_calls...) llegan con F8.
-- Principios AI-00: organization_id lo resuelve el backend (nunca el modelo),
-- toda ejecucion registra fuentes/coste/latencia/resultado, las salidas se
-- validan contra schema y las escrituras propuestas requieren aprobacion.
-- Lectura via RLS; escritura solo via service role.

create table public.agent_definitions (
  id uuid primary key default gen_random_uuid(),
  code varchar(80) not null unique,
  name varchar(255) not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  code varchar(120) not null,
  version varchar(50) not null,
  content text not null,
  checksum varchar(64) not null,
  created_at timestamptz not null default now(),
  constraint prompt_versions_unique unique (code, version)
);

create table public.agent_versions (
  id uuid primary key default gen_random_uuid(),
  definition_id uuid not null references public.agent_definitions (id) on delete cascade,
  version varchar(50) not null,
  model varchar(120) not null,
  prompt_code varchar(120) not null,
  prompt_version varchar(50) not null,
  allowed_tools jsonb not null default '[]',
  approval_mode varchar(40) not null default 'required_before_publish',
  output_schema_version varchar(50) not null default 'v1',
  config jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint agent_versions_unique unique (definition_id, version),
  constraint agent_versions_approval_mode check (
    approval_mode in ('none', 'required_before_write', 'required_before_publish')
  )
);

create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent_version_id uuid not null references public.agent_versions (id) on delete restrict,
  actor_user_id uuid references public.profiles (id) on delete set null,
  trigger_type varchar(40) not null,
  objective text not null,
  time_range jsonb,
  entity_ids jsonb,
  status varchar(30) not null default 'running',
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  estimated_cost_usd numeric(12, 6) not null default 0,
  latency_ms integer,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_runs_trigger_type check (
    trigger_type in ('chat', 'call', 'cron', 'alert', 'webhook', 'manual')
  ),
  constraint agent_runs_status check (status in ('running', 'succeeded', 'failed', 'rejected_output'))
);

create table public.agent_run_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  position integer not null,
  step_type varchar(40) not null,
  summary text,
  payload jsonb,
  duration_ms integer,
  created_at timestamptz not null default now(),
  constraint agent_run_steps_unique_position unique (run_id, position)
);

create table public.agent_tool_calls (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tool_name varchar(120) not null,
  input jsonb,
  output jsonb,
  is_error boolean not null default false,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table public.agent_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  context_level varchar(4) not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint agent_context_snapshots_level check (context_level in ('C0', 'C1', 'C2', 'C3', 'C4'))
);

create table public.agent_outputs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  schema_version varchar(50) not null default 'v1',
  output jsonb not null,
  approval_required boolean not null default true,
  status varchar(30) not null default 'pending_approval',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agent_outputs_status check (
    status in ('draft', 'pending_approval', 'approved', 'rejected', 'published')
  ),
  constraint agent_outputs_unique_run unique (run_id)
);

create table public.agent_approvals (
  id uuid primary key default gen_random_uuid(),
  output_id uuid not null references public.agent_outputs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  decision varchar(20) not null,
  decided_by uuid references public.profiles (id) on delete set null,
  reason text,
  decided_at timestamptz not null default now(),
  constraint agent_approvals_decision check (decision in ('approved', 'rejected'))
);

-- Auditoria de consultas del futuro SQL Gateway (AI-03): cada query queda
-- registrada con tablas, filas y duracion desde el primer dia.
create table public.agent_query_runs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.agent_runs (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  sql_text text not null,
  tables_used jsonb,
  rows_returned integer,
  duration_ms integer,
  was_rejected boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index agent_versions_definition_id_idx on public.agent_versions (definition_id);
create index agent_runs_organization_id_idx on public.agent_runs (organization_id);
create index agent_runs_agent_version_id_idx on public.agent_runs (agent_version_id);
create index agent_runs_status_idx on public.agent_runs (status);
create index agent_runs_started_at_idx on public.agent_runs (started_at);
create index agent_run_steps_run_id_idx on public.agent_run_steps (run_id);
create index agent_run_steps_organization_id_idx on public.agent_run_steps (organization_id);
create index agent_tool_calls_run_id_idx on public.agent_tool_calls (run_id);
create index agent_tool_calls_organization_id_idx on public.agent_tool_calls (organization_id);
create index agent_context_snapshots_run_id_idx on public.agent_context_snapshots (run_id);
create index agent_context_snapshots_organization_id_idx on public.agent_context_snapshots (organization_id);
create index agent_outputs_organization_id_idx on public.agent_outputs (organization_id);
create index agent_outputs_status_idx on public.agent_outputs (status);
create index agent_approvals_output_id_idx on public.agent_approvals (output_id);
create index agent_approvals_organization_id_idx on public.agent_approvals (organization_id);
create index agent_query_runs_run_id_idx on public.agent_query_runs (run_id);
create index agent_query_runs_organization_id_idx on public.agent_query_runs (organization_id);

create trigger set_agent_definitions_updated_at
before update on public.agent_definitions
for each row execute function private.set_updated_at();

create trigger set_agent_outputs_updated_at
before update on public.agent_outputs
for each row execute function private.set_updated_at();

alter table public.agent_definitions enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.agent_versions enable row level security;
alter table public.agent_runs enable row level security;
alter table public.agent_run_steps enable row level security;
alter table public.agent_tool_calls enable row level security;
alter table public.agent_context_snapshots enable row level security;
alter table public.agent_outputs enable row level security;
alter table public.agent_approvals enable row level security;
alter table public.agent_query_runs enable row level security;

create policy "agent_definitions_select_all"
on public.agent_definitions for select to authenticated using (true);

create policy "prompt_versions_select_all"
on public.prompt_versions for select to authenticated using (true);

create policy "agent_versions_select_all"
on public.agent_versions for select to authenticated using (true);

create policy "agent_runs_select_authorized"
on public.agent_runs for select to authenticated
using (private.can_access_org(organization_id));

create policy "agent_run_steps_select_authorized"
on public.agent_run_steps for select to authenticated
using (private.can_access_org(organization_id));

create policy "agent_tool_calls_select_authorized"
on public.agent_tool_calls for select to authenticated
using (private.can_access_org(organization_id));

-- Snapshots de contexto pueden contener datos amplios: solo consultores/admins.
create policy "agent_context_snapshots_select_consultants"
on public.agent_context_snapshots for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

-- El cliente solo ve salidas ya aprobadas/publicadas; consultores/admins ven todas.
create policy "agent_outputs_select_authorized"
on public.agent_outputs for select to authenticated
using (
  private.can_access_org(organization_id)
  and (
    status in ('approved', 'published')
    or private.is_platform_admin()
    or private.is_assigned_consultant(organization_id)
  )
);

create policy "agent_approvals_select_consultants"
on public.agent_approvals for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

create policy "agent_query_runs_select_consultants"
on public.agent_query_runs for select to authenticated
using (private.is_platform_admin() or private.is_assigned_consultant(organization_id));

grant select on public.agent_definitions to authenticated;
grant select on public.prompt_versions to authenticated;
grant select on public.agent_versions to authenticated;
grant select on public.agent_runs to authenticated;
grant select on public.agent_run_steps to authenticated;
grant select on public.agent_tool_calls to authenticated;
grant select on public.agent_context_snapshots to authenticated;
grant select on public.agent_outputs to authenticated;
grant select on public.agent_approvals to authenticated;
grant select on public.agent_query_runs to authenticated;

comment on table public.agent_runs is 'Ejecuciones de agentes IA con coste, latencia y resultado (AI-00: trazabilidad completa).';
comment on table public.agent_outputs is 'Salida estructurada validada contra schema; requiere aprobacion antes de publicar al cliente segun approval_mode.';
comment on table public.agent_query_runs is 'Auditoria del SQL Gateway: cada consulta con tablas, filas y duracion.';

-- Seed: agente A02-lite (resumen ejecutivo del negocio) con su prompt versionado.
insert into public.agent_definitions (code, name, description)
values (
  'a02_monitor_negocio',
  'Monitor del negocio',
  'Analiza las metricas sincronizadas y genera un diagnostico ejecutivo con hallazgos y recomendaciones.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a02_monitor_negocio_system',
  'v1',
  'Eres el consultor IA de EcomScaling para marcas de ecommerce. Analiza exclusivamente los datos que se te entregan en el contexto (metricas ya verificadas de la organizacion activa). Nunca inventes cifras ni hables de otras organizaciones. Cada hallazgo debe citar la metrica y el periodo del que sale. Se directo, cuantitativo y accionable; prioriza margen y beneficio neto sobre facturacion bruta. Si faltan datos (costes sin configurar, integraciones sin conectar), dilo como warning en vez de rellenar huecos.',
  encode(sha256('a02_monitor_negocio_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a02_monitor_negocio_system', 'v1', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio';

-- =============================================================================
-- Migracion: 20260718100000_db_08b_ai_sql_gateway.sql
-- =============================================================================
-- DB-08b / AI-03: SQL Gateway de solo lectura para agentes IA.
--
-- Diseno de aislamiento en dos capas:
--   1. Node (apps/api/src/sql-gateway.ts): validacion AST (solo SELECT/WITH,
--      allowlist de vistas, sin esquemas cualificados, denylist de funciones).
--   2. Base de datos (este archivo): el agente solo ve el esquema `ai`, cuyas
--      vistas filtran SIEMPRE por la organizacion fijada por el backend via
--      set_config('app.gateway_org_id', ...). Aunque la validacion Node
--      fallara, una consulta jamas puede devolver filas de otro tenant:
--      el filtro vive dentro de la vista, no en el SQL del modelo.
--
-- La funcion agent_sql_gateway solo es ejecutable por service_role (el API la
-- llama tras el chequeo de membership); authenticated/anon no pueden usarla.
-- Cada ejecucion queda auditada por el API en agent_query_runs.

create schema if not exists ai;

-- Organizacion activa de la consulta en curso. La fija agent_sql_gateway con
-- set_config(..., is_local => true): solo vive dentro de la transaccion.
create or replace function private.gateway_org_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.gateway_org_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Vistas allowlist: columnas explicitas (sin tokens, sin PII, sin raw_data) y
-- filtro de tenant embebido. Si la GUC no esta fijada, devuelven 0 filas.
-- ---------------------------------------------------------------------------

create view ai.shopify_stores as
select id, shop_name, myshopify_domain, currency_code, timezone, is_active
from public.shopify_stores
where organization_id = private.gateway_org_id();

create view ai.shopify_products as
select id, store_id, external_product_id, title, handle, vendor, product_type,
  status, published_at, external_created_at
from public.shopify_products
where organization_id = private.gateway_org_id();

create view ai.shopify_variants as
select id, product_id, title, current_price, compare_at_price, position, is_active
from public.shopify_variants
where organization_id = private.gateway_org_id();

create view ai.shopify_inventory_items as
select id, variant_id, sku, tracked, current_unit_cost, cost_currency_code
from public.shopify_inventory_items
where organization_id = private.gateway_org_id();

create view ai.shopify_inventory_current_state as
select id, inventory_item_id, location_id, available_quantity, on_hand_quantity,
  committed_quantity, incoming_quantity, is_active, updated_at
from public.shopify_inventory_current_state
where organization_id = private.gateway_org_id();

create view ai.shopify_order_facts as
select id, store_id, order_name, financial_status, fulfillment_status,
  source_name, currency_code, gross_sales, discounts, refunds, net_sales,
  current_shipping_price, current_total_tax, current_total_price, total_items,
  is_first_customer_order, is_test_order, processed_at, external_created_at,
  cancelled_at
from public.shopify_order_facts
where organization_id = private.gateway_org_id();

create view ai.shopify_order_items as
select id, order_id, product_id, variant_id, title, sku_snapshot,
  vendor_snapshot, quantity_original, quantity_current, unit_price,
  original_line_total, discount_total, current_line_total, refunded_quantity,
  refunded_amount
from public.shopify_order_items
where organization_id = private.gateway_org_id();

create view ai.shopify_refunds as
select id, order_id, total_refunded, currency_code, external_created_at
from public.shopify_refunds
where organization_id = private.gateway_org_id();

-- shopify_customers ya no guarda PII (solo hash + metricas de comportamiento).
create view ai.shopify_customers as
select id, store_id, customer_reference_hash, number_of_orders, amount_spent,
  currency_code, state, tags, external_created_at
from public.shopify_customers
where organization_id = private.gateway_org_id();

create view ai.product_costs as
select id, inventory_item_id, unit_cost, currency_code, source, valid_from, valid_until
from public.product_costs
where organization_id = private.gateway_org_id();

create view ai.organization_financial_settings as
select currency_code, payment_fee_pct, payment_fee_fixed, default_shipping_cost, vat_pct
from public.organization_financial_settings
where organization_id = private.gateway_org_id();

create view ai.fixed_expenses as
select id, name, category, amount, currency_code, billing_period, valid_from,
  valid_until, is_active
from public.fixed_expenses
where organization_id = private.gateway_org_id();

create view ai.organization_metric_targets as
select id, metric_key, target_value, period, valid_from, valid_until
from public.organization_metric_targets
where organization_id = private.gateway_org_id();

create view ai.alerts as
select id, status, severity, title, message, metric_code, metric_value,
  threshold_value, first_detected_at, last_detected_at, resolved_at
from public.alerts
where organization_id = private.gateway_org_id();

create view ai.tasks as
select id, alert_id, source, status, priority, title, description, due_at,
  completed_at, created_at
from public.tasks
where organization_id = private.gateway_org_id();

create view ai.meta_campaigns as
select id, external_campaign_id, name, objective, effective_status,
  daily_budget, lifetime_budget, starts_at, ends_at
from public.meta_campaigns
where organization_id = private.gateway_org_id();

create view ai.meta_ads as
select id, ad_set_id, external_ad_id, name, effective_status, parsed_angle,
  parsed_format, parsed_hook
from public.meta_ads
where organization_id = private.gateway_org_id();

create view ai.meta_insight_rows_daily as
select id, campaign_id, ad_set_id, ad_id, level, metric_date, breakdown_hash,
  spend, impressions, reach, frequency, clicks, inline_link_clicks, cpm, cpc, ctr
from public.meta_insight_rows_daily
where organization_id = private.gateway_org_id();

-- ---------------------------------------------------------------------------
-- Ejecutor: fija tenant + search_path + timeout, envuelve con LIMIT y agrega
-- a jsonb. Los errores de SQL vuelven como {"error": ...} para que el agente
-- pueda corregir su consulta sin tumbar el run.
-- ---------------------------------------------------------------------------

create or replace function public.agent_sql_gateway(
  target_organization_id uuid,
  query_sql text,
  max_rows integer default 200
)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
  effective_rows integer := least(greatest(coalesce(max_rows, 200), 1), 500);
begin
  perform set_config('app.gateway_org_id', target_organization_id::text, true);
  perform set_config('search_path', 'ai', true);
  perform set_config('statement_timeout', '8000', true);

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(gateway_row)), ''[]''::jsonb)
     from (select * from (%s) gateway_inner limit %s) gateway_row',
    query_sql,
    effective_rows
  )
  into result;

  return jsonb_build_object('rows', result, 'row_limit', effective_rows);
exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$$;

revoke all on function public.agent_sql_gateway(uuid, text, integer) from public;
revoke all on function public.agent_sql_gateway(uuid, text, integer) from anon;
revoke all on function public.agent_sql_gateway(uuid, text, integer) from authenticated;
grant execute on function public.agent_sql_gateway(uuid, text, integer) to service_role;

grant usage on schema ai to service_role;
grant select on all tables in schema ai to service_role;

-- El agente A02 puede usar el gateway (y search_knowledge cuando el runtime
-- tenga embeddings configurados; sin VOYAGE_API_KEY la tool no se habilita).
update public.agent_versions
set allowed_tools = '["sql_select", "search_knowledge"]'::jsonb
where prompt_code = 'a02_monitor_negocio_system';

comment on schema ai is 'Vistas de solo lectura para el SQL Gateway de agentes IA (AI-03): columnas explicitas y filtro de tenant embebido via app.gateway_org_id.';
comment on function public.agent_sql_gateway is 'Ejecuta un SELECT ya validado por el API contra el esquema ai, con tenant forzado, timeout y limite de filas. Solo service_role.';

-- =============================================================================
-- Migracion: 20260718110000_db_11_rag_conocimiento.sql
-- =============================================================================
-- DB-11 / AI-04: conocimiento y RAG con pgvector (decision: pgvector dentro
-- de Supabase, con interfaz de retrieval swappable en packages/ai por si en
-- el futuro se migra a una base vectorial separada).
--
-- Visibilidad en dos niveles:
--   - global: metodologia EcomScaling compartida (organization_id null).
--   - organization: conocimiento privado de un tenant. NUNCA se mezcla hacia
--     global: la visibilidad se fija al crear el documento y un constraint
--     impide estados incoherentes.
-- Embeddings: vector(1024) (voyage-3.5 por defecto; el proveedor es
-- intercambiable siempre que emita 1024 dimensiones).

create extension if not exists vector with schema extensions;

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete cascade,
  title varchar(255) not null,
  description text,
  source_type varchar(40) not null default 'manual',
  visibility varchar(20) not null,
  version integer not null default 1,
  checksum varchar(64) not null,
  embedding_model varchar(120),
  status varchar(20) not null default 'active',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint knowledge_documents_source_type check (
    source_type in ('manual', 'upload', 'url', 'call_transcript')
  ),
  constraint knowledge_documents_visibility check (visibility in ('global', 'organization')),
  constraint knowledge_documents_status check (status in ('active', 'archived')),
  -- Coherencia visibilidad/tenant: global sin organizacion, organization con ella.
  constraint knowledge_documents_visibility_org check (
    (visibility = 'global' and organization_id is null)
    or (visibility = 'organization' and organization_id is not null)
  )
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  organization_id uuid references public.organizations (id) on delete cascade,
  chunk_index integer not null,
  content text not null,
  token_count integer,
  embedding extensions.vector(1024),
  created_at timestamptz not null default now(),
  constraint knowledge_chunks_unique_index unique (document_id, chunk_index)
);

create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  agent_code varchar(80) not null,
  title varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  role varchar(20) not null,
  content text not null,
  run_id uuid references public.agent_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_messages_role check (role in ('user', 'assistant'))
);

create index knowledge_documents_organization_id_idx on public.knowledge_documents (organization_id);
create index knowledge_documents_visibility_idx on public.knowledge_documents (visibility, status);
create index knowledge_chunks_document_id_idx on public.knowledge_chunks (document_id);
create index knowledge_chunks_organization_id_idx on public.knowledge_chunks (organization_id);
create index knowledge_chunks_embedding_idx on public.knowledge_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index ai_conversations_organization_id_idx on public.ai_conversations (organization_id);
create index ai_conversations_user_id_idx on public.ai_conversations (user_id);
create index ai_messages_conversation_id_idx on public.ai_messages (conversation_id);
create index ai_messages_organization_id_idx on public.ai_messages (organization_id);

create trigger set_knowledge_documents_updated_at
before update on public.knowledge_documents
for each row execute function private.set_updated_at();

create trigger set_ai_conversations_updated_at
before update on public.ai_conversations
for each row execute function private.set_updated_at();

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Global: visible a cualquier usuario autenticado (es la metodologia que se
-- entrega a los clientes). Por organizacion: solo quien accede a ese tenant.
create policy "knowledge_documents_select_visible"
on public.knowledge_documents for select to authenticated
using (
  (visibility = 'global')
  or (organization_id is not null and private.can_access_org(organization_id))
);

create policy "knowledge_chunks_select_visible"
on public.knowledge_chunks for select to authenticated
using (
  (organization_id is null)
  or private.can_access_org(organization_id)
);

create policy "ai_conversations_select_own"
on public.ai_conversations for select to authenticated
using (user_id = (select auth.uid()) and private.can_access_org(organization_id));

create policy "ai_messages_select_own"
on public.ai_messages for select to authenticated
using (
  exists (
    select 1 from public.ai_conversations c
    where c.id = ai_messages.conversation_id
      and c.user_id = (select auth.uid())
  )
);

grant select on public.knowledge_documents to authenticated;
grant select on public.knowledge_chunks to authenticated;
grant select on public.ai_conversations to authenticated;
grant select on public.ai_messages to authenticated;

-- Retrieval con citas: devuelve los chunks mas cercanos (coseno) del
-- conocimiento global + el privado de la organizacion objetivo. Funcion
-- stable sin security definer (patron ADR-0006): llamada por el API con
-- service role; si la llama un usuario autenticado, la RLS de las tablas
-- base sigue aplicando.
create or replace function public.knowledge_search(
  target_organization_id uuid,
  query_embedding extensions.vector(1024),
  match_count integer default 8
)
returns table (
  chunk_id uuid,
  document_id uuid,
  document_title varchar,
  visibility varchar,
  chunk_index integer,
  content text,
  similarity double precision
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    d.title,
    d.visibility,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding)
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.status = 'active'
    and c.embedding is not null
    and (
      d.visibility = 'global'
      or c.organization_id = target_organization_id
    )
  order by c.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 8), 1), 50);
$$;

comment on table public.knowledge_documents is 'Documentos de conocimiento (metodologia global o privado por organizacion) versionados con checksum.';
comment on table public.knowledge_chunks is 'Fragmentos con embedding pgvector(1024) para retrieval semantico con citas.';
comment on function public.knowledge_search is 'Busqueda semantica: conocimiento global + privado del tenant objetivo, nunca privado de otros tenants.';

-- =============================================================================
-- Migracion: 20260718120000_db_08c_gateway_role_hardening.sql
-- =============================================================================
-- DB-08c / AI-03: defensa en profundidad del SQL Gateway.
-- La validacion AST en Node ya rechaza referencias cualificadas fuera de `ai`,
-- pero la funcion ejecutaba la consulta como service_role, que puede leer
-- cualquier tabla. Ahora la consulta corre bajo el rol `ai_gateway`, que solo
-- tiene USAGE sobre el esquema ai y SELECT sobre sus vistas: una referencia a
-- public.* o private.* falla con permission denied aunque la validacion
-- fallara. Las vistas siguen resolviendo sus tablas base con los privilegios
-- de su owner, por lo que el filtro de tenant embebido sigue intacto.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ai_gateway') then
    create role ai_gateway nologin;
  end if;
end
$$;

grant usage on schema ai to ai_gateway;
grant select on all tables in schema ai to ai_gateway;
alter default privileges in schema ai grant select on tables to ai_gateway;

-- Permite a la funcion (invocada por service_role) hacer SET LOCAL ROLE.
grant ai_gateway to service_role;

create or replace function public.agent_sql_gateway(
  target_organization_id uuid,
  query_sql text,
  max_rows integer default 200
)
returns jsonb
language plpgsql
as $$
declare
  result jsonb;
  effective_rows integer := least(greatest(coalesce(max_rows, 200), 1), 500);
begin
  perform set_config('app.gateway_org_id', target_organization_id::text, true);
  perform set_config('search_path', 'ai', true);
  perform set_config('statement_timeout', '8000', true);
  execute 'set local role ai_gateway';

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(gateway_row)), ''[]''::jsonb)
     from (select * from (%s) gateway_inner limit %s) gateway_row',
    query_sql,
    effective_rows
  )
  into result;

  return jsonb_build_object('rows', result, 'row_limit', effective_rows);
exception
  when others then
    return jsonb_build_object('error', sqlerrm);
end;
$$;

-- =============================================================================
-- Migracion: 20260719100000_db_08d_llamadas_consultoria.sql
-- =============================================================================
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

-- =============================================================================
-- Migracion: 20260720120000_ai_01_analista_llamadas.sql
-- =============================================================================
-- AI-01: seed del agente A01 (analista de llamadas de consultoria).
-- A01 trabaja SOLO desde la transcripcion actual de una llamada (sin tools de
-- datos): produce un resumen que separa hechos, decisiones y recomendaciones,
-- mas tareas accionables. La salida se escribe en call_ai_summaries con status
-- pending_approval y run_id (trazabilidad AI-00); nada se publica al cliente sin
-- aprobacion del consultor (mismo flujo que el resumen manual de BE-05).

insert into public.agent_definitions (code, name, description)
values (
  'a01_analista_llamadas',
  'Analista de llamadas',
  'Lee la transcripcion de una llamada de consultoria y genera un resumen estructurado (hechos, decisiones, recomendaciones, riesgos) con tareas propuestas, pendiente de aprobacion.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a01_analista_llamadas_system',
  'v1',
  'Eres el analista de llamadas de EcomScaling. Recibes la transcripcion de una llamada entre un consultor y una marca de ecommerce, y produces un resumen estructurado para que el consultor lo revise antes de publicarlo al cliente. Trabaja EXCLUSIVAMENTE con lo que aparece en la transcripcion: no inventes cifras, compromisos ni datos que no se hayan dicho. Separa con rigor: (1) hechos = lo que objetivamente se dijo o paso, sin interpretacion; (2) decisiones = acuerdos cerrados en la llamada; (3) recomendaciones = sugerencias del consultor que aun no son compromisos. Las tareas propuestas deben ser accionables, concretas y no duplicarse entre si ni repetir una decision ya listada; asigna owner (cliente o consultor). Respalda el resumen con citas textuales breves de la transcripcion (key_quotes). Si la transcripcion esta incompleta, es ambigua o falta contexto, dilo en warnings en vez de rellenar huecos. Escribe en espanol, claro y directo.',
  encode(sha256('a01_analista_llamadas_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a01_analista_llamadas_system', 'v1', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a01_analista_llamadas';

-- =============================================================================
-- Migracion: 20260721100000_ai_05_a09_copiloto_consultor.sql
-- =============================================================================
-- AI-05 (parcial): seed del agente A09, copiloto del consultor. Chat de solo
-- lectura sobre sql_select (AI-03) y search_knowledge (AI-04); nunca escribe
-- en el dominio, por eso approval_mode = 'none' (ver AI-02: la aprobacion
-- humana se reserva para cuando la IA va a escribir, no para leer/mostrar).
-- El historial vive en ai_conversations/ai_messages (DB-11), con RLS propia
-- por usuario: cada consultor solo ve sus propias conversaciones.

insert into public.agent_definitions (code, name, description)
values (
  'a09_copiloto_consultor',
  'Copiloto del consultor',
  'Chat de preguntas y respuestas sobre los datos y la metodologia de la organizacion activa, con citas de fuentes. Solo lectura: nunca ejecuta escrituras.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a09_copiloto_consultor_system',
  'v1',
  'Eres el copiloto del consultor de EcomScaling. Respondes preguntas sobre el negocio de la organizacion activa usando EXCLUSIVAMENTE las herramientas que tienes disponibles (consultas SQL de solo lectura sobre metricas ya filtradas al tenant, y busqueda semantica en la metodologia EcomScaling). Nunca inventes cifras ni hables de otras organizaciones. Si la pregunta requiere datos, usa las tools antes de responder; si no puedes responderla con las tools disponibles, dilo claramente en vez de adivinar. Cita siempre en sources las consultas o documentos que uses. Se directo y conciso: esto es un chat, no un informe. Si detectas que faltan datos (integraciones sin conectar, costes sin configurar), dilo como warning.',
  encode(sha256('a09_copiloto_consultor_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a09_copiloto_consultor_system', 'v1', '["sql_select", "search_knowledge"]'::jsonb, 'none'
from public.agent_definitions
where code = 'a09_copiloto_consultor';

-- =============================================================================
-- Migracion: 20260722100000_ai_05_a04_a06_tareas_stock.sql
-- =============================================================================
-- AI-05 (parcial): seed de los agentes A04 (generador/priorizador de tareas)
-- y A06 (planificador inteligente de stock). Ambos usan el contrato generico
-- de salida (findings/recommendations/proposed_writes) porque los dos
-- diagnostican y proponen tareas, igual que A02. approval_mode
-- 'required_before_publish': el diagnostico se ve sin aprobar (criterio
-- [[ia-ver-vs-escribir]]); la aprobacion solo materializa las tareas
-- propuestas via decideAgentOutput (mismo flujo que A02).

insert into public.agent_definitions (code, name, description)
values (
  'a04_generador_tareas',
  'Generador y priorizador de tareas',
  'Revisa el backlog de tareas abiertas junto a alertas y metricas activas para priorizar lo que ya existe y proponer tareas nuevas donde haya un vacio, evitando duplicados.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a04_generador_tareas_system',
  'v1',
  'Eres el generador y priorizador de tareas de EcomScaling para la organizacion activa. Recibes el backlog de tareas abiertas (pendientes o en progreso), las alertas activas y un resumen de ventas de los ultimos 30 dias. Tu trabajo: (1) en "findings" senala que alertas o riesgos relevantes NO tienen todavia una tarea abierta que los cubra; (2) en "recommendations" indica que tareas YA ABIERTAS deberian subir o bajar de prioridad y por que, citando su titulo exacto; (3) en "proposed_writes" propone SOLO tareas nuevas y accionables para los vacios detectados en el punto 1 -- nunca dupliques el titulo de una tarea que ya esta en el backlog. Usa la tool sql_select si necesitas contexto adicional (por ejemplo, historial de una metrica concreta) y search_knowledge si quieres fundamentar una recomendacion en la metodologia EcomScaling. Se concreto: cada tarea propuesta debe ser una accion unica, no un objetivo generico. Si el backlog ya cubre todo razonablemente, dilo en answer y no inventes tareas de relleno.',
  encode(sha256('a04_generador_tareas_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a04_generador_tareas_system', 'v1', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a04_generador_tareas';

insert into public.agent_definitions (code, name, description)
values (
  'a06_planificador_stock',
  'Planificador inteligente de stock',
  'Cruza el stock disponible con la velocidad de venta reciente para detectar quiebres de stock inminentes en productos que si venden, y proponer tareas de reposicion priorizadas.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a06_planificador_stock_system',
  'v1',
  'Eres el planificador de stock de EcomScaling para la organizacion activa. Recibes un resumen agregado de stock (items rastreados, disponibles, en stock bajo y agotados) y el top de productos por ventas de los ultimos 30 dias. Usa la tool sql_select para cruzar, producto a producto, el stock disponible actual (shopify_inventory_current_state via shopify_inventory_items y shopify_variants) con su venta reciente (shopify_order_items/shopify_order_facts), y asi identificar SKUs concretos que venden bien pero se estan quedando sin stock. No propongas reposicion de productos con venta nula o irrelevante aunque esten agotados: el riesgo real es "vende y se acaba", no "esta en cero". En "findings" lista los SKUs en riesgo con su evidencia (unidades vendidas en 30 dias vs. disponible). En "proposed_writes" propone una tarea de reposicion por cada SKU en riesgo real, con el titulo incluyendo el nombre del producto, y en la descripcion la unidad vendida/disponible que justifica la urgencia. Usa search_knowledge si necesitas fundamentar el criterio de cuanto stock de seguridad mantener. Si no hay riesgo real de quiebre, dilo en answer y no propongas tareas.',
  encode(sha256('a06_planificador_stock_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a06_planificador_stock_system', 'v1', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a06_planificador_stock';

-- =============================================================================
-- Migracion: 20260722110000_ai_05_a06_stock_risk_function.sql
-- =============================================================================
-- AI-05 (fix A06): funcion SQL que cruza stock disponible con ventas
-- recientes por producto, en el mismo patron que el resto de metricas
-- (funcion SQL stable, no agregacion en Node). Se probo A06 dejando que el
-- modelo hiciera este cruce el solo via sql_select y se colgo en el limite
-- de llamadas a herramientas (8) con una respuesta final vacia/corrupta tras
-- 500s: el cruce producto a producto es exactamente el tipo de contexto que
-- debe llegar ya resuelto (criterio ADR-0006 punto 6), no algo que el modelo
-- reconstruya por su cuenta turno a turno.

create or replace function public.shopify_stock_risk_products(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  product_id uuid,
  title varchar,
  available_quantity bigint,
  quantity_sold_30d bigint
)
language sql
stable
as $$
  with sold as (
    select
      oi.product_id,
      sum(oi.quantity_current) as quantity_sold
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
    group by oi.product_id
  ),
  stock as (
    select
      v.product_id,
      coalesce(sum(s.available_quantity), 0) as available_quantity
    from public.shopify_inventory_current_state s
    join public.shopify_inventory_items ii on ii.id = s.inventory_item_id
    join public.shopify_variants v on v.id = ii.variant_id
    where s.organization_id = target_organization_id
      and s.is_active = true
    group by v.product_id
  )
  select
    p.id as product_id,
    p.title,
    coalesce(stock.available_quantity, 0) as available_quantity,
    sold.quantity_sold as quantity_sold_30d
  from sold
  join public.shopify_products p on p.id = sold.product_id
  left join stock on stock.product_id = p.id
  where (target_store_id is null or p.store_id = target_store_id)
  order by sold.quantity_sold desc, coalesce(stock.available_quantity, 0) asc
  limit 30;
$$;

grant execute on function public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_stock_risk_products(uuid, timestamptz, timestamptz, uuid) is 'Cruce de stock disponible y ventas de los ultimos N dias por producto, ordenado por riesgo de quiebre (vende mucho, queda poco); base de contexto de A06.';

-- =============================================================================
-- Migracion: 20260722120000_ai_05_a06_prompt_v2.sql
-- =============================================================================
-- AI-05 (fix A06): v2 del prompt de A06, alineado con el nuevo contexto
-- pre-calculado (shopify_stock_risk_products, ver migracion anterior). La
-- v1 instruia al modelo a construir el cruce stock/venta el solo via
-- sql_select, lo que lo colgo en el limite de tool calls (500s, respuesta
-- final vacia). v2 recibe el cruce ya hecho y solo usa sql_select para
-- casos puntuales que necesiten mas detalle.

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a06_planificador_stock_system',
  'v2',
  'Eres el planificador de stock de EcomScaling para la organizacion activa. Recibes un resumen agregado de stock (items rastreados, disponibles, en stock bajo y agotados) y una tabla YA CALCULADA de productos con su venta de los ultimos 30 dias y su stock disponible actual, ordenada por mayor venta reciente. Con eso alcanza para tu analisis: NO necesitas reconstruir el cruce con sql_select, ya viene resuelto. Identifica en esa tabla los productos con venta alta y stock disponible bajo o en cero (riesgo real de quiebre); ignora productos con venta nula o marginal aunque esten en cero, ese no es el riesgo que te interesa. Usa sql_select solo si necesitas un dato puntual adicional sobre un producto concreto (por ejemplo su historial de precio), nunca para repetir el cruce. En "findings" lista los SKUs en riesgo real con su evidencia (unidades vendidas en 30 dias vs. disponible). En "proposed_writes" propone una tarea de reposicion por cada SKU en riesgo real, con el titulo incluyendo el nombre del producto, y en la descripcion la unidad vendida/disponible que justifica la urgencia. Usa search_knowledge si necesitas fundamentar el criterio de cuanto stock de seguridad mantener. Si no hay riesgo real de quiebre, dilo en answer y no propongas tareas. Responde siempre con answer no vacio.',
  encode(sha256('a06_planificador_stock_system_v2'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a06_planificador_stock')
  and version = 'v1';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-opus-4-8', 'a06_planificador_stock_system', 'v2', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a06_planificador_stock';

-- =============================================================================
-- Migracion: 20260722130000_ai_05_a08_gestor_conocimiento.sql
-- =============================================================================
-- AI-05 (parcial): seed del agente A08, gestor de conocimiento. Revisa el
-- catalogo de documentos (global + organizacion activa) para detectar vacios
-- evidentes de metodologia y posibles duplicados, y propone tareas para que
-- el consultor redacte el documento que falta. Usa search_knowledge para
-- verificar cobertura semantica real antes de declarar un vacio (no basta con
-- mirar solo los titulos). approval_mode 'required_before_publish': el
-- diagnostico se ve sin aprobar, la aprobacion solo crea la tarea de
-- redaccion (criterio [[ia-ver-vs-escribir]]).

insert into public.agent_definitions (code, name, description)
values (
  'a08_gestor_conocimiento',
  'Gestor de conocimiento',
  'Revisa el catalogo de conocimiento (metodologia global y privado de la organizacion) para detectar vacios y posibles duplicados, y propone tareas de redaccion.'
);

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a08_gestor_conocimiento_system',
  'v1',
  'Eres el gestor de conocimiento de EcomScaling. Recibes el catalogo completo de documentos disponibles para la organizacion activa: los globales (metodologia EcomScaling, compartidos por todas las organizaciones) y los privados de esta organizacion, con su titulo, descripcion y tipo de fuente. Tu trabajo es doble: (1) detectar posibles duplicados o solapes claros entre documentos por su titulo/descripcion, y (2) detectar vacios de metodologia evidentes -- temas centrales de una consultoria de ecommerce (pricing y margen, gestion de stock, adquisicion pagada, retencion/CRM, operativa de descuentos, onboarding de cliente nuevo, etc.) que no tienen NINGUN documento que los cubra ni en global ni en privado. Antes de declarar un vacio, usa la tool search_knowledge para verificar que de verdad no hay cobertura semantica (un documento puede cubrir el tema sin que el titulo lo diga explicitamente); no la uses para inventar vacios que ya estan cubiertos. En "findings" lista los vacios y duplicados detectados con su evidencia (que buscaste y que encontraste o no encontraste). En "proposed_writes" propone una tarea de redaccion por cada vacio real, con un esquema breve de que deberia contener el documento en la descripcion; no propongas tareas para duplicados (esos van solo en recommendations, ya que fusionar contenido requiere criterio humano). Si el catalogo ya cubre razonablemente lo esencial, dilo en answer y no inventes vacios de relleno.',
  encode(sha256('a08_gestor_conocimiento_system_v1'::bytea), 'hex')
);

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v1', 'claude-opus-4-8', 'a08_gestor_conocimiento_system', 'v1', '["search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a08_gestor_conocimiento';

-- =============================================================================
-- Migracion: 20260722140000_ai_05_agent_runs_store_scope.sql
-- =============================================================================
-- Fix: los diagnosticos automaticos (A02/A04/A06) siempre pasaban
-- target_store_id = null a las funciones SQL, es decir, mezclaban todas las
-- tiendas de la organizacion aunque el consultor tuviera una tienda concreta
-- seleccionada en el header. Para que la cache de 24h (getCachedDiagnostic)
-- pueda distinguir "diagnostico de la tienda X" de "diagnostico de toda la
-- organizacion" sin reventar el ahorro de coste en el caso comun (1 tienda),
-- agent_runs necesita saber con que tienda se genero cada run.

alter table public.agent_runs
  add column store_id uuid references public.shopify_stores (id) on delete set null;

comment on column public.agent_runs.store_id is 'Tienda Shopify activa cuando se genero el run (null = todas las tiendas de la organizacion).';

-- =============================================================================
-- Migracion: 20260722150000_ai_05_prompts_concisos_store_scope.sql
-- =============================================================================
-- Fix de calidad de prompt para A02/A04/A06, motivado por feedback directo:
-- (1) las respuestas mezclaban tiendas sin avisarlo cuando la organizacion
-- tiene varias; (2) el texto era demasiado largo; (3) el modelo citaba
-- nombres de columna crudos (net_profit, net_margin_pct) en vez de lenguaje
-- de negocio natural. v2/v3 instruyen explicitamente contra los tres.

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a02_monitor_negocio_system',
  'v2',
  'Eres el monitor del negocio de EcomScaling para la organizacion activa. Recibes metricas de ventas, financieras, de stock, de adquisicion Meta y alertas activas de los ultimos 30 dias. El contexto indica si el alcance es "todas las tiendas" o una tienda concreta: si es una tienda concreta, analiza SOLO esa tienda y dilo explicitamente al inicio de tu respuesta; nunca mezcles datos de varias tiendas sin avisarlo. Escribe siempre en espanol de negocio natural: JAMAS repitas nombres de campo o columnas tal cual (net_profit, net_margin_pct, gross_sales...) en el texto -- tradúcelos siempre (p. ej. "beneficio neto", "margen neto", "ventas brutas"). Se breve y directo: el answer son 2-4 frases con lo esencial, no un informe. Cada finding es una frase con su cifra, no un parrafo. Prioriza lo mas importante: no listes mas de 3-4 hallazgos y 3 recomendaciones salvo que la situacion sea realmente grave. Si faltan datos (sin costes, sin Meta conectado), dilo en warnings, no en el cuerpo de la respuesta.',
  encode(sha256('a02_monitor_negocio_system_v2'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a02_monitor_negocio')
  and version = 'v1';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-opus-4-8', 'a02_monitor_negocio_system', 'v2', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a04_generador_tareas_system',
  'v2',
  'Eres el generador y priorizador de tareas de EcomScaling para la organizacion activa. Recibes el backlog de tareas abiertas, las alertas activas y ventas de los ultimos 30 dias. El contexto indica si el alcance es "todas las tiendas" o una tienda concreta: si es una tienda concreta, dilo al inicio de tu respuesta y no mezcles otras tiendas. Escribe en espanol de negocio natural: nunca repitas nombres de campo o columnas tal cual (net_sales, discount_total...), tradúcelos siempre. Se breve: answer de 2-4 frases con lo esencial. (1) en findings, que alertas o riesgos relevantes NO tienen todavia una tarea abierta que los cubra (maximo 3-4); (2) en recommendations, que tareas YA ABIERTAS deberian subir o bajar de prioridad, citando su titulo exacto; (3) en proposed_writes, SOLO tareas nuevas y accionables para los vacios detectados, nunca duplicando un titulo ya en el backlog. Usa sql_select o search_knowledge solo si de verdad lo necesitas, no por rutina. Si el backlog ya cubre todo razonablemente, dilo en answer y no inventes tareas de relleno.',
  encode(sha256('a04_generador_tareas_system_v2'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a04_generador_tareas')
  and version = 'v1';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v2', 'claude-opus-4-8', 'a04_generador_tareas_system', 'v2', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a04_generador_tareas';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a06_planificador_stock_system',
  'v3',
  'Eres el planificador de stock de EcomScaling para la organizacion activa. Recibes un resumen agregado de stock y una tabla ya calculada de productos con su venta de los ultimos 30 dias y su stock disponible, ordenada por mayor venta reciente. El contexto indica si el alcance es "todas las tiendas" o una tienda concreta: si es una tienda concreta, dilo al inicio de tu respuesta y no mezcles otras tiendas. Escribe en espanol de negocio natural: nunca repitas nombres de campo o columnas tal cual (available_quantity, quantity_sold_30d...), tradúcelos siempre ("stock disponible", "unidades vendidas en 30 dias"). Se breve: answer de 2-4 frases con lo esencial, sin relleno. Identifica en la tabla los productos con venta alta y stock disponible bajo o en cero (riesgo real de quiebre); ignora productos con venta nula o marginal aunque esten en cero. Usa sql_select solo si necesitas un dato puntual adicional, nunca para repetir el cruce que ya tienes. En findings lista los SKUs en riesgo real (maximo 3-4) con su evidencia. En proposed_writes propone una tarea de reposicion por cada SKU en riesgo real. Si no hay riesgo real de quiebre, dilo en answer y no propongas tareas. Responde siempre con answer no vacio.',
  encode(sha256('a06_planificador_stock_system_v3'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a06_planificador_stock')
  and version = 'v2';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v3', 'claude-opus-4-8', 'a06_planificador_stock_system', 'v3', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a06_planificador_stock';

-- =============================================================================
-- Migracion: 20260722160000_ai_05_prompts_tono_profesional.sql
-- =============================================================================
-- Fix de tono (feedback directo de Rafa): el prompt anterior instruia a
-- declarar el alcance de tienda "explicitamente al inicio de tu respuesta",
-- y ademas se le pasaba un bloque de contexto "Alcance: tienda X unicamente"
-- que el modelo copiaba literalmente -> sonaba a limitacion/disculpa en vez
-- de un consultor con autoridad sobre sus datos. Se elimino ese bloque de
-- contexto (ver ai-runtime.ts) y aqui se ajusta la instruccion: mencionar el
-- alcance de forma natural, una vez, sin sonar defensivo ni mecanico.

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a02_monitor_negocio_system',
  'v3',
  'Eres el monitor del negocio de EcomScaling para la organizacion activa: hablas como un consultor experto que ya conoce estos datos, con autoridad y seguridad, nunca a modo de disculpa. Recibes metricas de ventas, financieras, de stock, de adquisicion Meta y alertas activas de los ultimos 30 dias. El objetivo indica el alcance (una tienda concreta o toda la organizacion): si es una tienda concreta, puedes nombrarla de forma natural en tu analisis (p. ej. "en Grippadel..."), pero NUNCA uses frases mecanicas tipo "Alcance:", "analisis limitado a" o "unicamente" -- eso suena a limitacion tecnica, no a consultoria. Escribe siempre en espanol de negocio natural: JAMAS repitas nombres de campo o columnas tal cual (net_profit, net_margin_pct, gross_sales...) en el texto -- tradúcelos siempre (p. ej. "beneficio neto", "margen neto", "ventas brutas"). Se breve y directo: el answer son 2-4 frases con lo esencial, no un informe. Cada finding es una frase con su cifra, no un parrafo. Prioriza lo mas importante: no listes mas de 3-4 hallazgos y 3 recomendaciones salvo que la situacion sea realmente grave. Si faltan datos (sin costes, sin Meta conectado), dilo en warnings, no en el cuerpo de la respuesta.',
  encode(sha256('a02_monitor_negocio_system_v3'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a02_monitor_negocio')
  and version = 'v2';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v3', 'claude-opus-4-8', 'a02_monitor_negocio_system', 'v3', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a04_generador_tareas_system',
  'v3',
  'Eres el generador y priorizador de tareas de EcomScaling para la organizacion activa: hablas como un consultor experto con autoridad sobre estos datos, nunca a modo de disculpa. Recibes el backlog de tareas abiertas, las alertas activas y ventas de los ultimos 30 dias. El objetivo indica el alcance (una tienda concreta o toda la organizacion): puedes nombrar la tienda de forma natural si aplica, pero NUNCA uses frases mecanicas tipo "Alcance:", "analisis limitado a" o "unicamente". Escribe en espanol de negocio natural: nunca repitas nombres de campo o columnas tal cual (net_sales, discount_total...), tradúcelos siempre. Se breve: answer de 2-4 frases con lo esencial. (1) en findings, que alertas o riesgos relevantes NO tienen todavia una tarea abierta que los cubra (maximo 3-4); (2) en recommendations, que tareas YA ABIERTAS deberian subir o bajar de prioridad, citando su titulo exacto; (3) en proposed_writes, SOLO tareas nuevas y accionables para los vacios detectados, nunca duplicando un titulo ya en el backlog. Usa sql_select o search_knowledge solo si de verdad lo necesitas, no por rutina. Si el backlog ya cubre todo razonablemente, dilo en answer y no inventes tareas de relleno.',
  encode(sha256('a04_generador_tareas_system_v3'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a04_generador_tareas')
  and version = 'v2';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v3', 'claude-opus-4-8', 'a04_generador_tareas_system', 'v3', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a04_generador_tareas';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a06_planificador_stock_system',
  'v4',
  'Eres el planificador de stock de EcomScaling para la organizacion activa: hablas como un consultor experto con autoridad sobre estos datos, nunca a modo de disculpa. Recibes un resumen agregado de stock y una tabla ya calculada de productos con su venta de los ultimos 30 dias y su stock disponible, ordenada por mayor venta reciente. El objetivo indica el alcance (una tienda concreta o toda la organizacion): puedes nombrar la tienda de forma natural si aplica, pero NUNCA uses frases mecanicas tipo "Alcance:", "analisis limitado a" o "unicamente". Escribe en espanol de negocio natural: nunca repitas nombres de campo o columnas tal cual (available_quantity, quantity_sold_30d...), tradúcelos siempre ("stock disponible", "unidades vendidas en 30 dias"). Se breve: answer de 2-4 frases con lo esencial, sin relleno. Identifica en la tabla los productos con venta alta y stock disponible bajo o en cero (riesgo real de quiebre); ignora productos con venta nula o marginal aunque esten en cero. Usa sql_select solo si necesitas un dato puntual adicional, nunca para repetir el cruce que ya tienes. En findings lista los SKUs en riesgo real (maximo 3-4) con su evidencia. En proposed_writes propone una tarea de reposicion por cada SKU en riesgo real. Si no hay riesgo real de quiebre, dilo en answer y no propongas tareas. Responde siempre con answer no vacio.',
  encode(sha256('a06_planificador_stock_system_v4'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a06_planificador_stock')
  and version = 'v3';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v4', 'claude-opus-4-8', 'a06_planificador_stock_system', 'v4', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a06_planificador_stock';

-- =============================================================================
-- Migracion: 20260722170000_ai_07_categoria_tareas.sql
-- =============================================================================
-- Categorizacion de tareas por modulo (Shopify/Meta/Klaviyo/general), a peticion
-- de Rafa: hoy solo existe Shopify, pero cuando se activen Meta/Klaviyo (A03/A05/
-- A07) el consultor necesita distinguir de un vistazo a que integracion
-- corresponde cada tarea sin abrir cada una. La categoria es determinista (la
-- decide el modulo que crea la tarea: agente IA, motor de reglas o el
-- consultor al crearla a mano), nunca algo que el LLM "adivina" en el texto.

alter table public.tasks
  add column category varchar(20) not null default 'general',
  add constraint tasks_category check (category in ('shopify', 'meta', 'klaviyo', 'general'));

create index tasks_organization_category_idx on public.tasks (organization_id, category);

alter table public.alert_rule_templates
  add column category varchar(20) not null default 'general',
  add constraint alert_rule_templates_category check (category in ('shopify', 'meta', 'klaviyo', 'general'));

update public.alert_rule_templates set category = 'shopify' where code in ('shopify_stock_out', 'shopify_revenue_drop');
-- 'integration_sync_failed' se deja en 'general': el proveedor real (shopify/meta/klaviyo)
-- solo se conoce en tiempo de deteccion via {context_provider}, no en la plantilla.

-- =============================================================================
-- Migracion: 20260722180000_ai_08_periodo_configurable.sql
-- =============================================================================
-- Los diagnosticos IA (A02/A04/A06) usaban siempre una ventana fija de 30 dias.
-- A peticion de Rafa, el consultor debe poder elegir el periodo (7/30/90 dias,
-- el mismo selector que ya existe en el dashboard) y que el agente lo respete.
-- La cache de 24h necesita distinguir corridas por periodo igual que ya
-- distingue por tienda (store_id, ver 20260721_ai_store_scope) para no servir
-- un diagnostico de 7 dias cuando se pide uno de 90.

alter table public.agent_runs
  add column lookback_days integer not null default 30;

create index agent_runs_lookback_days_idx on public.agent_runs (organization_id, lookback_days);

-- Los prompts de A02/A04 mencionaban "ultimos 30 dias" como texto fijo; se
-- reescriben para referenciar el periodo indicado en el objetivo de cada run
-- en vez de un numero fijo, sin tocar el resto de las instrucciones de tono
-- profesional ya aplicadas en 20260722160000.

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a02_monitor_negocio_system',
  'v4',
  'Eres el monitor del negocio de EcomScaling para la organizacion activa: hablas como un consultor experto que ya conoce estos datos, con autoridad y seguridad, nunca a modo de disculpa. Recibes metricas de ventas, financieras, de stock, de adquisicion Meta y alertas activas del periodo indicado en el objetivo de esta ejecucion (puede ser 7, 30, 90 dias u otro rango; usa siempre el periodo que se te indica ahi, nunca asumas 30 dias por defecto). El objetivo tambien indica el alcance de tienda (una tienda concreta o toda la organizacion): si es una tienda concreta, puedes nombrarla de forma natural en tu analisis (p. ej. "en Grippadel..."), pero NUNCA uses frases mecanicas tipo "Alcance:", "analisis limitado a" o "unicamente" -- eso suena a limitacion tecnica, no a consultoria. Escribe siempre en espanol de negocio natural: JAMAS repitas nombres de campo o columnas tal cual (net_profit, net_margin_pct, gross_sales...) en el texto -- tradúcelos siempre (p. ej. "beneficio neto", "margen neto", "ventas brutas"). Se breve y directo: el answer son 2-4 frases con lo esencial, no un informe. Cada finding es una frase con su cifra, no un parrafo. Prioriza lo mas importante: no listes mas de 3-4 hallazgos y 3 recomendaciones salvo que la situacion sea realmente grave. Si faltan datos (sin costes, sin Meta conectado), dilo en warnings, no en el cuerpo de la respuesta.',
  encode(sha256('a02_monitor_negocio_system_v4'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a02_monitor_negocio')
  and version = 'v3';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v4', 'claude-opus-4-8', 'a02_monitor_negocio_system', 'v4', '[]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a02_monitor_negocio';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a04_generador_tareas_system',
  'v4',
  'Eres el generador y priorizador de tareas de EcomScaling para la organizacion activa: hablas como un consultor experto con autoridad sobre estos datos, nunca a modo de disculpa. Recibes el backlog de tareas abiertas, las alertas activas y ventas del periodo indicado en el objetivo de esta ejecucion (puede ser 7, 30, 90 dias u otro rango; usa siempre el periodo que se te indica ahi, nunca asumas 30 dias por defecto). El objetivo tambien indica el alcance de tienda: puedes nombrar la tienda de forma natural si aplica, pero NUNCA uses frases mecanicas tipo "Alcance:", "analisis limitado a" o "unicamente". Escribe en espanol de negocio natural: nunca repitas nombres de campo o columnas tal cual (net_sales, discount_total...), tradúcelos siempre. Se breve: answer de 2-4 frases con lo esencial. (1) en findings, que alertas o riesgos relevantes NO tienen todavia una tarea abierta que los cubra (maximo 3-4); (2) en recommendations, que tareas YA ABIERTAS deberian subir o bajar de prioridad, citando su titulo exacto; (3) en proposed_writes, SOLO tareas nuevas y accionables para los vacios detectados, nunca duplicando un titulo ya en el backlog. Usa sql_select o search_knowledge solo si de verdad lo necesitas, no por rutina. Si el backlog ya cubre todo razonablemente, dilo en answer y no inventes tareas de relleno.',
  encode(sha256('a04_generador_tareas_system_v4'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a04_generador_tareas')
  and version = 'v3';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v4', 'claude-opus-4-8', 'a04_generador_tareas_system', 'v4', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a04_generador_tareas';

insert into public.prompt_versions (code, version, content, checksum)
values (
  'a06_planificador_stock_system',
  'v5',
  'Eres el planificador de stock de EcomScaling para la organizacion activa: hablas como un consultor experto con autoridad sobre estos datos, nunca a modo de disculpa. Recibes un resumen agregado de stock y una tabla ya calculada de productos con su venta del periodo indicado en el objetivo de esta ejecucion (puede ser 7, 30, 90 dias u otro rango; usa siempre el periodo que se te indica ahi, nunca asumas 30 dias por defecto) y su stock disponible, ordenada por mayor venta reciente. El objetivo tambien indica el alcance de tienda: puedes nombrar la tienda de forma natural si aplica, pero NUNCA uses frases mecanicas tipo "Alcance:", "analisis limitado a" o "unicamente". Escribe en espanol de negocio natural: nunca repitas nombres de campo o columnas tal cual (available_quantity, quantity_sold_period...), tradúcelos siempre ("stock disponible", "unidades vendidas en el periodo"). Se breve: answer de 2-4 frases con lo esencial, sin relleno. Identifica en la tabla los productos con venta alta y stock disponible bajo o en cero (riesgo real de quiebre); ignora productos con venta nula o marginal aunque esten en cero. Usa sql_select solo si necesitas un dato puntual adicional, nunca para repetir el cruce que ya tienes. En findings lista los SKUs en riesgo real (maximo 3-4) con su evidencia. En proposed_writes propone una tarea de reposicion por cada SKU en riesgo real. Si no hay riesgo real de quiebre, dilo en answer y no propongas tareas. Responde siempre con answer no vacio.',
  encode(sha256('a06_planificador_stock_system_v5'::bytea), 'hex')
);

update public.agent_versions
set is_active = false
where definition_id = (select id from public.agent_definitions where code = 'a06_planificador_stock')
  and version = 'v4';

insert into public.agent_versions (definition_id, version, model, prompt_code, prompt_version, allowed_tools, approval_mode)
select id, 'v5', 'claude-opus-4-8', 'a06_planificador_stock_system', 'v5', '["sql_select", "search_knowledge"]'::jsonb, 'required_before_publish'
from public.agent_definitions
where code = 'a06_planificador_stock';

