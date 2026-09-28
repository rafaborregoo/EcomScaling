-- F1 del panel del manager: el motor financiero de verdad.
-- Ver docs/PLAN_PANEL_MANAGER.md.
--
-- Cinco arreglos en una sola migracion porque los cinco caen sobre la misma
-- funcion (`shopify_financial_summary`) y partirlos significaria reescribirla
-- cinco veces:
--
--   1. Ingresos SIN IVA. `net_sales` es `current_total_price - refunds`: lleva
--      dentro el IVA y el envio que paga el cliente. Lo llamabamos "facturacion
--      neta" y no lo es. El impuesto real por pedido ya viene de Shopify en
--      `current_total_tax`, asi que no hace falta `vat_pct`.
--
--   2. Envios reales. `shipping_cost_rules` existe desde DB-03 y NUNCA se ha
--      leido: el coste de envio era `default_shipping_cost x pedidos`. Y lo que
--      el cliente PAGA por el envio (`current_shipping_price`) no se agregaba,
--      asi que no habia forma de saber si el envio gana o pierde dinero.
--
--   3. Ads dentro del beneficio. `net_profit` no restaba la inversion
--      publicitaria. Con los numeros del panel de referencia daba 4.205 EUR en
--      vez de 1.810 EUR: **sobrestimaba el beneficio un 132%**, y arrastraba el
--      margen neto y el break-even. Es el fallo mas grave del motor.
--
--   4. Clientes nuevos y CAC blended. El CAC que se mostraba era el de Meta
--      (gasto de Meta / compras que Meta se atribuye). El CAC real es todo lo
--      que gastas en ads dividido entre los clientes nuevos que entraron.
--
--   5. Unit economics por pedido, MBEE y ROAS de break-even.
--
-- ADR-0021: sumar el GASTO de varias plataformas es legitimo -- es un coste
-- real facturado, no una atribucion. Lo que no se suma nunca son los ingresos
-- que cada plataforma se atribuye. Por eso `ads_spend_summary` agrega gasto y
-- el CAC blended se calcula contra clientes nuevos de Shopify (first-party),
-- no contra las compras que Meta dice haber generado.
--
-- ADR-0006 pto 6: funciones SQL `stable`, sin `security definer`, llamadas via
-- .rpc(), con el indice que calza con el predicado creado aqui mismo.

-- ---------------------------------------------------------------------------
-- Indice para el conteo de clientes nuevos
-- ---------------------------------------------------------------------------
-- El primer pedido de cada cliente se deriva agrupando por
-- customer_reference_hash sobre TODO el historico de la tienda (no solo el
-- periodo), asi que el agrupado necesita su indice.
create index if not exists shopify_order_facts_customer_hash_idx
  on public.shopify_order_facts (organization_id, store_id, customer_reference_hash);

-- ---------------------------------------------------------------------------
-- ads_spend_summary: la inversion publicitaria real del periodo
-- ---------------------------------------------------------------------------
-- Hoy solo Meta. Cuando entre Google Ads (F8 del plan) se suma aqui dentro y
-- el beneficio, el CAC blended y el panel se corrigen solos sin tocar nada mas.
--
-- Los filtros (level='ad', breakdown_hash='none') son los MISMOS que usa
-- `meta_spend_summary`, a proposito: si divergen, la tarjeta de Meta y el
-- beneficio neto mostrarian dos gastos distintos para el mismo periodo. Si
-- algun dia el sync guarda varias ventanas de atribucion por fila, las dos
-- funciones tienen que filtrar `attribution_hash` a la vez o ambas duplicaran.
drop function if exists public.ads_spend_summary(uuid, timestamptz, timestamptz, uuid);
create function public.ads_spend_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  spend numeric,
  by_platform jsonb,
  days_with_data bigint
)
language sql
stable
as $$
  with meta as (
    select
      coalesce(sum(r.spend), 0) as spend,
      count(distinct r.metric_date)::bigint as days_with_data
    from public.meta_insight_rows_daily r
    join public.meta_ad_accounts a on a.id = r.ad_account_id
    where r.organization_id = target_organization_id
      and r.level = 'ad'
      and r.breakdown_hash = 'none'
      -- store_id null en la cuenta = cuenta sin tienda asignada: cuenta para la
      -- organizacion, no para una tienda concreta.
      and (target_store_id is null or a.store_id = target_store_id)
      and (period_start is null or r.metric_date >= period_start::date)
      and r.metric_date <= period_end::date
  )
  select
    round(m.spend, 2) as spend,
    jsonb_build_object('meta', round(m.spend, 2)) as by_platform,
    m.days_with_data
  from meta m;
