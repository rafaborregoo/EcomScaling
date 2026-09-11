create type public.klaviyo_audience_type as enum ('list', 'segment');
create type public.klaviyo_audience_role as enum ('included', 'excluded');
create type public.klaviyo_report_entity_type as enum (
  'campaign',
  'campaign_message',
  'flow',
  'flow_message',
  'form',
  'segment'
);
create type public.klaviyo_report_type as enum ('values', 'series', 'metric_aggregate');
create type public.klaviyo_report_status as enum ('pending', 'running', 'completed', 'failed');

create table if not exists public.klaviyo_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  external_account_id varchar(255) not null,
  account_name varchar(255),
  timezone varchar(100),
  default_currency varchar(3),
  public_api_key varchar(50),
  api_revision varchar(30) not null default '2026-04-15',
  is_active boolean not null default true,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_accounts_unique_external unique (connection_id, external_account_id),
  constraint klaviyo_accounts_unique_connection unique (connection_id)
);

create table if not exists public.klaviyo_lists (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_list_id varchar(255) not null,
  name varchar(255) not null,
  opt_in_process varchar(80),
  is_active boolean not null default true,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_lists_unique_external unique (account_id, external_list_id)
);

create table if not exists public.klaviyo_list_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  list_id uuid not null references public.klaviyo_lists (id) on delete cascade,
  snapshot_date date not null,
  profile_count bigint not null default 0,
  captured_at timestamptz not null default now(),
  constraint klaviyo_list_snapshots_unique_capture unique (list_id, snapshot_date),
  constraint klaviyo_list_snapshots_profile_count_check check (profile_count >= 0)
);

create table if not exists public.klaviyo_segments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_segment_id varchar(255) not null,
  name varchar(255) not null,
  is_active boolean,
  is_starred boolean not null default false,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_segments_unique_external unique (account_id, external_segment_id)
);

create table if not exists public.klaviyo_segment_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  segment_id uuid not null references public.klaviyo_segments (id) on delete cascade,
  snapshot_date date not null,
  profile_count bigint not null default 0,
  captured_at timestamptz not null default now(),
  constraint klaviyo_segment_snapshots_unique_capture unique (segment_id, snapshot_date),
  constraint klaviyo_segment_snapshots_profile_count_check check (profile_count >= 0)
);

create table if not exists public.klaviyo_flows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_flow_id varchar(255) not null,
  name varchar(255) not null,
  status varchar(80),
  trigger_type varchar(180),
  archived boolean not null default false,
  definition_hash varchar(64),
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_flows_unique_external unique (account_id, external_flow_id)
);

create table if not exists public.klaviyo_flow_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  flow_id uuid not null references public.klaviyo_flows (id) on delete cascade,
  external_action_id varchar(255) not null,
  action_type varchar(120) not null,
  status varchar(80),
  position int,
  settings_data jsonb,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_flow_actions_unique_external unique (flow_id, external_action_id)
);

create table if not exists public.klaviyo_flow_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  flow_action_id uuid not null references public.klaviyo_flow_actions (id) on delete cascade,
  external_message_id varchar(255) not null,
  external_template_id varchar(255),
  channel varchar(50) not null,
  name varchar(255),
  subject varchar(500),
  preview_text text,
  from_email varchar(255),
  from_label varchar(255),
  reply_to_email varchar(255),
  status varchar(80),
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_flow_messages_unique_external unique (flow_action_id, external_message_id)
);

create table if not exists public.klaviyo_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_campaign_id varchar(255) not null,
  name varchar(255) not null,
  status varchar(80),
  archived boolean not null default false,
  primary_channel varchar(50),
  scheduled_at timestamptz,
  send_time timestamptz,
  send_strategy jsonb,
  send_options jsonb,
  tracking_options jsonb,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_campaigns_unique_external unique (account_id, external_campaign_id)
);

