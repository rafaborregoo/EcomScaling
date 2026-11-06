-- IMP-02: retain an authoritative before-return basis; old rows stay unverified.
alter table public.shopify_order_facts
  add column if not exists total_before_returns numeric(14,2);

comment on column public.shopify_order_facts.total_before_returns is
  'Provider total before returns/refunds: GraphQL totalPriceSet or REST total_price. NULL means historical basis not verified; populate by a complete provider reconciliation, never by guessing from refunds.';

create or replace function private.shopify_order_facts_net_sales()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.net_sales := coalesce(new.total_before_returns, new.current_total_price, 0) - coalesce(new.refunds, 0);
  return new;
end;
$$;

comment on function private.shopify_order_facts_net_sales() is
  'Derives net_sales from verified total_before_returns minus refunds. Legacy rows retain their previous fallback and remain explicitly unverified until reconciliation.';

alter table public.shopify_order_facts
  drop constraint if exists order_facts_net_sales_coherente,
  add constraint order_facts_net_sales_coherente
    check (net_sales = coalesce(total_before_returns, current_total_price) - refunds);

alter table public.shopify_order_facts
  drop constraint if exists order_facts_before_returns_valid,
  add constraint order_facts_before_returns_valid check (total_before_returns is null or
    (total_before_returns >= 0 and total_before_returns::text not in ('NaN','Infinity','-Infinity')));

comment on column public.shopify_order_facts.net_sales is
  'Before-return total minus refunds, including remaining taxes/shipping. The trigger uses total_before_returns when verified; legacy fallback is explicitly unverified by shopify_financial_coverage.';

