-- Bounded, read-only drill-down for a single Meta ad. Results intentionally
-- separate ad-level performance from time-scoped creative assignments/assets.
create or replace function public.meta_creative_diagnostics(
  target_organization_id uuid,
  target_ad_id uuid,
  period_start date,
  period_end date,
  target_store_id uuid default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  ad_row record;
  assignment_count integer := 0;
  single_assignment record;
  creative_rows jsonb := '[]'::jsonb;
  asset_rows jsonb := '[]'::jsonb;
  asset_count_total integer := 0;
  performance_row jsonb;
  attribution_status text;
begin
  if target_organization_id is null or target_ad_id is null
     or period_start is null or period_end is null
     or period_end < period_start
     or period_end - period_start > 90
     or period_end > current_date then
    raise exception 'invalid_meta_creative_diagnostics_input';
  end if;

  select
    d.id,
    d.name,
    d.effective_status,
    d.current_creative_id,
    s.id as ad_set_id,
    s.name as ad_set_name,
    s.is_dynamic_creative,
    c.id as campaign_id,
    c.name as campaign_name,
    c.objective,
    a.id as ad_account_id,
    a.account_name,
    a.store_id
  into ad_row
  from public.meta_ads d
  join public.meta_ad_sets s on s.id = d.ad_set_id
  join public.meta_campaigns c on c.id = s.campaign_id
  join public.meta_ad_accounts a on a.id = c.ad_account_id
  where d.id = target_ad_id
    and d.organization_id = target_organization_id
    and (target_store_id is null or a.store_id = target_store_id);

  if not found then
    return jsonb_build_object('status', 'not_found_or_out_of_scope');
  end if;

  select count(*)::integer
  into assignment_count
  from public.meta_ad_creative_assignments x
  where x.organization_id = target_organization_id
    and x.ad_id = target_ad_id
    and x.valid_from < (period_end + 1)::timestamptz
    and (x.valid_until is null or x.valid_until > period_start::timestamptz);

  select x.creative_id, x.valid_from, x.valid_until
  into single_assignment
  from public.meta_ad_creative_assignments x
  where x.organization_id = target_organization_id
    and x.ad_id = target_ad_id
    and x.valid_from < (period_end + 1)::timestamptz
    and (x.valid_until is null or x.valid_until > period_start::timestamptz)
  order by x.valid_from
  limit 1;

  attribution_status := case
    when assignment_count = 0 then 'current_snapshot_only'
    when assignment_count > 1 then 'multiple_creatives_in_period'
    when single_assignment.valid_from > period_start::timestamptz
      or (single_assignment.valid_until is not null
        and single_assignment.valid_until < (period_end + 1)::timestamptz)
      then 'assignment_does_not_cover_full_period'
    else 'single_creative_covers_period'
  end;

  select count(*)::integer
  into asset_count_total
  from public.meta_creative_assets ca
  where ca.organization_id = target_organization_id
    and ca.creative_id in (
      select x.creative_id
      from public.meta_ad_creative_assignments x
      where x.organization_id = target_organization_id
        and x.ad_id = target_ad_id
        and x.valid_from < (period_end + 1)::timestamptz
        and (x.valid_until is null or x.valid_until > period_start::timestamptz)
      union
      select ad_row.current_creative_id
      where ad_row.current_creative_id is not null
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'creative_id', x.creative_id,
    'creative_name', cr.name,
    'valid_from', x.valid_from,
    'valid_until', x.valid_until,
    'call_to_action_type', cr.call_to_action_type,
    'primary_text', left(cr.primary_text, 1200),
    'headline', left(cr.headline, 500),
    'description', left(cr.description, 800),
    'object_type', cr.object_type,
    'link_host', case when cr.link_url ~* '^https?://[^/@?#]+(/|$)' then lower(split_part(split_part(regexp_replace(cr.link_url, '^https?://', '', 'i'), '/', 1), '?', 1)) else null end,
    'asset_feed_spec_present', cr.asset_feed_spec is not null,
    'dynamic_creative', ad_row.is_dynamic_creative
  ) order by x.valid_from), '[]'::jsonb)
  into creative_rows
  from public.meta_ad_creative_assignments x
  join public.meta_creatives cr
    on cr.id = x.creative_id and cr.organization_id = target_organization_id
  where x.organization_id = target_organization_id
    and x.ad_id = target_ad_id
    and x.valid_from < (period_end + 1)::timestamptz
    and (x.valid_until is null or x.valid_until > period_start::timestamptz);

  if assignment_count = 0 and ad_row.current_creative_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'creative_id', cr.id,
      'creative_name', cr.name,
      'valid_from', null,
      'valid_until', null,
      'call_to_action_type', cr.call_to_action_type,
      'primary_text', left(cr.primary_text, 1200),
      'headline', left(cr.headline, 500),
      'description', left(cr.description, 800),
      'object_type', cr.object_type,
      'link_host', case when cr.link_url ~* '^https?://[^/@?#]+(/|$)' then lower(split_part(split_part(regexp_replace(cr.link_url, '^https?://', '', 'i'), '/', 1), '?', 1)) else null end,
      'asset_feed_spec_present', cr.asset_feed_spec is not null,
      'dynamic_creative', ad_row.is_dynamic_creative
    )), '[]'::jsonb)
    into creative_rows
    from public.meta_creatives cr
    where cr.id = ad_row.current_creative_id
      and cr.organization_id = target_organization_id;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'creative_id', x.creative_id,
    'asset_type', x.asset_type,
    'position', x.position,
    'asset_label', x.asset_label,
    'is_primary', x.is_primary,
    'text_value', left(x.text_value, 600),
    'media_available', x.media_url is not null or x.thumbnail_url is not null,
    'destination_available', x.link_url is not null
  ) order by x.creative_id, x.position, x.asset_type), '[]'::jsonb)
  into asset_rows
  from (
    select ca.creative_id, ca.asset_type, ca.position, ca.asset_label,
           ca.is_primary, ca.text_value, ca.media_url, ca.thumbnail_url, ca.link_url
    from public.meta_creative_assets ca
    where ca.organization_id = target_organization_id
      and ca.creative_id in (
        select x.creative_id
        from public.meta_ad_creative_assignments x
        where x.organization_id = target_organization_id
          and x.ad_id = target_ad_id
          and x.valid_from < (period_end + 1)::timestamptz
          and (x.valid_until is null or x.valid_until > period_start::timestamptz)
        union
        select ad_row.current_creative_id
        where ad_row.current_creative_id is not null
      )
    order by ca.creative_id, ca.position, ca.asset_type
    limit 50
  ) x;

  select to_jsonb(p)
  into performance_row
  from public.meta_creative_performance(
    target_organization_id,
    period_start,
    period_end,
    target_store_id,
    1000
  ) p
  where p.ad_id = target_ad_id
  limit 1;

  return jsonb_build_object(
    'status', 'available',
    'identity', jsonb_build_object(
      'ad_id', ad_row.id,
      'ad_name', ad_row.name,
      'effective_status', ad_row.effective_status,
      'ad_set_id', ad_row.ad_set_id,
      'ad_set_name', ad_row.ad_set_name,
      'campaign_id', ad_row.campaign_id,
      'campaign_name', ad_row.campaign_name,
      'objective', ad_row.objective,
      'ad_account_id', ad_row.ad_account_id,
      'account_name', ad_row.account_name,
      'store_id', ad_row.store_id,
      'is_dynamic_creative', ad_row.is_dynamic_creative
    ),
    'period', jsonb_build_object('start', period_start, 'end', period_end),
    'performance_grain', 'ad_period',
    'performance', performance_row,
    'assignment_count', assignment_count,
    'creative_attribution_status', attribution_status,
    'creative_performance_attributed', attribution_status = 'single_creative_covers_period',
    'creatives', creative_rows,
    'assets', asset_rows,
    'assets_capped_at', 50,
    'assets_total', asset_count_total,
    'assets_truncated', asset_count_total > 50
  );
end;
$$;

comment on function public.meta_creative_diagnostics(uuid, uuid, date, date, uuid) is
  'Read-only scoped Meta ad drill-down. Performance stays at ad-period grain; creative/assets are not credited unless one timestamped assignment covers the full period.';

revoke all on function public.meta_creative_diagnostics(uuid, uuid, date, date, uuid) from public, anon, authenticated;
grant execute on function public.meta_creative_diagnostics(uuid, uuid, date, date, uuid) to service_role;
