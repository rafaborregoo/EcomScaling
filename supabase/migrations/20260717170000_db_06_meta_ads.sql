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

create table if not exists public.meta_business_accounts (
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

create table if not exists public.meta_pages (
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

create table if not exists private.meta_asset_tokens (
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

create table if not exists public.meta_ad_accounts (
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

create table if not exists public.meta_campaigns (
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

create table if not exists public.meta_ad_sets (
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

create table if not exists public.meta_creatives (
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

create table if not exists public.meta_creative_assets (
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

create table if not exists public.meta_ads (
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

create table if not exists public.meta_ad_creative_assignments (
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

create table if not exists public.meta_insight_rows_daily (
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

create table if not exists public.meta_insight_action_metrics (
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

create table if not exists public.meta_calculated_metrics_daily (
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

create table if not exists public.meta_insight_report_runs (
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

create index if not exists meta_business_accounts_organization_id_idx on public.meta_business_accounts (organization_id);
create index if not exists meta_business_accounts_connection_id_idx on public.meta_business_accounts (connection_id);
create index if not exists meta_pages_organization_id_idx on public.meta_pages (organization_id);
create index if not exists meta_pages_business_account_id_idx on public.meta_pages (business_account_id);
create index if not exists meta_asset_tokens_connection_id_idx on private.meta_asset_tokens (connection_id);
create index if not exists meta_asset_tokens_token_expires_at_idx on private.meta_asset_tokens (token_expires_at);
create index if not exists meta_ad_accounts_organization_id_idx on public.meta_ad_accounts (organization_id);
create index if not exists meta_ad_accounts_business_account_id_idx on public.meta_ad_accounts (business_account_id);
create index if not exists meta_ad_accounts_account_status_code_idx on public.meta_ad_accounts (account_status_code);
create index if not exists meta_campaigns_organization_id_idx on public.meta_campaigns (organization_id);
create index if not exists meta_campaigns_ad_account_id_idx on public.meta_campaigns (ad_account_id);
create index if not exists meta_campaigns_effective_status_idx on public.meta_campaigns (effective_status);
create index if not exists meta_campaigns_objective_idx on public.meta_campaigns (objective);
create index if not exists meta_ad_sets_organization_id_idx on public.meta_ad_sets (organization_id);
create index if not exists meta_ad_sets_campaign_id_idx on public.meta_ad_sets (campaign_id);
create index if not exists meta_ad_sets_effective_status_idx on public.meta_ad_sets (effective_status);
create index if not exists meta_ad_sets_optimization_goal_idx on public.meta_ad_sets (optimization_goal);
create index if not exists meta_creatives_organization_id_idx on public.meta_creatives (organization_id);
create index if not exists meta_creatives_ad_account_id_idx on public.meta_creatives (ad_account_id);
create index if not exists meta_creatives_external_video_id_idx on public.meta_creatives (external_video_id);
create index if not exists meta_creatives_image_hash_idx on public.meta_creatives (image_hash);
create index if not exists meta_creative_assets_organization_id_idx on public.meta_creative_assets (organization_id);
create index if not exists meta_creative_assets_creative_id_idx on public.meta_creative_assets (creative_id);
create index if not exists meta_creative_assets_asset_type_idx on public.meta_creative_assets (asset_type);
create index if not exists meta_creative_assets_external_asset_id_idx on public.meta_creative_assets (external_asset_id);
create index if not exists meta_creative_assets_asset_hash_idx on public.meta_creative_assets (asset_hash);
create index if not exists meta_ads_organization_id_idx on public.meta_ads (organization_id);
create index if not exists meta_ads_ad_set_id_idx on public.meta_ads (ad_set_id);
create index if not exists meta_ads_current_creative_id_idx on public.meta_ads (current_creative_id);
create index if not exists meta_ads_effective_status_idx on public.meta_ads (effective_status);
create index if not exists meta_ads_parsed_angle_idx on public.meta_ads (parsed_angle);
create index if not exists meta_ads_parsed_format_idx on public.meta_ads (parsed_format);
create index if not exists meta_ad_creative_assignments_organization_id_idx on public.meta_ad_creative_assignments (organization_id);
create index if not exists meta_ad_creative_assignments_ad_id_idx on public.meta_ad_creative_assignments (ad_id);
create index if not exists meta_ad_creative_assignments_creative_id_idx on public.meta_ad_creative_assignments (creative_id);
create index if not exists meta_ad_creative_assignments_valid_from_idx on public.meta_ad_creative_assignments (valid_from);
create index if not exists meta_insight_rows_daily_organization_id_idx on public.meta_insight_rows_daily (organization_id);
create index if not exists meta_insight_rows_daily_ad_account_id_idx on public.meta_insight_rows_daily (ad_account_id);
create index if not exists meta_insight_rows_daily_campaign_id_idx on public.meta_insight_rows_daily (campaign_id);
create index if not exists meta_insight_rows_daily_ad_set_id_idx on public.meta_insight_rows_daily (ad_set_id);
create index if not exists meta_insight_rows_daily_ad_id_idx on public.meta_insight_rows_daily (ad_id);
create index if not exists meta_insight_rows_daily_level_idx on public.meta_insight_rows_daily (level);
create index if not exists meta_insight_rows_daily_metric_date_idx on public.meta_insight_rows_daily (metric_date);
create index if not exists meta_insight_rows_daily_publisher_platform_idx on public.meta_insight_rows_daily (publisher_platform);
create index if not exists meta_insight_rows_daily_platform_position_idx on public.meta_insight_rows_daily (platform_position);
-- Indice que calza con el predicado tipico del dashboard: gasto por org y rango de fechas.
create index if not exists meta_insight_rows_daily_org_date_idx on public.meta_insight_rows_daily (organization_id, metric_date);
create index if not exists meta_insight_action_metrics_organization_id_idx on public.meta_insight_action_metrics (organization_id);
create index if not exists meta_insight_action_metrics_insight_row_id_idx on public.meta_insight_action_metrics (insight_row_id);
create index if not exists meta_insight_action_metrics_metric_name_idx on public.meta_insight_action_metrics (metric_name);
create index if not exists meta_insight_action_metrics_action_type_idx on public.meta_insight_action_metrics (action_type);
create index if not exists meta_calculated_metrics_daily_organization_id_idx on public.meta_calculated_metrics_daily (organization_id);
create index if not exists meta_calculated_metrics_daily_insight_row_id_idx on public.meta_calculated_metrics_daily (insight_row_id);
create index if not exists meta_calculated_metrics_daily_metric_code_idx on public.meta_calculated_metrics_daily (metric_code);
create index if not exists meta_insight_report_runs_organization_id_idx on public.meta_insight_report_runs (organization_id);
create index if not exists meta_insight_report_runs_ad_account_id_idx on public.meta_insight_report_runs (ad_account_id);
create index if not exists meta_insight_report_runs_status_idx on public.meta_insight_report_runs (status);

drop trigger if exists set_meta_business_accounts_updated_at on public.meta_business_accounts;
create trigger set_meta_business_accounts_updated_at
before update on public.meta_business_accounts
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_pages_updated_at on public.meta_pages;
create trigger set_meta_pages_updated_at
before update on public.meta_pages
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_asset_tokens_updated_at on private.meta_asset_tokens;
create trigger set_meta_asset_tokens_updated_at
before update on private.meta_asset_tokens
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_ad_accounts_updated_at on public.meta_ad_accounts;
create trigger set_meta_ad_accounts_updated_at
before update on public.meta_ad_accounts
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_campaigns_updated_at on public.meta_campaigns;
create trigger set_meta_campaigns_updated_at
before update on public.meta_campaigns
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_ad_sets_updated_at on public.meta_ad_sets;
create trigger set_meta_ad_sets_updated_at
before update on public.meta_ad_sets
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_creatives_updated_at on public.meta_creatives;
create trigger set_meta_creatives_updated_at
before update on public.meta_creatives
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_creative_assets_updated_at on public.meta_creative_assets;
create trigger set_meta_creative_assets_updated_at
before update on public.meta_creative_assets
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_ads_updated_at on public.meta_ads;
create trigger set_meta_ads_updated_at
before update on public.meta_ads
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_insight_rows_daily_updated_at on public.meta_insight_rows_daily;
create trigger set_meta_insight_rows_daily_updated_at
before update on public.meta_insight_rows_daily
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_insight_action_metrics_updated_at on public.meta_insight_action_metrics;
create trigger set_meta_insight_action_metrics_updated_at
before update on public.meta_insight_action_metrics
for each row execute function private.set_updated_at();

drop trigger if exists set_meta_insight_report_runs_updated_at on public.meta_insight_report_runs;
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

drop policy if exists "meta_business_accounts_select_authorized" on public.meta_business_accounts;
create policy "meta_business_accounts_select_authorized" on public.meta_business_accounts
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_pages_select_authorized" on public.meta_pages;
create policy "meta_pages_select_authorized" on public.meta_pages
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_ad_accounts_select_authorized" on public.meta_ad_accounts;
create policy "meta_ad_accounts_select_authorized" on public.meta_ad_accounts
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_campaigns_select_authorized" on public.meta_campaigns;
create policy "meta_campaigns_select_authorized" on public.meta_campaigns
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_ad_sets_select_authorized" on public.meta_ad_sets;
create policy "meta_ad_sets_select_authorized" on public.meta_ad_sets
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_creatives_select_authorized" on public.meta_creatives;
create policy "meta_creatives_select_authorized" on public.meta_creatives
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_creative_assets_select_authorized" on public.meta_creative_assets;
create policy "meta_creative_assets_select_authorized" on public.meta_creative_assets
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_ads_select_authorized" on public.meta_ads;
create policy "meta_ads_select_authorized" on public.meta_ads
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_ad_creative_assignments_select_authorized" on public.meta_ad_creative_assignments;
create policy "meta_ad_creative_assignments_select_authorized" on public.meta_ad_creative_assignments
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_insight_rows_daily_select_authorized" on public.meta_insight_rows_daily;
create policy "meta_insight_rows_daily_select_authorized" on public.meta_insight_rows_daily
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_insight_action_metrics_select_authorized" on public.meta_insight_action_metrics;
create policy "meta_insight_action_metrics_select_authorized" on public.meta_insight_action_metrics
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_calculated_metrics_daily_select_authorized" on public.meta_calculated_metrics_daily;
create policy "meta_calculated_metrics_daily_select_authorized" on public.meta_calculated_metrics_daily
for select
to authenticated
using (private.can_access_org(organization_id));

drop policy if exists "meta_insight_report_runs_select_authorized" on public.meta_insight_report_runs;
create policy "meta_insight_report_runs_select_authorized" on public.meta_insight_report_runs
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
