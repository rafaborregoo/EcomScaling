-- Preserve each stable Campaign Values report breakdown separately. Klaviyo's
-- variation and variation_name groupings are stable; variation content itself
-- is still sourced separately and may require beta endpoints.

alter table public.klaviyo_report_values
  add column if not exists external_message_id varchar(255) not null default '',
  add column if not exists variation_id varchar(255) not null default '',
  add column if not exists variation_name varchar(255) not null default '';

-- Both historical uniqueness schemes predate the flat reporting contract. The
-- flat contract index is the active PostgREST upsert target; replace both so
-- A/B rows cannot overwrite each other or collide with the normalized key.
alter table public.klaviyo_report_values
  drop constraint if exists klaviyo_report_values_unique_value;

drop index if exists public.klaviyo_report_values_code_contract_uidx;

create unique index if not exists klaviyo_report_values_code_contract_uidx
  on public.klaviyo_report_values (
    report_run_id,
    entity_type,
    external_entity_id,
    metric_id,
    period_start,
    period_end,
    external_message_id,
    variation_id,
    variation_name
  );

create index if not exists klaviyo_report_values_variation_lookup_idx
  on public.klaviyo_report_values (organization_id, period_start desc, report_run_id)
  where entity_type = 'campaign' and variation_id <> '';

comment on column public.klaviyo_report_values.variation_id is
  'Klaviyo stable reporting grouping variation; empty string means report was not split by variation.';
comment on column public.klaviyo_report_values.variation_name is
  'Klaviyo stable reporting grouping variation_name; does not imply the stored campaign body is that variant.';
comment on column public.klaviyo_report_values.external_message_id is
  'Klaviyo campaign-message grouping from Reporting API; kept separately to prevent same-campaign messages from colliding.';

-- The general email KPI report remains campaign/flow level. It must not pick
-- one arbitrary variant row as the representative value for the whole email.
drop function if exists public.klaviyo_email_report(uuid, date, date, uuid);

create or replace function public.klaviyo_email_report(
  target_organization_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns table(
  bucket_month date, entity_type text, entity_id uuid, entity_name text,
  subject text, send_time timestamp with time zone, trigger_type text,
  revenue numeric, conversions numeric, recipients numeric, delivered numeric,
  opens_unique numeric, clicks_unique numeric, unsubscribes numeric,
  bounced numeric, spam_complaints numeric
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select distinct on (
      date_trunc('month', rv.period_start),
      rv.entity_type,
      coalesce(c.id::text, f.id::text, rv.external_entity_id)
    )
    date_trunc('month', rv.period_start)::date as bucket_month,
    rv.entity_type::text,
    coalesce(c.id, f.id) as entity_id,
    coalesce(c.name, f.name, rv.entity_name) as entity_name,
    cm.subject,
    c.send_time,
    f.trigger_type,
    coalesce(rv.revenue, nullif(rv.raw_data->'statistics'->>'conversion_value', '')::numeric, 0) as revenue,
    coalesce(rv.conversions, nullif(rv.raw_data->'statistics'->>'conversion_uniques', '')::numeric, 0) as conversions,
    coalesce(nullif(rv.raw_data->'statistics'->>'recipients', '')::numeric, 0) as recipients,
    coalesce(nullif(rv.raw_data->'statistics'->>'delivered', '')::numeric, 0) as delivered,
    coalesce(nullif(rv.raw_data->'statistics'->>'opens_unique', '')::numeric, 0) as opens_unique,
    coalesce(nullif(rv.raw_data->'statistics'->>'clicks_unique', '')::numeric, 0) as clicks_unique,
    coalesce(nullif(rv.raw_data->'statistics'->>'unsubscribes', '')::numeric, 0) as unsubscribes,
    coalesce(nullif(rv.raw_data->'statistics'->>'bounced', '')::numeric, 0) as bounced,
    coalesce(nullif(rv.raw_data->'statistics'->>'spam_complaints', '')::numeric, 0) as spam_complaints
  from public.klaviyo_report_values rv
  left join public.klaviyo_campaigns c
    on rv.entity_type = 'campaign'
   and c.organization_id = rv.organization_id
   and c.external_campaign_id = rv.external_entity_id
  left join public.klaviyo_flows f
    on rv.entity_type = 'flow'
   and f.organization_id = rv.organization_id
   and f.external_flow_id = rv.external_entity_id
  left join lateral (
    select coalesce(
             m.raw_data->'definition'->'content'->>'subject',
             m.raw_data->'content'->>'subject'
           ) as subject
    from public.klaviyo_campaign_messages m
    where m.campaign_id = c.id
    order by (m.channel = 'email') desc nulls last
    limit 1
  ) cm on true
  where rv.organization_id = target_organization_id
    and rv.entity_type in ('campaign', 'flow')
    and rv.variation_id = ''
    and rv.period_start >= period_start
    and rv.period_start < (period_end + 1)
    and (target_store_id is null or exists (
      select 1
      from public.klaviyo_report_runs rr
      join public.klaviyo_accounts ka on ka.id = rr.account_id
      where rr.id = rv.report_run_id
        and ka.store_id = target_store_id
    ))
  order by
    date_trunc('month', rv.period_start),
    rv.entity_type,
    coalesce(c.id::text, f.id::text, rv.external_entity_id),
    (rv.period_end - rv.period_start) desc,
    rv.created_at desc;
$function$;

revoke all on function public.klaviyo_email_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.klaviyo_email_report(uuid, date, date, uuid) to authenticated;
grant execute on function public.klaviyo_email_report(uuid, date, date, uuid) to service_role;

-- A26 uses this read-only, store-scoped projection to relate stable A/B
-- performance rows to the exact message IDs present in its content inventory.
drop function if exists public.klaviyo_email_variation_report(uuid, date, date, uuid);

create or replace function public.klaviyo_email_variation_report(
  target_organization_id uuid,
  target_period_start date,
  target_period_end date,
  target_store_id uuid default null
)
returns table (
  account_id uuid,
  campaign_id text,
  campaign_message_id text,
  variation_id text,
  variation_name text,
  period_start date,
  period_end date,
  statistics jsonb,
  total_count bigint
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select
    ka.id,
    coalesce(rv.external_entity_id, ''),
    nullif(rv.external_message_id, ''),
    rv.variation_id,
    rv.variation_name,
    rv.period_start,
    rv.period_end,
    coalesce(rv.raw_data->'statistics', '{}'::jsonb),
    count(*) over ()
  from public.klaviyo_report_values rv
  join public.klaviyo_report_runs rr on rr.id = rv.report_run_id
  join public.klaviyo_accounts ka on ka.id = rr.account_id
  where rv.organization_id = target_organization_id
    and rv.entity_type = 'campaign'
    and rv.variation_id <> ''
    and rv.period_start >= target_period_start
    and rv.period_start < (target_period_end + 1)
    and (target_store_id is null or ka.store_id = target_store_id)
  order by rv.period_end desc, rv.period_start desc, rv.created_at desc
  limit 250;
$function$;

revoke all on function public.klaviyo_email_variation_report(uuid, date, date, uuid) from public, anon;
grant execute on function public.klaviyo_email_variation_report(uuid, date, date, uuid) to service_role;

comment on function public.klaviyo_email_variation_report is
  'Bounded, store-scoped A/B metric rows from stable Klaviyo Reporting API groupings. It reports measurements only and does not assert which HTML was delivered.';