create table if not exists public.klaviyo_campaign_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null references public.klaviyo_campaigns (id) on delete cascade,
  external_message_id varchar(255) not null,
  external_template_id varchar(255),
  channel varchar(50) not null,
  name varchar(255),
  label varchar(255),
  subject varchar(500),
  preview_text text,
  from_email varchar(255),
  from_label varchar(255),
  reply_to_email varchar(255),
  status varchar(80),
  scheduled_at timestamptz,
  sent_at timestamptz,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_campaign_messages_unique_external unique (campaign_id, external_message_id)
);

create table if not exists public.klaviyo_campaign_audiences (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null references public.klaviyo_campaigns (id) on delete cascade,
  audience_type public.klaviyo_audience_type not null,
  audience_role public.klaviyo_audience_role not null default 'included',
  list_id uuid references public.klaviyo_lists (id) on delete cascade,
  segment_id uuid references public.klaviyo_segments (id) on delete cascade,
  external_audience_id varchar(255),
  priority int,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_campaign_audiences_target_check check (
    (audience_type = 'list' and list_id is not null and segment_id is null)
    or (audience_type = 'segment' and segment_id is not null and list_id is null)
  )
);

create table if not exists public.klaviyo_forms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_form_id varchar(255) not null,
  name varchar(255) not null,
  status varchar(80),
  has_ab_test boolean not null default false,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_forms_unique_external unique (account_id, external_form_id)
);

create table if not exists public.klaviyo_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  external_metric_id varchar(255) not null,
  name varchar(255) not null,
  external_integration_id varchar(255),
  integration_name varchar(180),
  integration_category varchar(120),
  is_conversion_candidate boolean not null default false,
  is_primary_conversion_metric boolean not null default false,
  external_created_at timestamptz,
  external_updated_at timestamptz,
  raw_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint klaviyo_metrics_unique_external unique (account_id, external_metric_id)
);

create unique index if not exists klaviyo_metrics_one_primary_conversion on public.klaviyo_metrics (account_id)
where is_primary_conversion_metric;

create table if not exists public.klaviyo_report_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  sync_run_id uuid references public.integration_sync_runs (id) on delete set null,
  report_type public.klaviyo_report_type not null,
  entity_type public.klaviyo_report_entity_type not null,
  conversion_metric_id uuid references public.klaviyo_metrics (id) on delete set null,
  statistics jsonb not null,
  timeframe_start timestamptz not null,
  timeframe_end timestamptz not null,
  interval varchar(50),
  channel varchar(50),
  filters jsonb,
  request_data jsonb,
  api_revision varchar(30) not null default '2026-04-15',
  status public.klaviyo_report_status not null default 'pending',
  error_code varchar(120),
  error_message text,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint klaviyo_report_runs_timeframe_check check (timeframe_end > timeframe_start)
);

create table if not exists public.klaviyo_report_values (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  report_run_id uuid not null references public.klaviyo_report_runs (id) on delete cascade,
  entity_type public.klaviyo_report_entity_type not null,
  external_entity_id varchar(255) not null,
  campaign_id uuid references public.klaviyo_campaigns (id) on delete cascade,
  campaign_message_id uuid references public.klaviyo_campaign_messages (id) on delete cascade,
  flow_id uuid references public.klaviyo_flows (id) on delete cascade,
  flow_message_id uuid references public.klaviyo_flow_messages (id) on delete cascade,
  form_id uuid references public.klaviyo_forms (id) on delete cascade,
  segment_id uuid references public.klaviyo_segments (id) on delete cascade,
  statistic_name varchar(180) not null,
  value_numeric numeric(20,6),
  value_json jsonb,
  period_start timestamptz not null,
  period_end timestamptz not null,
  interval varchar(50),
  channel varchar(50),
  dimensions jsonb,
  dimension_hash varchar(64) not null default 'none',
  raw_data jsonb,
  captured_at timestamptz not null default now(),
  constraint klaviyo_report_values_period_check check (period_end > period_start),
  constraint klaviyo_report_values_entity_target_check check (
    (entity_type = 'campaign' and campaign_id is not null and campaign_message_id is null and flow_id is null and flow_message_id is null and form_id is null and segment_id is null)
    or (entity_type = 'campaign_message' and campaign_message_id is not null and campaign_id is null and flow_id is null and flow_message_id is null and form_id is null and segment_id is null)
    or (entity_type = 'flow' and flow_id is not null and campaign_id is null and campaign_message_id is null and flow_message_id is null and form_id is null and segment_id is null)
    or (entity_type = 'flow_message' and flow_message_id is not null and campaign_id is null and campaign_message_id is null and flow_id is null and form_id is null and segment_id is null)
    or (entity_type = 'form' and form_id is not null and campaign_id is null and campaign_message_id is null and flow_id is null and flow_message_id is null and segment_id is null)
    or (entity_type = 'segment' and segment_id is not null and campaign_id is null and campaign_message_id is null and flow_id is null and flow_message_id is null and form_id is null)
  ),
  constraint klaviyo_report_values_unique_value unique (
    report_run_id, entity_type, external_entity_id, statistic_name,
    period_start, period_end, dimension_hash
  )
);

