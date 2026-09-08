-- Metricas del modulo de Shopify: las ocho preguntas que las tablas nuevas
-- permiten responder y que hasta ahora no se podian ni formular.
--
-- ADR-0006 pto 6: funciones SQL `stable`, sin `security definer`, ejecutables
-- por `authenticated` y llamadas via .rpc(). No se agrega en Node.
--
-- Todas las que miran pedidos repiten el mismo predicado de fecha
-- (`coalesce(processed_at, external_created_at)` con `is_test_order = false` y
-- `cancelled_at is null`) porque asi calzan con el indice parcial que ya
-- existe: shopify_order_facts_org_processed_idx. Cambiar ese predicado en una
-- sola funcion la saca del indice sin que nada avise.

-- --- 1. Recurrencia --------------------------------------------------------
--
-- `customer_order_index` viene de Shopify y vale 1 en el primer pedido de ese
-- cliente. Es null en dos casos: pedidos sincronizados antes de que se pidiera
-- el campo, y tiendas donde el reintento sin extras se llevo la atribucion.
-- Esos van a su propia columna y NO se cuentan como nuevos: contarlos ahi es
-- exactamente el error que hacia que el 100% de los pedidos pareciera de
-- clientes primerizos.

drop function if exists public.shopify_customer_recurrence(uuid, timestamptz, timestamptz, uuid);
create or replace function public.shopify_customer_recurrence(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  new_orders bigint,
  returning_orders bigint,
  unknown_orders bigint,
  new_revenue numeric,
  returning_revenue numeric,
  repeat_order_rate numeric
)
language sql
stable
as $$
  with scoped as (
    select o.customer_order_index, o.net_sales
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) >= period_start
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  )
  select
    count(*) filter (where customer_order_index = 1) as new_orders,
    count(*) filter (where customer_order_index > 1) as returning_orders,
    count(*) filter (where customer_order_index is null) as unknown_orders,
    coalesce(sum(net_sales) filter (where customer_order_index = 1), 0) as new_revenue,
    coalesce(sum(net_sales) filter (where customer_order_index > 1), 0) as returning_revenue,
    round(
      count(*) filter (where customer_order_index > 1)::numeric
      / nullif(count(*) filter (where customer_order_index is not null), 0),
      4
    ) as repeat_order_rate
  from scoped;
$$;

-- --- 2. Valor por cliente --------------------------------------------------
--
-- Sin ventana de fechas a proposito. El valor de vida de un cliente es la suma
-- de todo lo que ha comprado; recortarlo a los ultimos 30 dias da un numero
-- mas pequeño que no significa nada.
--
-- Los pedidos de invitado no llevan `customer_reference_hash` y no se pueden
-- atribuir a nadie. Se excluyen del calculo y se devuelven aparte: si son
-- muchos, la media por cliente esta describiendo solo a media tienda.

drop function if exists public.shopify_customer_value(uuid, uuid);
create or replace function public.shopify_customer_value(
  target_organization_id uuid,
  target_store_id uuid
)
returns table (
  customers bigint,
  orders_with_customer bigint,
  guest_orders bigint,
  avg_orders_per_customer numeric,
  avg_revenue_per_customer numeric,
  median_revenue_per_customer numeric,
  p90_revenue_per_customer numeric
)
language sql
stable
as $$
  with scoped as (
    select o.customer_reference_hash as hash, o.net_sales
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
  ),
  per_customer as (
    select hash, count(*) as orders, sum(net_sales) as revenue
    from scoped
    where hash is not null
    group by hash
  )
  select
    (select count(*) from per_customer) as customers,
    (select coalesce(sum(orders), 0) from per_customer) as orders_with_customer,
    (select count(*) from scoped where hash is null) as guest_orders,
    (select round(avg(orders), 2) from per_customer) as avg_orders_per_customer,
    (select round(avg(revenue), 2) from per_customer) as avg_revenue_per_customer,
    -- percentile_disc y no percentile_cont: devuelve un importe que un cliente
    -- de verdad ha gastado, sin interpolar entre dos que no existen.
    (select percentile_disc(0.5) within group (order by revenue) from per_customer) as median_revenue_per_customer,
    (select percentile_disc(0.9) within group (order by revenue) from per_customer) as p90_revenue_per_customer;
$$;

