alter table public.a11_marketing_generation_requests
  add column if not exists progress_stage text not null default 'context'
    check (progress_stage in ('context','model','validation','saving','completed','failed'));

create or replace function public.set_a11_marketing_generation_stage(
  p_organization_id uuid, p_actor_user_id uuid, p_idempotency_key text, p_stage text
) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if p_stage not in ('context','model','validation','saving','completed','failed') then return false; end if;
  update public.a11_marketing_generation_requests
     set progress_stage=p_stage, updated_at=now()
   where organization_id=p_organization_id and actor_user_id=p_actor_user_id
     and idempotency_key=left(coalesce(p_idempotency_key,''),64) and status='running';
  return found;
end;
$$;
revoke all on function public.set_a11_marketing_generation_stage(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.set_a11_marketing_generation_stage(uuid,uuid,text,text) to service_role;

drop function if exists public.marketing_studio_products_by_ids(uuid, uuid, uuid[]);
create or replace function public.marketing_studio_products_by_ids(
  target_organization_id uuid, target_store_id uuid, target_product_ids uuid[]
) returns table(product_id uuid,title text,price numeric,currency_code text,image_url text,image_alt text,product_url text,units_30d bigint)
language sql stable set search_path to 'pg_catalog','public' as $$
  with stores as (
    select s.id,coalesce(nullif(s.primary_domain,''),s.myshopify_domain) domain,s.currency_code
    from public.shopify_stores s where s.organization_id=target_organization_id and s.is_active
      and (target_store_id is null or s.id=target_store_id)
  ), media as (
    select distinct on (m.product_id) m.product_id,m.source_url,m.alt_text
    from public.shopify_product_media m where m.organization_id=target_organization_id
      and m.store_id in (select id from stores) and m.is_active and m.media_content_type='IMAGE'
    order by m.product_id,m.position nulls last
  ), prices as (
    select v.product_id,min(v.current_price) price from public.shopify_variants v
    where v.organization_id=target_organization_id and v.is_active group by v.product_id
  ), sales as (
    select i.product_id,sum(i.quantity_current)::bigint units from public.shopify_order_items i
    join public.shopify_order_facts o on o.id=i.order_id
    where o.organization_id=target_organization_id and o.store_id in(select id from stores)
      and o.cancelled_at is null and not o.is_test_order and o.processed_at>=now()-interval '30 days'
    group by i.product_id
  )
  select p.id,p.title::text,pr.price,st.currency_code::text,md.source_url,md.alt_text,
    case when p.handle is not null and st.domain is not null then 'https://'||st.domain||'/products/'||p.handle end,
    coalesce(sa.units,0)
  from public.shopify_products p join stores st on st.id=p.store_id
  left join prices pr on pr.product_id=p.id left join media md on md.product_id=p.id left join sales sa on sa.product_id=p.id
  where p.organization_id=target_organization_id and p.status='ACTIVE'
    and p.id=any(coalesce(target_product_ids,'{}'::uuid[]))
  limit 24;
$$;
revoke all on function public.marketing_studio_products_by_ids(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.marketing_studio_products_by_ids(uuid,uuid,uuid[]) to authenticated,service_role;

create table if not exists public.marketing_studio_operation_audits (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null,
  draft_id uuid not null, actor_user_id uuid not null, request_id uuid,
  base_version integer not null check(base_version>0), final_version integer not null check(final_version>=base_version),
  source text not null check(source in ('ai','manual','undo','redo')),
  accepted_operations jsonb not null default '[]'::jsonb,
  rejected_operations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists marketing_studio_operation_audits_draft_idx
  on public.marketing_studio_operation_audits(organization_id,draft_id,created_at desc);
alter table public.marketing_studio_operation_audits enable row level security;
revoke all on public.marketing_studio_operation_audits from anon,authenticated;
grant select,insert on public.marketing_studio_operation_audits to service_role;