create table if not exists public.klaviyo_daily_account_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts (id) on delete cascade,
  conversion_metric_id uuid references public.klaviyo_metrics (id) on delete set null,
  metric_date date not null,
  channel varchar(50) not null default 'email',
  flow_attributed_revenue numeric(16,2) not null default 0,
  campaign_attributed_revenue numeric(16,2) not null default 0,
  total_attributed_revenue numeric(16,2) not null default 0,
  total_store_revenue numeric(16,2),
  attributed_revenue_percentage numeric(10,6),
  recipients bigint not null default 0,
  delivered bigint not null default 0,
  opens bigint not null default 0,
  clicks bigint not null default 0,
  conversions numeric(16,4) not null default 0,
  calculation_version varchar(50) not null,
  calculated_at timestamptz not null default now(),
  constraint klaviyo_daily_metrics_unique unique (account_id, metric_date, channel, conversion_metric_id),
  constraint klaviyo_daily_metrics_counts_check check (recipients >= 0 and delivered >= 0 and opens >= 0 and clicks >= 0)
);

create index if not exists klaviyo_accounts_organization_id_idx on public.klaviyo_accounts (organization_id);
create index if not exists klaviyo_lists_organization_id_idx on public.klaviyo_lists (organization_id);
create index if not exists klaviyo_lists_account_id_idx on public.klaviyo_lists (account_id);
create index if not exists klaviyo_list_snapshots_organization_id_idx on public.klaviyo_list_daily_snapshots (organization_id);
create index if not exists klaviyo_list_snapshots_date_idx on public.klaviyo_list_daily_snapshots (snapshot_date);
create index if not exists klaviyo_segments_organization_id_idx on public.klaviyo_segments (organization_id);
create index if not exists klaviyo_segments_account_id_idx on public.klaviyo_segments (account_id);
create index if not exists klaviyo_segment_snapshots_organization_id_idx on public.klaviyo_segment_daily_snapshots (organization_id);
create index if not exists klaviyo_segment_snapshots_date_idx on public.klaviyo_segment_daily_snapshots (snapshot_date);
create index if not exists klaviyo_flows_organization_id_idx on public.klaviyo_flows (organization_id);
create index if not exists klaviyo_flows_account_id_idx on public.klaviyo_flows (account_id);
create index if not exists klaviyo_flow_actions_organization_id_idx on public.klaviyo_flow_actions (organization_id);
create index if not exists klaviyo_flow_actions_flow_id_idx on public.klaviyo_flow_actions (flow_id);
create index if not exists klaviyo_flow_messages_organization_id_idx on public.klaviyo_flow_messages (organization_id);
create index if not exists klaviyo_flow_messages_flow_action_id_idx on public.klaviyo_flow_messages (flow_action_id);
create index if not exists klaviyo_campaigns_organization_id_idx on public.klaviyo_campaigns (organization_id);
create index if not exists klaviyo_campaigns_account_id_idx on public.klaviyo_campaigns (account_id);
create index if not exists klaviyo_campaign_messages_organization_id_idx on public.klaviyo_campaign_messages (organization_id);
create index if not exists klaviyo_campaign_messages_campaign_id_idx on public.klaviyo_campaign_messages (campaign_id);
create index if not exists klaviyo_campaign_audiences_organization_id_idx on public.klaviyo_campaign_audiences (organization_id);
create index if not exists klaviyo_campaign_audiences_campaign_id_idx on public.klaviyo_campaign_audiences (campaign_id);
create index if not exists klaviyo_forms_organization_id_idx on public.klaviyo_forms (organization_id);
create index if not exists klaviyo_forms_account_id_idx on public.klaviyo_forms (account_id);
create index if not exists klaviyo_report_runs_organization_id_idx on public.klaviyo_report_runs (organization_id);
create index if not exists klaviyo_report_runs_account_id_idx on public.klaviyo_report_runs (account_id);
create index if not exists klaviyo_report_runs_sync_run_id_idx on public.klaviyo_report_runs (sync_run_id);
create index if not exists klaviyo_report_values_organization_id_idx on public.klaviyo_report_values (organization_id);
create index if not exists klaviyo_report_values_report_run_id_idx on public.klaviyo_report_values (report_run_id);
create index if not exists klaviyo_report_values_entity_idx on public.klaviyo_report_values (entity_type, external_entity_id);
create index if not exists klaviyo_metrics_organization_id_idx on public.klaviyo_metrics (organization_id);
create index if not exists klaviyo_metrics_account_id_idx on public.klaviyo_metrics (account_id);
create index if not exists klaviyo_daily_metrics_organization_id_idx on public.klaviyo_daily_account_metrics (organization_id);
create index if not exists klaviyo_daily_metrics_account_date_idx on public.klaviyo_daily_account_metrics (account_id, metric_date);