-- --- 3. Cohortes -----------------------------------------------------------
--
-- La cohorte es el mes del PRIMER pedido del cliente, calculado sobre todo su
-- historial y no sobre la ventana: un cliente que compro por primera vez en
-- enero sigue siendo de la cohorte de enero cuando vuelve en agosto.
--
-- `cohort_customers` va repetido en cada fila para que la retencion se calcule
-- en la UI sin una segunda consulta.

drop function if exists public.shopify_cohorts(uuid, uuid, integer);
create or replace function public.shopify_cohorts(
  target_organization_id uuid,
  target_store_id uuid,
  months_back integer default 12
)
returns table (
  cohort_month date,
  cohort_customers bigint,
  month_offset integer,
  customers bigint,
  orders bigint,
  revenue numeric
)
language sql
stable
as $$
  with scoped as (
    select
      o.customer_reference_hash as hash,
      coalesce(o.processed_at, o.external_created_at) as ordered_at,
      o.net_sales
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and o.customer_reference_hash is not null
  ),
  first_order as (
    select hash, date_trunc('month', min(ordered_at))::date as cohort_month
    from scoped
    group by hash
  ),
  recent as (
    select *
    from first_order
    where cohort_month >= (date_trunc('month', now()) - make_interval(months => months_back))::date
  ),
  sizes as (
    select cohort_month, count(*) as cohort_customers
    from recent
    group by cohort_month
  )
  select
    r.cohort_month,
    s.cohort_customers,
    (
      (date_part('year', o.ordered_at) - date_part('year', r.cohort_month)) * 12
      + (date_part('month', o.ordered_at) - date_part('month', r.cohort_month))
    )::integer as month_offset,
    count(distinct o.hash) as customers,
    count(*) as orders,
    coalesce(sum(o.net_sales), 0) as revenue
  from scoped o
  join recent r on r.hash = o.hash
  join sizes s on s.cohort_month = r.cohort_month
  group by r.cohort_month, s.cohort_customers, 3
  order by r.cohort_month, 3;
$$;

-- --- 4. Atribucion por canal ----------------------------------------------
--
-- Primera visita y no ultima: la campaña que trajo al cliente no suele ser la
-- que cerro la venta, y atribuirlo todo al ultimo clic es como el trafico
-- directo se come el merito de lo que pagaste.
--
-- ADR-0021: esto son EUR atribuidos POR SHOPIFY con su propia ventana, medidos
-- first-party sobre la sesion del comprador. No se suman con la atribucion de
-- Meta ni de Klaviyo, que miden otra cosa.
--
-- Los pedidos sin atribucion salen en su propia fila (source_type null) en vez
-- de desaparecer: si son la mayoria, el reparto de los demas no vale nada.

drop function if exists public.shopify_attribution_by_channel(uuid, timestamptz, timestamptz, uuid);
create or replace function public.shopify_attribution_by_channel(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  source_type text,
  source text,
  utm_campaign text,
  orders bigint,
  revenue numeric,
  new_customers bigint,
  avg_days_to_conversion numeric
)
language sql
stable
as $$
  select
    o.first_visit_source_type::text as source_type,
    o.first_visit_source::text as source,
    o.first_visit_utm_campaign::text as utm_campaign,
    count(*) as orders,
    coalesce(sum(o.net_sales), 0) as revenue,
    count(*) filter (where o.customer_order_index = 1) as new_customers,
    round(avg(o.days_to_conversion), 1) as avg_days_to_conversion
  from public.shopify_order_facts o
  where o.organization_id = target_organization_id
    and (target_store_id is null or o.store_id = target_store_id)
    and o.is_test_order = false
    and o.cancelled_at is null
    and coalesce(o.processed_at, o.external_created_at) >= period_start
    and coalesce(o.processed_at, o.external_created_at) <= period_end
  group by 1, 2, 3
  order by revenue desc;
$$;

-- --- 5. Devoluciones por producto -----------------------------------------
--
-- La ventana es la del PEDIDO, no la de la devolucion: la pregunta es "de lo
-- que vendimos en este periodo, cuanto ha vuelto", y una devolucion tramitada
-- el mes siguiente sigue siendo culpa de esa venta.
--
-- El motivo es lo que separa un problema de talla de uno de calidad: sin el,
-- las dos devoluciones se ven igual y piden arreglos opuestos.

