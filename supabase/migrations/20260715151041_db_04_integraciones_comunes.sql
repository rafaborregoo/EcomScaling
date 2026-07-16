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