drop trigger if exists set_klaviyo_accounts_updated_at on public.klaviyo_accounts;
create trigger set_klaviyo_accounts_updated_at before update on public.klaviyo_accounts for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_lists_updated_at on public.klaviyo_lists;
create trigger set_klaviyo_lists_updated_at before update on public.klaviyo_lists for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_segments_updated_at on public.klaviyo_segments;
create trigger set_klaviyo_segments_updated_at before update on public.klaviyo_segments for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_flows_updated_at on public.klaviyo_flows;
create trigger set_klaviyo_flows_updated_at before update on public.klaviyo_flows for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_flow_actions_updated_at on public.klaviyo_flow_actions;
create trigger set_klaviyo_flow_actions_updated_at before update on public.klaviyo_flow_actions for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_flow_messages_updated_at on public.klaviyo_flow_messages;
create trigger set_klaviyo_flow_messages_updated_at before update on public.klaviyo_flow_messages for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_campaigns_updated_at on public.klaviyo_campaigns;
create trigger set_klaviyo_campaigns_updated_at before update on public.klaviyo_campaigns for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_campaign_messages_updated_at on public.klaviyo_campaign_messages;
create trigger set_klaviyo_campaign_messages_updated_at before update on public.klaviyo_campaign_messages for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_campaign_audiences_updated_at on public.klaviyo_campaign_audiences;
create trigger set_klaviyo_campaign_audiences_updated_at before update on public.klaviyo_campaign_audiences for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_forms_updated_at on public.klaviyo_forms;
create trigger set_klaviyo_forms_updated_at before update on public.klaviyo_forms for each row execute function private.set_updated_at();
drop trigger if exists set_klaviyo_metrics_updated_at on public.klaviyo_metrics;
create trigger set_klaviyo_metrics_updated_at before update on public.klaviyo_metrics for each row execute function private.set_updated_at();