drop function if exists public.shopify_return_rate_by_product(uuid, timestamptz, timestamptz, uuid, integer);
create or replace function public.shopify_return_rate_by_product(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid,
  result_limit integer default 20
)
returns table (
  product_id uuid,
  title text,
  units_sold bigint,
  units_returned bigint,
  return_rate numeric,
  revenue numeric,
  refunded_amount numeric,
  top_return_reason text
)
language sql
stable
as $$
  with sold as (
    select
      i.id as item_id,
      i.product_id,
      i.title,
      i.quantity_original,
      i.current_line_total,
      i.refunded_amount
    from public.shopify_order_items i
    join public.shopify_order_facts o on o.id = i.order_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) >= period_start
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  returned as (
    select
      r.order_item_id,
      sum(r.quantity) as units,
      mode() within group (order by r.return_reason) as reason
    from public.shopify_return_line_items r
    join sold on sold.item_id = r.order_item_id
    where r.organization_id = target_organization_id
    group by r.order_item_id
  )
  select
    sold.product_id,
    min(sold.title)::text as title,
    coalesce(sum(sold.quantity_original), 0) as units_sold,
    coalesce(sum(returned.units), 0) as units_returned,
    round(
      coalesce(sum(returned.units), 0)::numeric
      / nullif(sum(sold.quantity_original), 0),
      4
    ) as return_rate,
    coalesce(sum(sold.current_line_total), 0) as revenue,
    coalesce(sum(sold.refunded_amount), 0) as refunded_amount,
    mode() within group (order by returned.reason) as top_return_reason
  from sold
  left join returned on returned.order_item_id = sold.item_id
  where sold.product_id is not null
  group by sold.product_id
  order by units_returned desc, revenue desc
  limit result_limit;
$$;

-- --- 6. Plazos de entrega --------------------------------------------------
--
-- Lo primero que se rompe al escalar: el tiempo hasta el envio sube antes que
-- ninguna otra cifra, y cuando se nota en las devoluciones ya lleva semanas
-- pasando.
--
-- La ventana es la del envio (`external_created_at` de shopify_fulfillments),
-- que es la que calza con shopify_fulfillments_created_idx.
--
-- `with_estimate` existe porque Shopify no siempre trae fecha estimada: sin esa
-- columna, `late_deliveries = 0` se lee como "nada llego tarde" cuando en
-- realidad puede ser "no habia con que compararlo".

drop function if exists public.shopify_delivery_times(uuid, timestamptz, timestamptz, uuid);
create or replace function public.shopify_delivery_times(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  fulfillments bigint,
  delivered bigint,
  in_transit bigint,
  avg_hours_to_ship numeric,
  avg_days_to_deliver numeric,
  with_estimate bigint,
  late_deliveries bigint,
  avg_delay_days numeric
)
language sql
stable
as $$
  with scoped as (
    select
      f.external_created_at as shipped_at,
      f.delivered_at,
      f.in_transit_at,
      f.estimated_delivery_at,
      coalesce(o.processed_at, o.external_created_at) as ordered_at
    from public.shopify_fulfillments f
    join public.shopify_order_facts o on o.id = f.order_id
    where f.organization_id = target_organization_id
      and (target_store_id is null or f.store_id = target_store_id)
      and f.external_created_at >= period_start
      and f.external_created_at <= period_end
  )
  select
    count(*) as fulfillments,
    count(*) filter (where delivered_at is not null) as delivered,
    count(*) filter (where delivered_at is null and in_transit_at is not null) as in_transit,
    round(
      (avg(extract(epoch from (shipped_at - ordered_at)) / 3600)
        filter (where shipped_at is not null and ordered_at is not null))::numeric,
      1
    ) as avg_hours_to_ship,
    round(
      (avg(extract(epoch from (delivered_at - shipped_at)) / 86400)
        filter (where delivered_at is not null and shipped_at is not null))::numeric,
      1
    ) as avg_days_to_deliver,
    count(*) filter (where estimated_delivery_at is not null) as with_estimate,
    count(*) filter (
      where delivered_at is not null
        and estimated_delivery_at is not null
        and delivered_at > estimated_delivery_at
    ) as late_deliveries,
    round(
      (avg(extract(epoch from (delivered_at - estimated_delivery_at)) / 86400)
        filter (
          where delivered_at is not null
            and estimated_delivery_at is not null
            and delivered_at > estimated_delivery_at
        ))::numeric,
      1
    ) as avg_delay_days
  from scoped;
$$;

-- --- 7. Recuperacion de carrito -------------------------------------------
--
-- `completed_at` es la mitad que importa: sin el, un carrito que acabo en
-- compra se contaria como perdido y la recuperacion saldria siempre a cero.

