-- Estudio de contenido: productos para los bloques de producto de un email
-- (más vendidos en 30 días, novedades o búsqueda por nombre), con precio,
-- foto principal y enlace a la ficha. Idempotente.
--
-- Depende de shopify_product_media (20261115832000); por eso va después.
-- Parámetros calificados con el nombre de la función: en SQL, una columna
-- que se llama como un parámetro gana y el filtro dejaría de filtrar.

drop function if exists public.marketing_studio_products(uuid, uuid, text, text, integer);

create or replace function public.marketing_studio_products(
  target_organization_id uuid,
  target_store_id uuid default null,
  source text default 'best',
  search text default null,
  max_rows integer default 12
)
returns table(
  product_id uuid,
  title text,
  price numeric,
  currency_code text,
  image_url text,
  image_alt text,
  product_url text,
  units_30d bigint
)
language sql
stable
set search_path to 'pg_catalog', 'public'
as $function$
  with stores as (
    select s.id,
           coalesce(nullif(s.primary_domain, ''), s.myshopify_domain) as domain,
           s.currency_code
    from public.shopify_stores s
    where s.organization_id = marketing_studio_products.target_organization_id
      and (marketing_studio_products.target_store_id is null
           or s.id = marketing_studio_products.target_store_id)
  ),
  sales as (
    select i.product_id, sum(i.quantity_current)::bigint as units
    from public.shopify_order_items i
    join public.shopify_order_facts o on o.id = i.order_id
    where o.organization_id = marketing_studio_products.target_organization_id
      and o.store_id in (select id from stores)
      and o.cancelled_at is null
      and not o.is_test_order
      and o.processed_at >= now() - interval '30 days'
      and i.product_id is not null
    group by i.product_id
  ),
  media as (
    select distinct on (m.product_id) m.product_id, m.source_url, m.alt_text
    from public.shopify_product_media m
    where m.organization_id = marketing_studio_products.target_organization_id
      and m.store_id in (select id from stores)
      and m.is_active
      and m.media_content_type = 'IMAGE'
    order by m.product_id, m.position nulls last
  ),
  prices as (
    select v.product_id, min(v.current_price) as price
    from public.shopify_variants v
    where v.organization_id = marketing_studio_products.target_organization_id
      and v.is_active
    group by v.product_id
  )
  select p.id,
         p.title::text,
         pr.price,
         st.currency_code::text,
         md.source_url,
         md.alt_text,
         case when p.handle is not null and st.domain is not null
              then 'https://' || st.domain || '/products/' || p.handle end,
         coalesce(sa.units, 0)
  from public.shopify_products p
  join stores st on st.id = p.store_id
  left join sales sa on sa.product_id = p.id
  left join media md on md.product_id = p.id
  left join prices pr on pr.product_id = p.id
  where p.organization_id = marketing_studio_products.target_organization_id
    and p.status = 'ACTIVE'
    and (marketing_studio_products.search is null
         or p.title ilike '%' || marketing_studio_products.search || '%')
  order by
    case when marketing_studio_products.source = 'best' then coalesce(sa.units, 0) end desc nulls last,
    case when marketing_studio_products.source = 'new' then coalesce(p.published_at, p.external_created_at) end desc nulls last,
    p.title
  limit least(greatest(coalesce(marketing_studio_products.max_rows, 12), 1), 48);
$function$;

revoke all on function public.marketing_studio_products(uuid, uuid, text, text, integer) from public, anon;
grant execute on function public.marketing_studio_products(uuid, uuid, text, text, integer) to authenticated;
grant execute on function public.marketing_studio_products(uuid, uuid, text, text, integer) to service_role;