alter table public.klaviyo_accounts enable row level security;
alter table public.klaviyo_lists enable row level security;
alter table public.klaviyo_list_daily_snapshots enable row level security;
alter table public.klaviyo_segments enable row level security;
alter table public.klaviyo_segment_daily_snapshots enable row level security;
alter table public.klaviyo_flows enable row level security;
alter table public.klaviyo_flow_actions enable row level security;
alter table public.klaviyo_flow_messages enable row level security;
alter table public.klaviyo_campaigns enable row level security;
alter table public.klaviyo_campaign_messages enable row level security;
alter table public.klaviyo_campaign_audiences enable row level security;
alter table public.klaviyo_forms enable row level security;
alter table public.klaviyo_report_runs enable row level security;
alter table public.klaviyo_report_values enable row level security;
alter table public.klaviyo_metrics enable row level security;
alter table public.klaviyo_daily_account_metrics enable row level security;

drop policy if exists "klaviyo_accounts_select_authorized" on public.klaviyo_accounts;
create policy "klaviyo_accounts_select_authorized" on public.klaviyo_accounts for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_lists_select_authorized" on public.klaviyo_lists;
create policy "klaviyo_lists_select_authorized" on public.klaviyo_lists for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_list_daily_snapshots_select_authorized" on public.klaviyo_list_daily_snapshots;
create policy "klaviyo_list_daily_snapshots_select_authorized" on public.klaviyo_list_daily_snapshots for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_segments_select_authorized" on public.klaviyo_segments;
create policy "klaviyo_segments_select_authorized" on public.klaviyo_segments for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_segment_daily_snapshots_select_authorized" on public.klaviyo_segment_daily_snapshots;
create policy "klaviyo_segment_daily_snapshots_select_authorized" on public.klaviyo_segment_daily_snapshots for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_flows_select_authorized" on public.klaviyo_flows;
create policy "klaviyo_flows_select_authorized" on public.klaviyo_flows for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_flow_actions_select_authorized" on public.klaviyo_flow_actions;
create policy "klaviyo_flow_actions_select_authorized" on public.klaviyo_flow_actions for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_flow_messages_select_authorized" on public.klaviyo_flow_messages;
create policy "klaviyo_flow_messages_select_authorized" on public.klaviyo_flow_messages for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_campaigns_select_authorized" on public.klaviyo_campaigns;
create policy "klaviyo_campaigns_select_authorized" on public.klaviyo_campaigns for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_campaign_messages_select_authorized" on public.klaviyo_campaign_messages;
create policy "klaviyo_campaign_messages_select_authorized" on public.klaviyo_campaign_messages for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_campaign_audiences_select_authorized" on public.klaviyo_campaign_audiences;
create policy "klaviyo_campaign_audiences_select_authorized" on public.klaviyo_campaign_audiences for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_forms_select_authorized" on public.klaviyo_forms;
create policy "klaviyo_forms_select_authorized" on public.klaviyo_forms for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_report_runs_select_authorized" on public.klaviyo_report_runs;
create policy "klaviyo_report_runs_select_authorized" on public.klaviyo_report_runs for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_report_values_select_authorized" on public.klaviyo_report_values;
create policy "klaviyo_report_values_select_authorized" on public.klaviyo_report_values for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "klaviyo_metrics_select_authorized" on public.klaviyo_metrics;
create policy "klaviyo_metrics_select_authorized" on public.klaviyo_metrics for select to authenticated using (private.can_access_org(organization_id));
-- Se sueltan los dos nombres: el `drop` decia `klaviyo_daily_metrics_...` y el
-- `create` de debajo `klaviyo_daily_account_metrics_...`, asi que reaplicar la
-- migracion fallaba por politica ya existente. Una base que se creo con el
-- nombre viejo tampoco debe quedarse con las dos.
drop policy if exists "klaviyo_daily_metrics_select_authorized" on public.klaviyo_daily_account_metrics;
drop policy if exists "klaviyo_daily_account_metrics_select_authorized" on public.klaviyo_daily_account_metrics;
create policy "klaviyo_daily_account_metrics_select_authorized" on public.klaviyo_daily_account_metrics for select to authenticated using (private.can_access_org(organization_id));

