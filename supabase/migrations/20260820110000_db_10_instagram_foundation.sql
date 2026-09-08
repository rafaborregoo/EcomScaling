-- DB-10 / INT-05: foundation for organic Instagram data.
--
-- This migration creates only tenant-isolated empty tables. It does not create
-- accounts, media, insights or follower winners; those rows require a real
-- professional account and an approved Meta/Instagram authorization.
-- Writes remain service-role only, following the integration module pattern.

create table if not exists public.instagram_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  external_instagram_id varchar(255) not null,
  username varchar(255),
  display_name varchar(255),
  account_type varchar(40),
  auth_strategy varchar(40) not null,
  scopes text[] not null default '{}',
  linked_page_external_id varchar(255),
  followers_count integer,
  media_count integer,
  is_selected boolean not null default true,
  is_active boolean not null default true,
  last_synced_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_accounts_unique_external unique (connection_id, external_instagram_id),
  constraint instagram_accounts_auth_strategy_check check (
    auth_strategy in ('instagram_login', 'facebook_login')
  ),
  constraint instagram_accounts_counts_check check (
    (followers_count is null or followers_count >= 0)
    and (media_count is null or media_count >= 0)
  )
);

create table if not exists public.instagram_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.instagram_accounts (id) on delete cascade,
  snapshot_date date not null,
  timezone varchar(80) not null,
  followers_count integer,
  media_count integer,
  captured_at timestamptz not null default now(),
  source varchar(20) not null default 'api',
  constraint instagram_account_snapshots_unique_day unique (account_id, snapshot_date),
  constraint instagram_account_snapshots_source_check check (source in ('api', 'manual')),
  constraint instagram_account_snapshots_counts_check check (
    (followers_count is null or followers_count >= 0)
    and (media_count is null or media_count >= 0)
  )
);

create table if not exists public.instagram_account_insight_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.instagram_accounts (id) on delete cascade,
  metric_name varchar(120) not null,
  period_start date not null,
  period_end date not null,
  value numeric(20, 6),
  captured_at timestamptz not null default now(),
  source varchar(20) not null default 'api',
  constraint instagram_account_insights_unique_period unique (
    account_id, metric_name, period_start, period_end
  ),
  constraint instagram_account_insights_period_check check (period_end >= period_start),
  constraint instagram_account_insights_source_check check (source in ('api', 'manual'))
);

create table if not exists public.instagram_media (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.instagram_accounts (id) on delete cascade,
  external_media_id varchar(255) not null,
  media_type varchar(40) not null,
  caption text,
  permalink text,
  published_at timestamptz,
  thumbnail_url text,
  media_url text,
  media_url_expires_at timestamptz,
  children jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_media_unique_external unique (account_id, external_media_id),
  constraint instagram_media_type_check check (
    media_type in ('image', 'video', 'reel', 'carousel', 'story', 'unknown')
  )
);

create table if not exists public.instagram_media_insight_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.instagram_accounts (id) on delete cascade,
  media_id uuid not null references public.instagram_media (id) on delete cascade,
  metric_name varchar(120) not null,
  period varchar(40) not null,
  period_start date,
  period_end date,
  value numeric(20, 6),
  captured_at timestamptz not null default now(),
  source varchar(20) not null default 'api',
  constraint instagram_media_insights_unique_period unique (
    media_id, metric_name, period, period_start, period_end
  ),
  constraint instagram_media_insights_period_check check (
    period_end is null or period_start is null or period_end >= period_start
  ),
  constraint instagram_media_insights_source_check check (source in ('api', 'manual'))
);

create table if not exists public.instagram_follower_winners (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.instagram_accounts (id) on delete cascade,
  media_id uuid references public.instagram_media (id) on delete set null,
  ranking integer not null,
  followers_attributed integer,
  period_start date not null,
  period_end date not null,
  source varchar(20) not null,
  confidence varchar(20),
  notes text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint instagram_follower_winners_unique_period unique (
    account_id, media_id, ranking, period_start, period_end
  ),
  constraint instagram_follower_winners_ranking_check check (ranking > 0),
  constraint instagram_follower_winners_followers_check check (
    followers_attributed is null or followers_attributed >= 0
  ),
  constraint instagram_follower_winners_period_check check (period_end >= period_start),
  constraint instagram_follower_winners_source_check check (source in ('manual', 'api')),
  constraint instagram_follower_winners_confidence_check check (
    confidence is null or confidence in ('low', 'medium', 'high')
  )
);

