-- Primera capa de tracking de comportamiento para Klaviyo.
-- Los tokens y las escrituras viven en el backend; estas tablas solo exponen
-- lectura multi-tenant a usuarios autorizados y a los agentes mediante RPC.

create table if not exists public.klaviyo_tracking_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_profile_id varchar(255),
  shopify_customer_id varchar(255),
  email text,
  email_normalized text,
  phone text,
  phone_normalized text,
  first_name text,
  last_name text,
  raw_data jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_tracking_profiles_identity_check check (
    external_profile_id is not null
    or email_normalized is not null
    or phone_normalized is not null
    or shopify_customer_id is not null
  )
);

create unique index if not exists klaviyo_tracking_profiles_external_idx on public.klaviyo_tracking_profiles (account_id, external_profile_id)
  where external_profile_id is not null;
create unique index if not exists klaviyo_tracking_profiles_email_idx on public.klaviyo_tracking_profiles (account_id, email_normalized)
  where email_normalized is not null;
create unique index if not exists klaviyo_tracking_profiles_shopify_idx on public.klaviyo_tracking_profiles (account_id, shopify_customer_id)
  where shopify_customer_id is not null;

create table if not exists public.klaviyo_tracking_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  profile_id uuid references public.klaviyo_tracking_profiles (id) on delete set null,
  event_name varchar(120) not null,
  source varchar(40) not null,
  source_event_id varchar(255),
  dedupe_key varchar(128) not null,
  occurred_at timestamptz not null,
  value numeric(16, 4),
  currency_code varchar(3),
  properties jsonb not null default '{}'::jsonb,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint klaviyo_tracking_events_source_check check (source in ('shopify_webhook', 'klaviyo', 'manual')),
  constraint klaviyo_tracking_events_currency_check check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  constraint klaviyo_tracking_events_dedupe_unique unique (account_id, dedupe_key)
);

create index if not exists klaviyo_tracking_events_org_time_idx on public.klaviyo_tracking_events (organization_id, occurred_at desc);
create index if not exists klaviyo_tracking_events_profile_time_idx on public.klaviyo_tracking_events (profile_id, occurred_at desc);
create index if not exists klaviyo_tracking_events_name_time_idx on public.klaviyo_tracking_events (organization_id, event_name, occurred_at desc);

create table if not exists public.klaviyo_tracking_consents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  profile_id uuid not null references public.klaviyo_tracking_profiles (id) on delete cascade,
  channel varchar(20) not null,
  status varchar(40) not null,
  source varchar(40) not null,
  occurred_at timestamptz not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint klaviyo_tracking_consents_channel_check check (channel in ('email', 'sms', 'push')),
  constraint klaviyo_tracking_consents_source_check check (source in ('shopify_webhook', 'klaviyo', 'manual')),
  constraint klaviyo_tracking_consents_unique unique (profile_id, channel, occurred_at, source)
);

create index if not exists klaviyo_tracking_consents_org_idx on public.klaviyo_tracking_consents (organization_id, occurred_at desc);

alter table public.klaviyo_tracking_profiles enable row level security;
alter table public.klaviyo_tracking_events enable row level security;
alter table public.klaviyo_tracking_consents enable row level security;

drop policy if exists "klaviyo_tracking_profiles_select_authorized" on public.klaviyo_tracking_profiles;
create policy "klaviyo_tracking_profiles_select_authorized" on public.klaviyo_tracking_profiles for select to authenticated
  using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_tracking_events_select_authorized" on public.klaviyo_tracking_events;
create policy "klaviyo_tracking_events_select_authorized" on public.klaviyo_tracking_events for select to authenticated
  using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_tracking_consents_select_authorized" on public.klaviyo_tracking_consents;
create policy "klaviyo_tracking_consents_select_authorized" on public.klaviyo_tracking_consents for select to authenticated
  using (private.can_access_org(organization_id));

grant select on public.klaviyo_tracking_profiles,
  public.klaviyo_tracking_events,
  public.klaviyo_tracking_consents to authenticated;

drop function if exists public.klaviyo_tracking_summary(uuid, timestamptz, timestamptz);
create or replace function public.klaviyo_tracking_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  event_name text,
  event_count bigint,
  revenue numeric,
  profiles bigint,
  first_event_at timestamptz,
  last_event_at timestamptz
)
language sql
stable
as $$
  select
    e.event_name::text,
    count(*)::bigint,
    coalesce(sum(e.value), 0),
    count(distinct e.profile_id)::bigint,
    min(e.occurred_at),
    max(e.occurred_at)
  from public.klaviyo_tracking_events e
  where e.organization_id = target_organization_id
    and e.occurred_at >= period_start
    and e.occurred_at <= period_end
  group by e.event_name
  order by count(*) desc, e.event_name;
$$;

grant execute on function public.klaviyo_tracking_summary(uuid, timestamptz, timestamptz) to authenticated;

comment on table public.klaviyo_tracking_profiles is 'Perfiles normalizados para unir Shopify, Klaviyo y eventos de comportamiento.';
comment on table public.klaviyo_tracking_events is 'Eventos normalizados e idempotentes para tracking y agentes de IA.';
comment on table public.klaviyo_tracking_consents is 'Histórico auditable de consentimiento por perfil y canal.';
