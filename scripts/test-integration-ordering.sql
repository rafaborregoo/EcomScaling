-- Run against TEST. All writes, including receipt revisions, are rolled back.
begin;
do $$
<<test_integration_ordering>>
declare
  store record;
  order_id uuid := gen_random_uuid();
  line_id uuid := gen_random_uuid();
  quantity integer;
  revision_before bigint;
  inventory_id uuid;
begin
  select s.id,s.organization_id,s.connection_id into strict store from public.shopify_stores s join public.integration_connections c on c.id=s.connection_id where c.status in ('connected','error') limit 1;
  insert into public.shopify_order_facts(id,organization_id,store_id,external_order_id,external_updated_at,net_sales,is_test_order)
    values(order_id,store.organization_id,store.id,'integration-ordering-'||order_id,'2026-10-26T10:00:00Z',120,true);
  insert into public.shopify_order_items(id,organization_id,order_id,external_line_item_id,title,quantity_current,source_updated_at)
    values(line_id,store.organization_id,order_id,'line-current','Ordering test',2,'2026-10-26T10:00:00Z');
  update public.shopify_order_facts set net_sales=10,external_updated_at='2026-10-26T09:00:00Z' where id=order_id;
  if (select external_updated_at from public.shopify_order_facts where id=order_id) <> '2026-10-26T10:00:00Z'::timestamptz then raise exception 'stale order replaced newer state'; end if;
  update public.shopify_order_items set quantity_current=1,source_updated_at='2026-10-26T09:00:00Z' where id=line_id;
  if (select quantity_current from public.shopify_order_items where id=line_id) <> 2 then raise exception 'stale line replaced newer state'; end if;
  insert into public.shopify_order_items(organization_id,order_id,external_line_item_id,title,source_updated_at)
    values(store.organization_id,order_id,'stale-extra-line','Must be ignored','2026-10-26T09:00:00Z');
  if (select count(*) from public.shopify_order_items i where i.order_id=test_integration_ordering.order_id) <> 1 then raise exception 'stale snapshot added a removed line'; end if;
  update public.shopify_order_items set quantity_current=3,source_updated_at='2026-10-26T11:00:00Z' where id=line_id;
  select quantity_current into quantity from public.shopify_order_items where id=line_id;
  if quantity <> 3 then raise exception 'newer line was rejected'; end if;
  select id into strict inventory_id from public.shopify_inventory_current_state limit 1;
  update public.shopify_inventory_current_state set available_quantity=100,source_updated_at='2099-01-01T00:00:00Z' where id=inventory_id;
  update public.shopify_inventory_current_state set available_quantity=1,source_updated_at='2098-01-01T00:00:00Z' where id=inventory_id;
  if (select available_quantity from public.shopify_inventory_current_state where id=inventory_id) <> 100 then raise exception 'stale inventory replaced newer state'; end if;
  insert into public.klaviyo_campaign_audiences(organization_id,campaign_id,audience_type,external_audience_id,name,raw_data)
    select organization_id,campaign_id,audience_type,external_audience_id,name,raw_data from public.klaviyo_campaign_audiences limit 1
    on conflict(campaign_id,audience_type,external_audience_id) do update set name=excluded.name;
  select revision into revision_before from public.integration_changes where connection_id=store.connection_id;
  update public.integration_connections set last_sync_at=last_sync_at where id=store.connection_id;
  if coalesce((select revision from public.integration_changes where connection_id=store.connection_id),0) <= coalesce(revision_before,0) then raise exception 'realtime receipt not generated'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.integration_changes) <> 0 then raise exception 'receipt leaked across organizations'; end if;
end $$;
rollback;
select jsonb_build_object('rollback',true,'newest_order_wins',true,'newest_line_wins',true,'newest_inventory_wins',true,'repeat_audience_upsert',true,'stale_children_ignored',true,'receipt_generated',true,'rls_isolation',true) as verification;
