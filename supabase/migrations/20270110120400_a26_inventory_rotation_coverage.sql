alter table public.a26_content_run_claims add column if not exists inventory_cursor uuid;
create or replace function public.a26_email_inventory_item(
  p_organization_id uuid,p_store_id uuid,p_message_id uuid
) returns jsonb language plpgsql stable security invoker set search_path='' as $function$
declare result jsonb;
begin
  if p_store_id is null then raise exception 'A26_STORE_REQUIRED'; end if;
  with accounts as (
    select k.* from public.klaviyo_accounts k join public.integration_connections c on c.id=k.connection_id
    join public.shopify_stores s on s.id=k.store_id and s.organization_id=k.organization_id and s.is_active
    where k.organization_id=p_organization_id and k.store_id=p_store_id
      and c.organization_id=p_organization_id and c.provider='klaviyo'
      and c.status in ('connected','syncing') and c.deletion_requested_at is null
  ), messages as (
    select 'flow' as source, f.id as parent_id,f.name::text as parent_name,f.status::text as parent_status,
      f.account_id,f.trigger_type::text as trigger_type,null::timestamptz as send_time,
      m.id as message_id,m.external_message_id::text,m.subject::text,m.preview_text,
      m.external_template_id::text,m.channel::text,m.status::text as message_status,
      m.raw_data,m.last_synced_at,a.external_action_id::text as action_id,
      a.status::text as action_status,a.position::bigint as position_in_parent
    from public.klaviyo_flow_messages m join public.klaviyo_flows f on f.id=m.flow_id
    join accounts k on k.id=f.account_id left join public.klaviyo_flow_actions a on a.id=m.action_id
    where m.id=p_message_id and m.organization_id=p_organization_id and f.organization_id=p_organization_id
    union all
    select 'campaign',c.id,c.name::text,c.status::text,c.account_id,null::text,
      coalesce(m.sent_at,c.send_time),m.id,m.external_message_id::text,m.subject::text,m.preview_text,
      m.external_template_id::text,m.channel::text,m.status::text,m.raw_data,m.last_synced_at,null::text,null::text,null::bigint
    from public.klaviyo_campaign_messages m join public.klaviyo_campaigns c on c.id=m.campaign_id
    join accounts k on k.id=c.account_id
    where m.id=p_message_id and m.organization_id=p_organization_id and c.organization_id=p_organization_id
  ), enriched as (
    select m.message_id,to_jsonb(m)-'raw_data' || jsonb_build_object(
      'template_name',t.name,'body_chars',length(t.html_content),
      'template_observed_at',t.last_synced_at,
      'adds_utm',case lower(m.raw_data->>'add_tracking_params') when 'true' then true when 'false' then false else null end,
      'sequence_order_verified',false,
      'source_revision',md5(((to_jsonb(m)-'last_synced_at')||jsonb_build_object('html',t.html_content,'text',t.text_content))::text)
    ) as row_data
    from messages m left join public.klaviyo_templates t on t.account_id=m.account_id
      and t.external_template_id=m.external_template_id and t.organization_id=p_organization_id
  ), page as (
    select * from enriched where message_id=p_message_id
    order by message_id limit 1
  )
  select jsonb_build_object('rows',coalesce((select jsonb_agg(row_data order by message_id) from page),'[]'::jsonb),
    'total_count',(select count(*) from enriched),
    'next_cursor',case when exists(select 1 from enriched where message_id>(select max(message_id::text)::uuid from page))
      then (select max(message_id::text) from page) else null end)
  into result;
  return result;
end;
$function$;
revoke all on function public.a26_email_inventory_item(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.a26_email_inventory_item(uuid,uuid,uuid) to service_role;



notify pgrst,'reload schema';
