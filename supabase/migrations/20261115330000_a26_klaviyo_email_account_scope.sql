-- A26/A12 inventory must identify the Klaviyo account, not just the org.
-- Klaviyo external template IDs are unique per account; joining by organization
-- can attach a different store's HTML when two accounts reuse the same ID.
drop function if exists public.klaviyo_email_inventory(uuid, uuid);

create function public.klaviyo_email_inventory(
  target_organization_id uuid,
  target_store_id uuid default null
)
returns table (
  source text,
  parent_id uuid,
  parent_name text,
  parent_status text,
  account_id uuid,
  trigger_type text,
  send_time timestamptz,
  message_id uuid,
  external_message_id text,
  position_in_parent bigint,
  subject text,
  preview_text text,
  external_template_id text,
  template_name text,
  body_chars integer,
  tracks_opens boolean,
  tracks_clicks boolean,
  adds_utm boolean,
  custom_utm_params integer
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  select
    'flow'::text,
    f.id,
    f.name::text,
    f.status::text,
    f.account_id,
    f.trigger_type::text,
    null::timestamptz,
    m.id,
    m.external_message_id::text,
    row_number() over (
      partition by f.id
      order by a.external_created_at nulls last, a.external_action_id
    ),
    m.subject::text,
    m.preview_text,
    m.external_template_id::text,
    t.name::text,
    length(t.html_content),
    null::boolean,
    null::boolean,
    coalesce((m.raw_data->>'add_tracking_params')::boolean, false),
    coalesce(jsonb_array_length(
      case when jsonb_typeof(m.raw_data->'custom_tracking_params') = 'array'
        then m.raw_data->'custom_tracking_params' else '[]'::jsonb end
    ), 0)
  from public.klaviyo_flow_messages m
  join public.klaviyo_flows f on f.id = m.flow_id
  left join public.klaviyo_flow_actions a on a.id = m.action_id
  left join public.klaviyo_templates t
    on t.account_id = f.account_id
   and t.external_template_id = m.external_template_id
  where m.organization_id = target_organization_id
    and (target_store_id is null or exists (
      select 1 from public.klaviyo_accounts ka
      where ka.id = f.account_id
        and ka.organization_id = target_organization_id
        and ka.store_id = target_store_id
    ))

  union all

  select
    'campaign'::text,
    c.id,
    c.name::text,
    c.status::text,
    c.account_id,
    null::text,
    c.send_time,
    m.id,
    m.external_message_id::text,
    row_number() over (partition by c.id order by m.external_message_id),
    m.subject::text,
    m.preview_text,
    m.external_template_id::text,
    t.name::text,
    length(t.html_content),
    (c.raw_data->'tracking_options'->>'is_tracking_opens')::boolean,
    (c.raw_data->'tracking_options'->>'is_tracking_clicks')::boolean,
    coalesce((c.raw_data->'tracking_options'->>'add_tracking_params')::boolean, false),
    coalesce(jsonb_array_length(
      case when jsonb_typeof(c.raw_data->'tracking_options'->'custom_tracking_params') = 'array'
        then c.raw_data->'tracking_options'->'custom_tracking_params'
        else '[]'::jsonb end
    ), 0)
  from public.klaviyo_campaign_messages m
  join public.klaviyo_campaigns c on c.id = m.campaign_id
  left join public.klaviyo_templates t
    on t.account_id = c.account_id
   and t.external_template_id = m.external_template_id
  where m.organization_id = target_organization_id
    and (m.channel is null or m.channel = 'email')
    and (target_store_id is null or exists (
      select 1 from public.klaviyo_accounts ka
      where ka.id = c.account_id
        and ka.organization_id = target_organization_id
        and ka.store_id = target_store_id
    ));
$function$;

revoke all on function public.klaviyo_email_inventory(uuid, uuid) from public, anon;
grant execute on function public.klaviyo_email_inventory(uuid, uuid) to authenticated;
grant execute on function public.klaviyo_email_inventory(uuid, uuid) to service_role;

comment on function public.klaviyo_email_inventory is
  'Klaviyo email inventory scoped by organization/store and including account_id so content is joined to the exact account; NULL store means the organization aggregate.';