create or replace function public.shopify_financial_coverage(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns jsonb
language plpgsql stable security invoker set search_path = '' set timezone = 'UTC'
as $$
declare result jsonb;
begin
  if target_organization_id is null or target_store_id is null or period_start is null or period_end is null
     or not isfinite(period_start) or not isfinite(period_end) or period_end < period_start
     or not exists (select 1 from public.shopify_stores s where s.id=target_store_id
       and s.organization_id=target_organization_id and s.is_active) then
    raise exception 'invalid_financial_coverage_scope_or_window';
  end if;
  with orders as (
    select o.* from public.shopify_order_facts o
    where o.organization_id=target_organization_id and o.store_id=target_store_id
      and o.is_test_order=false and o.cancelled_at is null
      and coalesce(o.processed_at,o.external_created_at) between period_start and period_end
  ), priced as (
    select i.id, i.net_quantity, i.net_revenue, i.net_metrics_source, o.currency_code,
      coalesce(pc.unit_cost,ii.current_unit_cost) as unit_cost,
      pc.unit_cost is null and ii.current_unit_cost is not null as estimated_cost,
      case when pc.unit_cost is not null then pc.currency_code else s.currency_code end as cost_currency
    from orders o join public.shopify_order_items i on i.order_id=o.id and i.organization_id=o.organization_id
    left join public.shopify_inventory_items ii on ii.variant_id=i.variant_id
      and ii.store_id=o.store_id and ii.organization_id=o.organization_id
    join public.shopify_stores s on s.id=o.store_id and s.organization_id=o.organization_id
    left join lateral (
      select c.unit_cost,c.currency_code from public.product_costs c
      where c.inventory_item_id=ii.id and c.organization_id=target_organization_id
        and c.valid_from<=coalesce(o.processed_at,o.external_created_at)::date
        and (c.valid_until is null or c.valid_until>=coalesce(o.processed_at,o.external_created_at)::date)
      order by c.valid_from desc,c.id desc limit 1
    ) pc on true
  ), currencies as (
    select 'orders' as source, o.currency_code as code from orders o
    union all select 'product_costs',p.cost_currency from priced p where p.unit_cost is not null
    union all select 'financial_settings',s.currency_code from public.organization_financial_settings s
      where s.organization_id=target_organization_id
    union all select 'fixed_expenses',f.currency_code from public.fixed_expenses f
      where f.organization_id=target_organization_id and f.is_active
        and f.valid_from<=period_end::date and (f.valid_until is null or f.valid_until>=period_start::date)
    union all select 'shipping_rules',r.currency_code from orders o
      join lateral (
        select x.currency_code from public.shipping_cost_rules x
        where x.organization_id=target_organization_id and x.is_active and x.country_code is null
          and x.valid_from<=coalesce(o.processed_at,o.external_created_at)::date
          and (x.valid_until is null or x.valid_until>=coalesce(o.processed_at,o.external_created_at)::date)
          and coalesce(o.total_before_returns,o.current_total_price)>=x.min_order_total
          and (x.max_order_total is null or coalesce(o.total_before_returns,o.current_total_price)<x.max_order_total)
        order by x.min_order_total desc limit 1
      ) r on true
    union all select 'ads',a.currency_code from public.meta_insight_rows_daily r
      join public.meta_ad_accounts a on a.id=r.ad_account_id and a.organization_id=r.organization_id
      where r.organization_id=target_organization_id and a.store_id=target_store_id
        and r.level='ad' and r.breakdown_hash='none'
        and r.metric_date between period_start::date and period_end::date
  ), currency_buckets as (
    select currency_code, count(*) as lines,
      case when count(*) filter(where net_revenue is null)=0 then round(sum(net_revenue),2) end as line_revenue,
      case when count(*) filter(where unit_cost is null and net_revenue is null)=0
        then round(coalesce(sum(net_revenue) filter(where unit_cost is null),0),2) end as revenue_without_cost,
      case when count(*) filter(where estimated_cost and net_revenue is null)=0
        then round(coalesce(sum(net_revenue) filter(where estimated_cost),0),2) end as revenue_with_estimated_cost
    from priced group by currency_code
  )
  select jsonb_build_object(
    'version','financial-coverage-v1',
    'organization_id',target_organization_id,'store_id',target_store_id,
    'period_start',period_start,'period_end',period_end,
    'model_totals',(select to_jsonb(f) from public.shopify_financial_summary(target_organization_id,period_start,period_end,target_store_id) f),
    'store_count',(select count(*) from public.shopify_stores s where s.organization_id=target_organization_id),
    'currency_code',(select s.currency_code from public.shopify_stores s where s.id=target_store_id),
    'shopify_connection',(select jsonb_build_object('status',c.status,'last_sync_at',c.last_sync_at,'last_error_at',c.last_error_at)
      from public.shopify_stores s left join public.integration_connections c on c.id=s.connection_id
        and c.organization_id=s.organization_id and c.provider='shopify' where s.id=target_store_id),
    'ads_connections',coalesce((select jsonb_agg(distinct jsonb_build_object('status',c.status,'last_sync_at',c.last_sync_at,'last_error_at',c.last_error_at))
      from public.meta_ad_accounts a left join public.integration_connections c on c.id=a.connection_id
        and c.organization_id=a.organization_id and c.provider='meta_ads'
      where a.organization_id=target_organization_id and a.store_id=target_store_id
        and ((a.is_active and a.is_selected) or exists(select 1 from public.meta_insight_rows_daily r
          where r.ad_account_id=a.id and r.organization_id=a.organization_id and r.level='ad' and r.breakdown_hash='none'
            and r.metric_date between period_start::date and period_end::date))), '[]'::jsonb),
    'currencies',coalesce((select jsonb_agg(x) from (select distinct source,code from currencies) x),'[]'::jsonb),
    'orders_count',(select count(*) from orders),
    'orders_without_verified_totals',(select count(*) from orders where total_before_returns is null),
    'orders_with_inconsistent_totals',(select count(*) from orders where total_before_returns is not null
      and abs(total_before_returns-refunds-current_total_price)>0.01),
    'orders_without_lines',(select count(*) from orders o where not exists
      (select 1 from public.shopify_order_items i where i.order_id=o.id and i.organization_id=o.organization_id)),
    'orders_pending_refund_snapshot',(select count(*) from orders o where exists
      (select 1 from public.shopify_refunds r where r.order_id=o.id and r.organization_id=o.organization_id
        and (o.external_updated_at is null or r.external_created_at is null or r.external_created_at>o.external_updated_at))),
    'line_count',(select count(*) from priced),
    'items_with_cost',(select count(*) from priced where unit_cost is not null),
    'items_without_cost',(select count(*) from priced where unit_cost is null),
    'items_with_estimated_cost',(select count(*) from priced where estimated_cost),
    'lines_with_exact_metrics',(select count(*) from priced where net_metrics_source='shopify_graphql_exact' and net_quantity is not null and net_revenue is not null),
    'lines_with_estimated_metrics',(select count(*) from priced where net_metrics_source='shopify_rest_estimate' and net_quantity is not null and net_revenue is not null),
    'lines_without_metrics',(select count(*) from priced where net_metrics_source is null
      or net_metrics_source not in ('shopify_graphql_exact','shopify_rest_estimate') or net_quantity is null or net_revenue is null),
    'lines_with_invalid_values',(select count(*) from priced where net_quantity<0 or unit_cost<0
      or net_revenue::text in ('NaN','Infinity','-Infinity') or unit_cost::text in ('NaN','Infinity','-Infinity')),
    'revenue_by_currency',coalesce((select jsonb_agg(b) from currency_buckets b),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.shopify_financial_coverage(uuid,timestamptz,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.shopify_financial_coverage(uuid,timestamptz,timestamptz,uuid) to service_role;

-- Canonical financial functions: same output contract, verified basis and period-specific fixed costs.
create or replace function public.shopify_margin_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  revenue numeric,
  cogs numeric,
  gross_margin numeric,
  margin_pct numeric,
  items_with_cost bigint,
  items_without_cost bigint,
  items_with_estimated_cost bigint,
  lines_with_exact_metrics bigint,
  lines_with_estimated_metrics bigint,
  lines_without_metrics bigint
)
language sql
stable security invoker set search_path = '' set timezone = 'UTC'
as $$
  with priced_items as (
    select
      oi.id as order_item_id,
      oi.net_quantity,
      oi.net_revenue,
      oi.net_metrics_source,
      (
        select pc.unit_cost
        from public.product_costs pc
        where pc.inventory_item_id = ii.id
          and pc.organization_id = target_organization_id
          and pc.valid_from <= coalesce(o.processed_at, o.external_created_at)::date
          and (pc.valid_until is null or pc.valid_until >= coalesce(o.processed_at, o.external_created_at)::date)
        order by pc.valid_from desc, pc.id desc
        limit 1
      ) as dated_cost,
      ii.current_unit_cost as shopify_cost
    from public.shopify_order_items oi
    join public.shopify_order_facts o on o.id = oi.order_id and o.organization_id = oi.organization_id
    left join public.shopify_inventory_items ii
      on ii.variant_id = oi.variant_id
     and ii.store_id = o.store_id
     and ii.organization_id = o.organization_id
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  resolved as (
    select
      order_item_id,
      net_quantity,
      net_revenue,
      net_metrics_source,
      coalesce(dated_cost, shopify_cost) as unit_cost,
      dated_cost is null and shopify_cost is not null as is_estimated_cost
    from priced_items
  ),
  totals as (
    select
      coalesce(sum(net_revenue), 0) as revenue,
      coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null and net_quantity is not null), 0) as cogs,
      coalesce(sum(net_revenue) filter (where unit_cost is not null and net_quantity is not null), 0) as margin_revenue,
      coalesce(sum(net_quantity * unit_cost) filter (where unit_cost is not null and net_quantity is not null), 0) as margin_cogs,
      count(*) filter (where unit_cost is not null) as items_with_cost,
      count(*) filter (where unit_cost is null) as items_without_cost,
      count(*) filter (where is_estimated_cost) as items_with_estimated_cost,
      count(*) filter (where net_metrics_source = 'shopify_graphql_exact') as lines_with_exact_metrics,
      count(*) filter (where net_metrics_source = 'shopify_rest_estimate') as lines_with_estimated_metrics,
      count(*) filter (where net_metrics_source is null) as lines_without_metrics
    from resolved
  )
  select
    revenue,
    cogs,
    margin_revenue - margin_cogs as gross_margin,
    case when margin_revenue > 0 then round((margin_revenue - margin_cogs) / margin_revenue * 100, 2) else 0 end as margin_pct,
    items_with_cost,
    items_without_cost,
    items_with_estimated_cost,
    lines_with_exact_metrics,
    lines_with_estimated_metrics,
    lines_without_metrics
  from totals;
$$;

create or replace function public.shopify_financial_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  -- Existentes (mismo significado que antes salvo donde se indica)
  net_sales numeric,
  orders_count bigint,
  cogs numeric,
  gross_margin numeric,
  payment_fees numeric,
  shipping_costs numeric,
  fixed_costs numeric,
  net_profit numeric,
  net_margin_pct numeric,
  monthly_fixed_costs numeric,
  break_even_monthly_revenue numeric,
  has_settings boolean,
  fixed_expenses_count bigint,
  items_without_cost bigint,
  -- Ingresos sin IVA
  net_revenue_ex_tax numeric,
  tax_collected numeric,
  -- Envios
  shipping_charged numeric,
  shipping_net numeric,
  uses_shipping_rules boolean,
  -- Ads
  ads_spend numeric,
  ads_by_platform jsonb,
  ads_days_with_data bigint,
  -- Clientes
  new_customers bigint,
  cac_blended numeric,
  -- Unit economics por pedido
  aov_ex_tax numeric,
  cogs_per_order numeric,
  shipping_per_order numeric,
  payment_fee_per_order numeric,
  fixed_per_order numeric,
  fixed_pct_revenue numeric,
  cac_per_order numeric,
  contribution_per_order numeric,
  breakeven_cac_per_order numeric,
  mbee numeric,
  breakeven_roas numeric
)
language sql
stable security invoker set search_path = '' set timezone = 'UTC'
as $$
  with period as (
    select
      coalesce(
        period_start,
        (
          select min(coalesce(o.processed_at, o.external_created_at))
          from public.shopify_order_facts o
          where o.organization_id = target_organization_id
            and (target_store_id is null or o.store_id = target_store_id)
        ),
        period_end
      ) as effective_start,
      period_end as effective_end
  ),
  settings as (
    select s.payment_fee_pct, s.payment_fee_fixed, s.default_shipping_cost
    from public.organization_financial_settings s
    where s.organization_id = target_organization_id
  ),
  -- Pedidos del periodo, una sola pasada. De aqui salen ingresos, IVA, envio
  -- cobrado y el coste de envio por tramo.
  orders as (
    select
      o.id,
      o.customer_reference_hash,
      coalesce(o.processed_at, o.external_created_at) as happened_at,
      o.net_sales,
      o.current_total_price,
      o.total_before_returns,
      o.current_total_tax,
      o.current_shipping_price,
      o.refunds
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  -- Coste de envio pedido a pedido, buscando la regla de `shipping_cost_rules`
  -- que cubre el importe del pedido y estaba vigente ese dia. Sin regla, el
  -- envio medio de los ajustes, que es lo que se hacia antes para todo.
  --
  -- LIMITACION CONOCIDA: solo se aplican las reglas SIN pais. Las reglas con
  -- `country_code` quedan fuera porque los pedidos no guardan pais: la
  -- ubicacion del cliente se dejo de pedir y de guardar a proposito en
  -- 20260910130000_shopify_customers_drop_location.sql (dato protegido de
  -- Shopify que no leia nadie). Para activar reglas por pais habria que volver
  -- a solicitar ese acceso, que es una decision de producto, no de codigo.
  orders_shipping as (
    select
      o.id,
      coalesce(rule.cost_per_order, st.default_shipping_cost, 0) as shipping_cost,
      rule.cost_per_order is not null as matched_rule
    from orders o
    left join settings st on true
    left join lateral (
      select r.cost_per_order
      from public.shipping_cost_rules r
      where r.organization_id = target_organization_id
        and r.is_active
        and r.country_code is null
        and r.valid_from <= o.happened_at::date
        and (r.valid_until is null or r.valid_until >= o.happened_at::date)
        and coalesce(o.total_before_returns,o.current_total_price) >= r.min_order_total
        and (r.max_order_total is null or coalesce(o.total_before_returns,o.current_total_price) < r.max_order_total)
      order by r.min_order_total desc
      limit 1
    ) rule on true
  ),
  sales as (
    select
      coalesce(sum(o.net_sales), 0) as net_sales,
      -- Net sales uses a verified before-return basis; subtract remaining tax once.
      coalesce(sum(o.net_sales - o.current_total_tax), 0) as net_revenue_ex_tax,
      coalesce(sum(o.current_total_tax), 0) as tax_collected,
      coalesce(sum(o.current_shipping_price), 0) as shipping_charged,
      count(*) as orders_count
    from orders o
  ),
  shipping as (
    select
      coalesce(sum(s.shipping_cost), 0) as shipping_paid,
      coalesce(bool_or(s.matched_rule), false) as uses_shipping_rules
    from orders_shipping s
  ),
  -- Cliente nuevo = su primer pedido de siempre cae dentro del periodo.
  -- NO se usa `is_first_customer_order`: el webhook de pedidos no escribe esa
  -- columna (solo lo hace el sync bulk), asi que todo pedido entrado por
  -- webhook la tiene a null. Mismo tipo de agujero que dejo 248 pedidos a cero
  -- euros en `net_sales`. Derivarlo aqui no depende de que nadie despliegue.
  customers as (
    select count(*)::bigint as new_customers
    from (
      select
        o.customer_reference_hash,
        min(coalesce(o.processed_at, o.external_created_at)) as first_order_at
      from public.shopify_order_facts o
      where o.organization_id = target_organization_id
        and (target_store_id is null or o.store_id = target_store_id)
        and o.is_test_order = false
        and o.cancelled_at is null
        and o.customer_reference_hash is not null
      group by o.customer_reference_hash
    ) first_orders
    where (period_start is null or first_orders.first_order_at >= period_start)
      and first_orders.first_order_at <= period_end
  ),
  margin as (
    select m.cogs, m.items_without_cost
    from public.shopify_margin_summary(target_organization_id, period_start, period_end, target_store_id) m
  ),
  ads as (
    select a.spend, a.by_platform, a.days_with_data
    from public.ads_spend_summary(target_organization_id, period_start, period_end, target_store_id) a
  ),
  fixed as (
    select
      coalesce(
        sum(
          (case when fe.billing_period = 'yearly' then fe.amount / 12 else fe.amount end)
          * greatest(
              extract(
                epoch from (
                  least(coalesce((fe.valid_until + 1)::timestamptz, p.effective_end), p.effective_end)
                  - greatest(fe.valid_from::timestamptz, p.effective_start)
                )
              ) / 86400.0,
              0
            )
          / 30.44
        ),
        0
      ) as fixed_costs_period,
      coalesce(
        sum(case when fe.billing_period = 'yearly' then fe.amount / 12 else fe.amount end)
          filter (
            where fe.valid_from <= (period_end at time zone 'UTC')::date
              and (fe.valid_until is null or fe.valid_until >= (period_end at time zone 'UTC')::date)
          ),
        0
      ) as monthly_fixed_costs,
      count(*) as fixed_expenses_count
    from public.fixed_expenses fe
    cross join period p
    where fe.organization_id = target_organization_id
      and fe.is_active
  ),
  -- Todos los terminos ya resueltos, para no repetir la formula seis veces.
  calc as (
    select
      s.net_sales,
      s.net_revenue_ex_tax,
      s.tax_collected,
      s.shipping_charged,
      s.orders_count,
      m.cogs,
      m.items_without_cost,
      sh.shipping_paid,
      sh.uses_shipping_rules,
      ad.spend as ads_spend,
      ad.by_platform as ads_by_platform,
      ad.days_with_data as ads_days_with_data,
      c.new_customers,
      f.fixed_costs_period,
      f.monthly_fixed_costs,
      f.fixed_expenses_count,
      exists (select 1 from settings) as has_settings,
      -- La pasarela cobra sobre el importe que el cliente paga de verdad (IVA
      -- y envio incluidos), no sobre el ingreso sin IVA. Por eso este termino
      -- sigue apoyado en net_sales y no en net_revenue_ex_tax.
      round(
        s.net_sales * coalesce(st.payment_fee_pct, 0) / 100
          + s.orders_count * coalesce(st.payment_fee_fixed, 0),
        2
      ) as payment_fees
    from sales s
    cross join margin m
    cross join shipping sh
    cross join ads ad
    cross join customers c
    cross join fixed f
    left join settings st on true
  ),
  derived as (
    select
      c.*,
      -- Margen de contribucion del periodo: lo que queda tras coste variable,
      -- antes de fijos y antes de ads. Es el denominador del break-even.
      c.net_revenue_ex_tax - c.cogs - c.payment_fees - c.shipping_paid as contribution_total,
      c.net_revenue_ex_tax - c.cogs - c.payment_fees - c.shipping_paid
        - c.fixed_costs_period - c.ads_spend as net_profit
    from calc c
  )
  select
    round(d.net_sales, 2),
    d.orders_count,
    round(d.cogs, 2),
    -- gross_margin sobre el ingreso SIN IVA: el IVA no es tuyo, no puede
    -- inflar tu margen bruto.
    round(d.net_revenue_ex_tax - d.cogs, 2) as gross_margin,
    d.payment_fees,
    round(d.shipping_paid, 2) as shipping_costs,
    round(d.fixed_costs_period, 2) as fixed_costs,
    round(d.net_profit, 2) as net_profit,
    case
      when d.net_revenue_ex_tax > 0
        then round(d.net_profit / d.net_revenue_ex_tax * 100, 2)
      else 0
    end as net_margin_pct,
    round(d.monthly_fixed_costs, 2),
    -- Break-even: facturacion sin IVA necesaria para cubrir los fijos. Los ads
    -- quedan FUERA a proposito -- no son un suelo, son una decision; su
    -- break-even es `breakeven_roas`, mas abajo.
    case
      when d.net_revenue_ex_tax > 0 and d.contribution_total > 0
        then round(d.monthly_fixed_costs / (d.contribution_total / d.net_revenue_ex_tax), 2)
      else null
    end as break_even_monthly_revenue,
    d.has_settings,
    d.fixed_expenses_count,
    d.items_without_cost,
    round(d.net_revenue_ex_tax, 2),
    round(d.tax_collected, 2),
    round(d.shipping_charged, 2),
    -- Positivo = el envio te cuesta mas de lo que cobras (la cifra "envios
    -- netos -1.453 EUR" del panel de referencia se muestra en negativo).
    round(d.shipping_charged - d.shipping_paid, 2) as shipping_net,
    d.uses_shipping_rules,
    round(d.ads_spend, 2),
    d.ads_by_platform,
    d.ads_days_with_data,
    d.new_customers,
    case when d.new_customers > 0 then round(d.ads_spend / d.new_customers, 2) else null end as cac_blended,
    case when d.orders_count > 0 then round(d.net_revenue_ex_tax / d.orders_count, 2) else 0 end as aov_ex_tax,
    case when d.orders_count > 0 then round(d.cogs / d.orders_count, 2) else 0 end as cogs_per_order,
    case when d.orders_count > 0 then round(d.shipping_paid / d.orders_count, 2) else 0 end as shipping_per_order,
    case when d.orders_count > 0 then round(d.payment_fees / d.orders_count, 2) else 0 end as payment_fee_per_order,
    case when d.orders_count > 0 then round(d.fixed_costs_period / d.orders_count, 2) else 0 end as fixed_per_order,
    case
      when d.net_revenue_ex_tax > 0
        then round(d.fixed_costs_period / d.net_revenue_ex_tax * 100, 2)
      else 0
    end as fixed_pct_revenue,
    case when d.orders_count > 0 then round(d.ads_spend / d.orders_count, 2) else 0 end as cac_per_order,
    -- "AOV - COGS - envio - CAC": lo que deja un pedido una vez pagado el
    -- producto, el envio y lo que costo traerlo. Antes de fijos.
    case
      when d.orders_count > 0
        then round((d.net_revenue_ex_tax - d.cogs - d.shipping_paid - d.ads_spend) / d.orders_count, 2)
      else 0
    end as contribution_per_order,
    -- CAC de break-even: el maximo que puedes pagar por captar un pedido sin
    -- perder dinero (todo lo demas ya descontado, fijos incluidos).
    case
      when d.orders_count > 0
        then round(
          (d.net_revenue_ex_tax - d.cogs - d.payment_fees - d.shipping_paid - d.fixed_costs_period)
          / d.orders_count,
          2
        )
      else 0
    end as breakeven_cac_per_order,
    -- MBEE = margen tras CAC = cuanto te sobra (o te falta) por pedido frente
    -- a ese techo. Positivo = cada pedido captado deja dinero.
    case
      when d.orders_count > 0
        then round(
          (d.net_revenue_ex_tax - d.cogs - d.payment_fees - d.shipping_paid
            - d.fixed_costs_period - d.ads_spend) / d.orders_count,
          2
        )
      else 0
    end as mbee,
    -- ROAS que hay que batir para que la publicidad no cueste dinero.
    case
      when (d.net_revenue_ex_tax - d.cogs - d.payment_fees - d.shipping_paid - d.fixed_costs_period) > 0
        then round(
          d.net_revenue_ex_tax
          / (d.net_revenue_ex_tax - d.cogs - d.payment_fees - d.shipping_paid - d.fixed_costs_period),
          2
        )
      else null
    end as breakeven_roas
  from derived d;
$$;

-- Preserve the canonical advertising cost calculation and enforce the account owner.
create or replace function public.ads_spend_summary(
  target_organization_id uuid, period_start timestamptz, period_end timestamptz, target_store_id uuid
)
returns table(spend numeric,by_platform jsonb,days_with_data bigint)
language sql stable security invoker set search_path = '' set timezone = 'UTC'
as $$
  with meta as (
    select coalesce(sum(r.spend),0) as spend,count(distinct r.metric_date)::bigint as days_with_data
    from public.meta_insight_rows_daily r
    join public.meta_ad_accounts a on a.id=r.ad_account_id and a.organization_id=r.organization_id
    where r.organization_id=target_organization_id and r.level='ad' and r.breakdown_hash='none'
      and (target_store_id is null or a.store_id=target_store_id)
      and (period_start is null or r.metric_date>=period_start::date)
      and r.metric_date<=period_end::date
  )
  select round(m.spend,2),jsonb_build_object('meta',round(m.spend,2)),m.days_with_data from meta m;
$$;