create index if not exists instagram_accounts_organization_idx on public.instagram_accounts (organization_id);
create index if not exists instagram_accounts_connection_idx on public.instagram_accounts (connection_id);
create index if not exists instagram_account_snapshots_account_date_idx on public.instagram_account_snapshots (account_id, snapshot_date desc);
create index if not exists instagram_account_insights_account_period_idx on public.instagram_account_insight_values (account_id, period_start desc);
create index if not exists instagram_media_organization_published_idx on public.instagram_media (organization_id, published_at desc);
create index if not exists instagram_media_account_published_idx on public.instagram_media (account_id, published_at desc);
create index if not exists instagram_media_insights_media_captured_idx on public.instagram_media_insight_values (media_id, captured_at desc);
create index if not exists instagram_follower_winners_account_period_idx on public.instagram_follower_winners (account_id, period_end desc, ranking);

drop trigger if exists set_instagram_accounts_updated_at on public.instagram_accounts;
create trigger set_instagram_accounts_updated_at
before update on public.instagram_accounts
for each row execute function private.set_updated_at();

drop trigger if exists set_instagram_media_updated_at on public.instagram_media;
create trigger set_instagram_media_updated_at
before update on public.instagram_media
for each row execute function private.set_updated_at();

drop trigger if exists set_instagram_follower_winners_updated_at on public.instagram_follower_winners;
create trigger set_instagram_follower_winners_updated_at
before update on public.instagram_follower_winners
for each row execute function private.set_updated_at();

alter table public.instagram_accounts enable row level security;
alter table public.instagram_account_snapshots enable row level security;
alter table public.instagram_account_insight_values enable row level security;
alter table public.instagram_media enable row level security;
alter table public.instagram_media_insight_values enable row level security;
alter table public.instagram_follower_winners enable row level security;

drop policy if exists "instagram_accounts_select_authorized" on public.instagram_accounts;
create policy "instagram_accounts_select_authorized" on public.instagram_accounts for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "instagram_account_snapshots_select_authorized" on public.instagram_account_snapshots;
create policy "instagram_account_snapshots_select_authorized" on public.instagram_account_snapshots for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "instagram_account_insights_select_authorized" on public.instagram_account_insight_values;
create policy "instagram_account_insights_select_authorized" on public.instagram_account_insight_values for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "instagram_media_select_authorized" on public.instagram_media;
create policy "instagram_media_select_authorized" on public.instagram_media for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "instagram_media_insights_select_authorized" on public.instagram_media_insight_values;
create policy "instagram_media_insights_select_authorized" on public.instagram_media_insight_values for select to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "instagram_follower_winners_select_authorized" on public.instagram_follower_winners;
create policy "instagram_follower_winners_select_authorized" on public.instagram_follower_winners for select to authenticated
using (private.can_access_org(organization_id));

grant select on public.instagram_accounts to authenticated;
grant select on public.instagram_account_snapshots to authenticated;
grant select on public.instagram_account_insight_values to authenticated;
grant select on public.instagram_media to authenticated;
grant select on public.instagram_media_insight_values to authenticated;
grant select on public.instagram_follower_winners to authenticated;

comment on table public.instagram_accounts is
  'Cuentas profesionales de Instagram descubiertas mediante una autorizacion Meta/Instagram real.';
comment on table public.instagram_account_snapshots is
  'Snapshots de cuenta; no se infieren seguidores ni media cuando no hay respuesta del proveedor.';
comment on table public.instagram_account_insight_values is
  'Metricas de cuenta por periodo, almacenadas por nombre porque la disponibilidad varia por permiso.';
comment on table public.instagram_media is
  'Media organica de Instagram; media_url_expires_at obliga a refrescar URLs caducables antes de mostrarlas.';
comment on table public.instagram_media_insight_values is
  'Metricas organicas por media y periodo, separadas de Meta Ads Insights.';
comment on table public.instagram_follower_winners is
  'Ranking de ganadores de seguidores con fuente explicita; no atribuye seguidores automaticamente a un post.';