drop function if exists public.shopify_checkout_recovery(uuid, timestamptz, timestamptz, uuid);
create or replace function public.shopify_checkout_recovery(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  checkouts bigint,
  recovered bigint,
  recovery_rate numeric,
  lost_value numeric,
  recovered_value numeric,
  avg_checkout_value numeric,
  avg_hours_to_recover numeric
)
language sql
stable
as $$
  with scoped as (
    select c.total_price, c.completed_at, c.external_created_at
    from public.shopify_abandoned_checkouts c
    where c.organization_id = target_organization_id
      and (target_store_id is null or c.store_id = target_store_id)
      and c.external_created_at >= period_start
      and c.external_created_at <= period_end
  )
  select
    count(*) as checkouts,
    count(*) filter (where completed_at is not null) as recovered,
    round(
      count(*) filter (where completed_at is not null)::numeric / nullif(count(*), 0),
      4
    ) as recovery_rate,
    coalesce(sum(total_price) filter (where completed_at is null), 0) as lost_value,
    coalesce(sum(total_price) filter (where completed_at is not null), 0) as recovered_value,
    round(avg(total_price), 2) as avg_checkout_value,
    round(
      (avg(extract(epoch from (completed_at - external_created_at)) / 3600)
        filter (where completed_at is not null))::numeric,
      1
    ) as avg_hours_to_recover
  from scoped;
$$;

-- --- 8. Coste de las promociones por codigo -------------------------------
--
-- La pregunta que responde: este codigo, ¿trae clientes nuevos o esta
-- regalando margen a quien iba a comprar igual?
--
-- `order_discount_total` es el descuento del PEDIDO ENTERO, no el de este
-- codigo: la API de Shopify no devuelve el importe por aplicacion sin pedir el
-- desglose por linea, que no cabe en el limite de la query bulk. Cuando un
-- pedido lleva dos codigos, los dos se apuntan el mismo descuento. Por eso va
-- `orders_with_multiple_codes`: es la unica forma de ver si la cifra de arriba
-- esta inflada, en vez de tener que confiar en ella.

drop function if exists public.shopify_discount_cost_by_code(uuid, timestamptz, timestamptz, uuid, integer);
create or replace function public.shopify_discount_cost_by_code(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid,
  result_limit integer default 20
)
returns table (
  code text,
  orders bigint,
  order_revenue numeric,
  order_discount_total numeric,
  new_customers bigint,
  orders_with_multiple_codes bigint,
  discount_share numeric
)
language sql
stable
as $$
  with scoped_orders as (
    select o.id, o.net_sales, o.discounts, o.customer_order_index
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) >= period_start
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  codes_per_order as (
    select a.order_id, count(*) as code_count
    from public.shopify_order_discount_applications a
    join scoped_orders on scoped_orders.id = a.order_id
    where a.organization_id = target_organization_id
      and a.code is not null
    group by a.order_id
  )
  select
    a.code::text,
    count(*) as orders,
    coalesce(sum(o.net_sales), 0) as order_revenue,
    coalesce(sum(o.discounts), 0) as order_discount_total,
    count(*) filter (where o.customer_order_index = 1) as new_customers,
    count(*) filter (where c.code_count > 1) as orders_with_multiple_codes,
    round(
      coalesce(sum(o.discounts), 0) / nullif(sum(o.net_sales + o.discounts), 0),
      4
    ) as discount_share
  from public.shopify_order_discount_applications a
  join scoped_orders o on o.id = a.order_id
  join codes_per_order c on c.order_id = a.order_id
  where a.organization_id = target_organization_id
    and a.code is not null
  group by a.code
  order by order_discount_total desc
  limit result_limit;
$$;

-- --- Permisos --------------------------------------------------------------
-- Sin `security definer`: la RLS de las tablas sigue mandando y el parametro de
-- organizacion es un filtro, no la autorizacion.

grant execute on function public.shopify_customer_recurrence(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.shopify_customer_value(uuid, uuid) to authenticated;
grant execute on function public.shopify_cohorts(uuid, uuid, integer) to authenticated;
grant execute on function public.shopify_attribution_by_channel(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.shopify_return_rate_by_product(uuid, timestamptz, timestamptz, uuid, integer) to authenticated;
grant execute on function public.shopify_delivery_times(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.shopify_checkout_recovery(uuid, timestamptz, timestamptz, uuid) to authenticated;
grant execute on function public.shopify_discount_cost_by_code(uuid, timestamptz, timestamptz, uuid, integer) to authenticated;