$$;

grant execute on function public.ads_spend_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.ads_spend_summary(uuid, timestamptz, timestamptz, uuid) is
  'Inversion publicitaria real del periodo, sumada entre plataformas conectadas '
  '(hoy solo Meta). Es GASTO, no atribucion: ADR-0021 prohibe sumar ingresos '
  'atribuidos entre plataformas, no costes facturados. by_platform lleva el '
  'desglose para que el panel pueda mostrar "Meta X + Google Y". Mismos filtros '
  'que meta_spend_summary para que las dos cifras no se contradigan.';

-- ---------------------------------------------------------------------------
-- shopify_financial_summary v2
-- ---------------------------------------------------------------------------
-- `create or replace` no sirve: cambia la lista de columnas devueltas. Se
-- borra la firma vieja primero (CLAUDE.md).
--
-- Las columnas que ya existian conservan nombre Y significado, para no romper
-- en silencio a los agentes ni al SQL gateway. En particular `net_sales` sigue
-- siendo el total con IVA y envio; el ingreso sin IVA es la columna NUEVA
-- `net_revenue_ex_tax`, y es esa la que manda en beneficio, margen y unit
-- economics.
drop function if exists public.shopify_financial_summary(uuid, timestamptz, timestamptz, uuid);
create function public.shopify_financial_summary(
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
stable
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
        and o.current_total_price >= r.min_order_total
        and (r.max_order_total is null or o.current_total_price < r.max_order_total)
      order by r.min_order_total desc
      limit 1
    ) rule on true
  ),
  sales as (
    select
      coalesce(sum(o.net_sales), 0) as net_sales,
      -- El ingreso sin IVA. `refunds` se resta entero (lleva su propio IVA
      -- dentro), asi que un pedido reembolsado queda ligeramente
      -- infravalorado; corregirlo exige traer las lineas de reembolso.
      coalesce(sum(o.current_total_price - o.refunds - o.current_total_tax), 0) as net_revenue_ex_tax,
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
                  least(coalesce(fe.valid_until::timestamptz, p.effective_end), p.effective_end)
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
            where fe.valid_from <= current_date
              and (fe.valid_until is null or fe.valid_until >= current_date)
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
      round(
        s.net_revenue_ex_tax * coalesce(st.payment_fee_pct, 0) / 100
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

grant execute on function public.shopify_financial_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_financial_summary(uuid, timestamptz, timestamptz, uuid) is
  'Motor financiero del panel. El ingreso que manda es net_revenue_ex_tax '
  '(current_total_price - refunds - current_total_tax): net_sales se conserva '
  'con su significado antiguo (con IVA y envio cobrado) para no romper a los '
  'agentes. net_profit resta COGS, comisiones, envio real por tramo, fijos '
  'prorrateados Y la inversion en ads -- antes los ads faltaban y el beneficio '
  'salia inflado. El CAC blended se calcula contra clientes nuevos derivados de '
  'customer_reference_hash, no contra la atribucion de Meta (ADR-0021) ni '
  'contra is_first_customer_order (el webhook no la escribe). breakeven_roas y '
  'mbee comparten techo: breakeven_cac_per_order.';
;