grant select on public.klaviyo_accounts, public.klaviyo_lists, public.klaviyo_list_daily_snapshots,
  public.klaviyo_segments, public.klaviyo_segment_daily_snapshots, public.klaviyo_flows,
  public.klaviyo_flow_actions, public.klaviyo_flow_messages, public.klaviyo_campaigns,
  public.klaviyo_campaign_messages, public.klaviyo_campaign_audiences, public.klaviyo_forms,
  public.klaviyo_report_runs, public.klaviyo_report_values, public.klaviyo_metrics,
  public.klaviyo_daily_account_metrics to authenticated;

comment on table public.klaviyo_accounts is 'Cuenta Klaviyo descubierta tras OAuth; los tokens viven en private.integration_credentials.';
comment on table public.klaviyo_lists is 'Listas agregadas de Klaviyo; no almacena miembros ni perfiles.';
comment on table public.klaviyo_segments is 'Segmentos agregados de Klaviyo; no almacena miembros ni perfiles.';
comment on table public.klaviyo_flows is 'Flows sincronizados desde Klaviyo.';
comment on table public.klaviyo_campaigns is 'Campañas sincronizadas desde Klaviyo.';
comment on table public.klaviyo_report_runs is 'Auditoría de consultas de Reporting API y Metric Aggregates.';
comment on table public.klaviyo_report_values is 'Valores normalizados de reporting con una entidad objetivo inequívoca.';
comment on table public.klaviyo_daily_account_metrics is 'Métricas agregadas diarias calculadas con Klaviyo y revenue de Shopify.';

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  klaviyo_campaign_id uuid references public.klaviyo_campaigns (id) on delete set null,
  name varchar(255) not null,
  channel varchar(50) not null default 'email',
  campaign_month date,
  reason varchar(255),
  offer_description text,
  planned_send_at timestamptz,
  actual_send_at timestamptz,
  status varchar(40) not null default 'draft',
  expected_revenue numeric(14,2),
  actual_revenue numeric(14,2),
  internal_notes text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketing_campaigns_status_check check (status in ('draft', 'planned', 'approved', 'published', 'cancelled'))
);

create table if not exists public.marketing_campaign_products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid not null references public.marketing_campaigns (id) on delete cascade,
  product_id uuid,
  variant_id uuid,
  expected_units int,
  required_stock int,
  created_at timestamptz not null default now(),
  constraint marketing_campaign_products_units_check check (expected_units is null or expected_units >= 0)
);

create index if not exists marketing_campaigns_organization_id_idx on public.marketing_campaigns (organization_id);
create index if not exists marketing_campaigns_campaign_month_idx on public.marketing_campaigns (campaign_month);
create index if not exists marketing_campaign_products_organization_id_idx on public.marketing_campaign_products (organization_id);
create index if not exists marketing_campaign_products_campaign_id_idx on public.marketing_campaign_products (campaign_id);

drop trigger if exists set_marketing_campaigns_updated_at on public.marketing_campaigns;
create trigger set_marketing_campaigns_updated_at before update on public.marketing_campaigns for each row execute function private.set_updated_at();

alter table public.marketing_campaigns enable row level security;
alter table public.marketing_campaign_products enable row level security;

drop policy if exists "marketing_campaigns_select_authorized" on public.marketing_campaigns;
create policy "marketing_campaigns_select_authorized" on public.marketing_campaigns for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "marketing_campaigns_write_managers" on public.marketing_campaigns;
create policy "marketing_campaigns_write_managers" on public.marketing_campaigns for all to authenticated using (private.can_manage_org(organization_id)) with check (private.can_manage_org(organization_id));
drop policy if exists "marketing_campaign_products_select_authorized" on public.marketing_campaign_products;
create policy "marketing_campaign_products_select_authorized" on public.marketing_campaign_products for select to authenticated using (private.can_access_org(organization_id));
drop policy if exists "marketing_campaign_products_write_managers" on public.marketing_campaign_products;
create policy "marketing_campaign_products_write_managers" on public.marketing_campaign_products for all to authenticated using (private.can_manage_org(organization_id)) with check (private.can_manage_org(organization_id));

grant select on public.marketing_campaigns, public.marketing_campaign_products to authenticated;
