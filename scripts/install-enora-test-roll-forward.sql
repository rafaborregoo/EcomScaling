-- TEST ONLY: E-NORA synthetic rolling seed installer.
-- Target: TEST ES IA / prueba-borrego / e-nora-demo.myshopify.com.
-- This is intentionally NOT a production migration.
--
-- The function appends missing synthetic day buckets by cloning the same
-- weekday from the prior week, applies a deterministic factor, then
-- recalculates Meta/Klaviyo attribution against the newly-created Shopify
-- orders. It never calls Shopify, Meta or Klaviyo provider APIs.

create extension if not exists pg_cron;

CREATE OR REPLACE FUNCTION private.enora_synthetic_roll_forward()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_org uuid;
  v_store uuid;
  v_meta_account uuid;
  v_klaviyo_account uuid;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_start date;
  v_day date;
  v_source_day date;
  v_factor numeric;
  v_source_session public.shopify_sessions_daily%rowtype;
  v_order_count integer;
  v_days_written integer := 0;
  v_email_campaign text;
  v_month_start date;
  v_period_end date;
begin
  select o.id into strict v_org
  from public.organizations o
  where o.slug = 'prueba-borrego';

  select s.id into strict v_store
  from public.shopify_stores s
  join public.integration_connections ic on ic.id = s.connection_id
  where s.organization_id = v_org
    and s.myshopify_domain = 'e-nora-demo.myshopify.com'
    and ic.provider = 'shopify'
    and ic.status = 'connected';

  select a.id into strict v_meta_account
  from public.meta_ad_accounts a
  join public.integration_connections ic on ic.id = a.connection_id
  where a.organization_id = v_org
    and a.store_id = v_store
    and a.external_ad_account_id = 'act_946548861093802'
    and ic.provider = 'meta_ads'
    and ic.status = 'connected';

  select a.id into strict v_klaviyo_account
  from public.klaviyo_accounts a
  join public.integration_connections ic on ic.id = a.connection_id
  where a.organization_id = v_org
    and a.store_id = v_store
    and a.external_account_id = 'WjvTcC'
    and ic.provider = 'klaviyo'
    and ic.status = 'connected';

  select greatest(
           coalesce(
             max(s.bucket_date) filter (
               where s.raw->>'scenario_id' = 'enora_12m_v1'
             ) + 1,
             date '2026-10-04'
           ),
           date '2026-10-04'
         )
    into v_start
  from public.shopify_sessions_daily s
  where s.organization_id = v_org
    and s.store_id = v_store;

  if v_start > v_today then
    return jsonb_build_object(
      'status','up_to_date',
      'through',v_today,
      'days_written',0
    );
  end if;

  for v_day in
    select gs::date
    from generate_series(v_start, v_today, interval '1 day') gs
  loop
    if exists (
      select 1
      from public.shopify_sessions_daily s
      where s.organization_id = v_org
        and s.store_id = v_store
        and s.bucket_date = v_day
        and coalesce(s.raw->>'scenario_id','') <> 'enora_12m_v1'
    ) then
      raise exception 'ENORA_SYNTHETIC_PROVIDER_DAY_COLLISION:%', v_day;
    end if;

    if exists (
      select 1
      from public.shopify_sessions_daily s
      where s.organization_id = v_org
        and s.store_id = v_store
        and s.bucket_date = v_day
        and s.raw->>'scenario_id' = 'enora_12m_v1'
    ) then
      continue;
    end if;

    v_source_day := v_day - 7;
    select s.* into strict v_source_session
    from public.shopify_sessions_daily s
    where s.organization_id = v_org
      and s.store_id = v_store
      and s.bucket_date = v_source_day
      and s.raw->>'scenario_id' = 'enora_12m_v1';

    v_factor := 0.96 + ((abs(hashtextextended(v_day::text, 991)) % 9)::numeric / 100);

    select count(*)::int into v_order_count
    from public.shopify_order_facts o
    where o.organization_id = v_org
      and o.store_id = v_store
      and o.external_order_id like 'syn_order_%'
      and (o.processed_at at time zone 'Europe/Madrid')::date = v_source_day;

    insert into public.shopify_sessions_daily (
      id,organization_id,store_id,bucket_date,sessions,online_store_visitors,
      conversion_rate,raw,sessions_with_cart_additions,
      sessions_that_reached_checkout,sessions_that_completed_checkout
    )
    values (
      md5('enora_12m_v1:target:shopify:sessions:'||v_day::text)::uuid,
      v_org,
      v_store,
      v_day,
      greatest(v_order_count,round(v_source_session.sessions*v_factor))::int,
      greatest(1,round(v_source_session.online_store_visitors*v_factor))::int,
      v_order_count::numeric / nullif(greatest(v_order_count,round(v_source_session.sessions*v_factor)),0),
      coalesce(v_source_session.raw,'{}'::jsonb) || jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'scenario','rolling_weekly_clone',
        'rolling_source_date',v_source_day,
        'rolling_factor',v_factor,
        'normalized_timezone','Europe/Madrid'
      ),
      greatest(v_order_count,round(v_source_session.sessions_with_cart_additions*v_factor))::int,
      greatest(v_order_count,round(v_source_session.sessions_that_reached_checkout*v_factor))::int,
      v_order_count
    )
    on conflict (store_id,bucket_date) do update set
      sessions=excluded.sessions,
      online_store_visitors=excluded.online_store_visitors,
      conversion_rate=excluded.conversion_rate,
      raw=excluded.raw,
      sessions_with_cart_additions=excluded.sessions_with_cart_additions,
      sessions_that_reached_checkout=excluded.sessions_that_reached_checkout,
      sessions_that_completed_checkout=excluded.sessions_that_completed_checkout,
      updated_at=now();

    with src as (
      select
        o.*,
        right(o.external_order_id,4) as suffix,
        'syn_order_'||to_char(v_day,'YYYYMMDD')||'_'||right(o.external_order_id,4) as target_external_order_id,
        (
          v_day
          + (o.processed_at at time zone 'Europe/Madrid')::time
        ) at time zone 'Europe/Madrid' as target_ts
      from public.shopify_order_facts o
      where o.organization_id=v_org
        and o.store_id=v_store
        and o.external_order_id like 'syn_order_%'
        and (o.processed_at at time zone 'Europe/Madrid')::date=v_source_day
    ),
    ranked as (
      select
        s.*,
        coalesce((
          select count(*)
          from public.shopify_order_facts prior
          where prior.organization_id=v_org
            and prior.store_id=v_store
            and prior.external_order_id like 'syn_order_%'
            and prior.customer_reference_hash=s.customer_reference_hash
            and (prior.processed_at at time zone 'Europe/Madrid')::date < v_day
        ),0)
        + row_number() over (
            partition by s.customer_reference_hash
            order by s.target_ts,s.target_external_order_id
          ) as target_customer_order_index
      from src s
    )
    insert into public.shopify_order_facts (
      id,organization_id,store_id,external_order_id,order_name,
      customer_reference_hash,financial_status,fulfillment_status,source_name,
      currency_code,presentment_currency_code,gross_sales,discounts,refunds,
      net_sales,current_subtotal_price,current_shipping_price,current_total_tax,
      current_total_price,total_items,is_first_customer_order,is_test_order,
      external_created_at,processed_at,external_updated_at,cancelled_at,cancel_reason,
      customer_order_index,days_to_conversion,first_visit_source,first_visit_source_type,
      first_visit_landing_page,first_visit_referrer_url,first_visit_utm_source,
      first_visit_utm_medium,first_visit_utm_campaign,first_visit_at,
      last_visit_source,last_visit_source_type,tags,risk_level,
      payment_gateway_names,return_status,journey_checked_at,
      shipping_country_code,shipping_region_code
    )
    select
      md5('enora_12m_v1:target:shopify:order:'||target_external_order_id)::uuid,
      v_org,
      v_store,
      target_external_order_id,
      '#SYN-'||to_char(v_day,'YYYYMMDD')||'-'||suffix,
      customer_reference_hash,
      financial_status,
      fulfillment_status,
      source_name,
      currency_code,
      presentment_currency_code,
      gross_sales,
      discounts,
      refunds,
      net_sales,
      current_subtotal_price,
      current_shipping_price,
      current_total_tax,
      current_total_price,
      total_items,
      target_customer_order_index=1,
      false,
      target_ts,
      target_ts,
      target_ts,
      null,
      null,
      target_customer_order_index,
      days_to_conversion,
      first_visit_source,
      first_visit_source_type,
      case
        when first_visit_utm_source='klaviyo' then
          regexp_replace(
            first_visit_landing_page,
            'utm_campaign=enora_email_[0-9]{6}_promo',
            'utm_campaign=enora_email_'||to_char(v_day,'YYYYMM')||'_promo'
          )
        else first_visit_landing_page
      end,
      first_visit_referrer_url,
      first_visit_utm_source,
      first_visit_utm_medium,
      case
        when first_visit_utm_source='klaviyo'
          then 'enora_email_'||to_char(v_day,'YYYYMM')||'_promo'
        else first_visit_utm_campaign
      end,
      target_ts,
      last_visit_source,
      last_visit_source_type,
      tags,
      risk_level,
      payment_gateway_names,
      return_status,
      target_ts,
      shipping_country_code,
      shipping_region_code
    from ranked
    on conflict (store_id,external_order_id) do update set
      customer_reference_hash=excluded.customer_reference_hash,
      gross_sales=excluded.gross_sales,
      discounts=excluded.discounts,
      refunds=excluded.refunds,
      net_sales=excluded.net_sales,
      current_subtotal_price=excluded.current_subtotal_price,
      current_shipping_price=excluded.current_shipping_price,
      current_total_tax=excluded.current_total_tax,
      current_total_price=excluded.current_total_price,
      total_items=excluded.total_items,
      customer_order_index=excluded.customer_order_index,
      is_first_customer_order=excluded.is_first_customer_order,
      processed_at=excluded.processed_at,
      first_visit_landing_page=excluded.first_visit_landing_page,
      first_visit_utm_campaign=excluded.first_visit_utm_campaign,
      first_visit_at=excluded.first_visit_at,
      updated_at=now();

    with src_orders as (
      select
        so.id source_order_id,
        'syn_order_'||to_char(v_day,'YYYYMMDD')||'_'||right(so.external_order_id,4) target_external_order_id
      from public.shopify_order_facts so
      where so.organization_id=v_org
        and so.store_id=v_store
        and so.external_order_id like 'syn_order_%'
        and (so.processed_at at time zone 'Europe/Madrid')::date=v_source_day
    )
    insert into public.shopify_order_items (
      id,organization_id,order_id,product_id,variant_id,external_line_item_id,
      title,sku_snapshot,vendor_snapshot,quantity_original,quantity_current,
      unit_price,original_line_total,discount_total,current_line_total,
      refunded_quantity,refunded_amount,bundle_group_coverage,bundle_group_id,
      bundle_parent_title,bundle_parent_external_product_id,
      bundle_parent_external_variant_id,bundle_parent_quantity,
      net_quantity,net_revenue,net_metrics_source
    )
    select
      md5('enora_12m_v1:target:shopify:item:'||s.target_external_order_id||':line:1')::uuid,
      v_org,
      md5('enora_12m_v1:target:shopify:order:'||s.target_external_order_id)::uuid,
      i.product_id,
      i.variant_id,
      s.target_external_order_id||':line:1',
      i.title,
      i.sku_snapshot,
      i.vendor_snapshot,
      i.quantity_original,
      i.quantity_current,
      i.unit_price,
      i.original_line_total,
      i.discount_total,
      i.current_line_total,
      i.refunded_quantity,
      i.refunded_amount,
      i.bundle_group_coverage,
      i.bundle_group_id,
      i.bundle_parent_title,
      i.bundle_parent_external_product_id,
      i.bundle_parent_external_variant_id,
      i.bundle_parent_quantity,
      i.net_quantity,
      i.net_revenue,
      i.net_metrics_source
    from src_orders s
    join public.shopify_order_items i on i.order_id=s.source_order_id
    on conflict (order_id,external_line_item_id) do update set
      product_id=excluded.product_id,
      variant_id=excluded.variant_id,
      quantity_original=excluded.quantity_original,
      quantity_current=excluded.quantity_current,
      unit_price=excluded.unit_price,
      original_line_total=excluded.original_line_total,
      discount_total=excluded.discount_total,
      current_line_total=excluded.current_line_total,
      net_quantity=excluded.net_quantity,
      net_revenue=excluded.net_revenue,
      updated_at=now();

    with agg as (
      select
        c.id,
        count(o.id)::int as order_count,
        coalesce(sum(o.net_sales),0) as amount_spent,
        max(o.processed_at) as last_order_at
      from public.shopify_customers c
      left join public.shopify_order_facts o
        on o.organization_id=c.organization_id
       and o.store_id=c.store_id
       and o.customer_reference_hash=c.customer_reference_hash
       and o.external_order_id like 'syn_order_%'
      where c.organization_id=v_org
        and c.store_id=v_store
        and c.external_customer_id like 'syn_customer_%'
      group by c.id
    )
    update public.shopify_customers c
    set number_of_orders=agg.order_count,
        amount_spent=agg.amount_spent,
        last_order_at=agg.last_order_at,
        updated_at=now()
    from agg
    where c.id=agg.id;

    with src as (
      select i.*
      from public.meta_insight_rows_daily i
      where i.organization_id=v_org
        and i.ad_account_id=v_meta_account
        and i.metric_date=v_source_day
        and i.raw_data->>'scenario_id'='enora_12m_v1'
    ),
    attributed as (
      select
        replace(o.first_visit_utm_campaign,'enora_meta_','') campaign_key,
        count(*)::numeric purchases,
        coalesce(sum(o.net_sales),0)::numeric revenue
      from public.shopify_order_facts o
      where o.organization_id=v_org
        and o.store_id=v_store
        and o.external_order_id like 'syn_order_%'
        and (o.processed_at at time zone 'Europe/Madrid')::date=v_day
        and o.first_visit_utm_source='facebook'
      group by 1
    ),
    calc as (
      select
        s.*,
        replace(s.external_entity_id,'synthetic:meta:ad:','') campaign_key,
        greatest(1,round(s.impressions*v_factor))::bigint n_impressions,
        greatest(1,round(s.reach*v_factor))::bigint n_reach,
        greatest(1,round(s.clicks*v_factor))::bigint n_clicks,
        greatest(1,round(s.inline_link_clicks*v_factor))::bigint n_link_clicks,
        greatest(1,round(s.outbound_clicks*v_factor))::bigint n_outbound_clicks,
        round(s.spend*v_factor,2) n_spend,
        coalesce(a.purchases,0) purchases,
        coalesce(a.revenue,0) revenue,
        greatest(
          coalesce(a.purchases,0)::bigint,
          round(coalesce((s.raw_data->>'landing_page_views')::numeric,0)*v_factor)::bigint
        ) lpv,
        greatest(
          coalesce(a.purchases,0)::bigint,
          round(coalesce((s.raw_data->>'add_to_carts')::numeric,0)*v_factor)::bigint
        ) atc,
        greatest(
          coalesce(a.purchases,0)::bigint,
          round(coalesce((s.raw_data->>'checkouts')::numeric,0)*v_factor)::bigint
        ) checkouts
      from src s
      left join attributed a
        on a.campaign_key=replace(s.external_entity_id,'synthetic:meta:ad:','')
    )
    insert into public.meta_insight_rows_daily (
      id,organization_id,ad_account_id,campaign_id,ad_set_id,ad_id,
      level,external_entity_id,metric_date,publisher_platform,platform_position,
      device_platform,breakdowns,breakdown_hash,attribution_windows,attribution_hash,
      action_report_time,spend,impressions,reach,frequency,clicks,unique_clicks,
      inline_link_clicks,outbound_clicks,cpm,cpc,ctr,cpp,raw_data,synced_at,
      outbound_clicks_ctr,unique_inline_link_clicks,inline_link_click_ctr,
      cost_per_inline_link_click,attribution_setting
    )
    select
      md5('enora_12m_v1:target:meta:rolling-insight:'||external_entity_id||':'||v_day::text)::uuid,
      v_org,
      v_meta_account,
      campaign_id,
      ad_set_id,
      ad_id,
      level,
      external_entity_id,
      v_day,
      publisher_platform,
      platform_position,
      device_platform,
      breakdowns,
      breakdown_hash,
      attribution_windows,
      attribution_hash,
      action_report_time,
      n_spend,
      n_impressions,
      n_reach,
      round(n_impressions::numeric/nullif(n_reach,0),6),
      n_clicks,
      greatest(1,round(n_clicks*0.86))::bigint,
      least(n_clicks,n_link_clicks),
      least(n_link_clicks,n_outbound_clicks),
      round((n_spend/nullif(n_impressions,0))*1000,6),
      round(n_spend/nullif(n_clicks,0),6),
      round((n_clicks::numeric/nullif(n_impressions,0))*100,6),
      cpp,
      coalesce(raw_data,'{}'::jsonb) || jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'scenario','rolling_weekly_clone',
        'rolling_source_date',v_source_day,
        'rolling_factor',v_factor,
        'landing_page_views',lpv,
        'add_to_carts',atc,
        'checkouts',checkouts,
        'purchases',purchases,
        'attributed_revenue',revenue
      ),
      now(),
      round((least(n_link_clicks,n_outbound_clicks)::numeric/nullif(n_impressions,0))*100,6),
      greatest(1,round(least(n_clicks,n_link_clicks)*0.88))::bigint,
      round((least(n_clicks,n_link_clicks)::numeric/nullif(n_impressions,0))*100,6),
      round(n_spend/nullif(least(n_clicks,n_link_clicks),0),6),
      attribution_setting
    from calc
    on conflict (
      ad_account_id,level,external_entity_id,metric_date,
      breakdown_hash,attribution_hash,action_report_time
    ) do update set
      spend=excluded.spend,
      impressions=excluded.impressions,
      reach=excluded.reach,
      frequency=excluded.frequency,
      clicks=excluded.clicks,
      unique_clicks=excluded.unique_clicks,
      inline_link_clicks=excluded.inline_link_clicks,
      outbound_clicks=excluded.outbound_clicks,
      cpm=excluded.cpm,
      cpc=excluded.cpc,
      ctr=excluded.ctr,
      raw_data=excluded.raw_data,
      synced_at=now(),
      updated_at=now();

    with i as (
      select *
      from public.meta_insight_rows_daily
      where organization_id=v_org
        and ad_account_id=v_meta_account
        and metric_date=v_day
        and raw_data->>'scenario_id'='enora_12m_v1'
    ),
    m as (
      select id insight_id,'actions'::text metric_name,'landing_page_view'::text action_type,
             (raw_data->>'landing_page_views')::numeric value from i
      union all
      select id,'actions','add_to_cart',(raw_data->>'add_to_carts')::numeric from i
      union all
      select id,'actions','initiate_checkout',(raw_data->>'checkouts')::numeric from i
      union all
      select id,'actions','omni_purchase',(raw_data->>'purchases')::numeric from i
      union all
      select id,'action_values','omni_purchase',(raw_data->>'attributed_revenue')::numeric from i
    )
    insert into public.meta_insight_action_metrics (
      id,organization_id,insight_row_id,metric_name,action_type,
      attribution_window,value,raw_value
    )
    select
      md5('enora_12m_v1:target:meta:rolling-action:'||insight_id::text||':'||metric_name||':'||action_type)::uuid,
      v_org,insight_id,metric_name,action_type,'7d_click_1d_view',value,
      jsonb_build_object('source','synthetic','scenario_id','enora_12m_v1')
    from m
    on conflict (insight_row_id,metric_name,action_type,attribution_window)
    do update set value=excluded.value,raw_value=excluded.raw_value,updated_at=now();

    with i as (
      select
        id,
        spend::numeric spend,
        impressions::numeric impressions,
        reach::numeric reach,
        clicks::numeric clicks,
        coalesce((raw_data->>'purchases')::numeric,0) purchases,
        coalesce((raw_data->>'attributed_revenue')::numeric,0) revenue
      from public.meta_insight_rows_daily
      where organization_id=v_org
        and ad_account_id=v_meta_account
        and metric_date=v_day
        and raw_data->>'scenario_id'='enora_12m_v1'
    ),
    m as (
      select id,'frequency' code,impressions/nullif(reach,0) val,'impressions / reach' formula from i
      union all select id,'ctr',(clicks/nullif(impressions,0))*100,'(clicks / impressions) * 100' from i
      union all select id,'cpc',spend/nullif(clicks,0),'spend / clicks' from i
      union all select id,'cpm',(spend/nullif(impressions,0))*1000,'(spend / impressions) * 1000' from i
      union all select id,'cpa',spend/nullif(purchases,0),'spend / purchases' from i
      union all select id,'roas',revenue/nullif(spend,0),'attributed_revenue / spend' from i
    )
    insert into public.meta_calculated_metrics_daily (
      id,organization_id,insight_row_id,metric_code,value,
      formula_code,formula_version,input_data
    )
    select
      md5('enora_12m_v1:target:meta:rolling-calculated:'||id::text||':'||code)::uuid,
      v_org,id,code,round(val,8),formula,'enora-synthetic-v1',
      jsonb_build_object('source','synthetic','scenario_id','enora_12m_v1')
    from m
    on conflict (insight_row_id,metric_code,formula_version)
    do update set
      value=excluded.value,
      formula_code=excluded.formula_code,
      input_data=excluded.input_data,
      calculated_at=now();

    v_email_campaign := 'enora_email_'||to_char(v_day,'YYYYMM')||'_promo';

    insert into public.klaviyo_campaigns (
      id,organization_id,account_id,external_campaign_id,name,status,
      send_time,raw_data,last_synced_at,created_at_external,updated_at_external
    )
    values (
      md5('enora_12m_v1:target:klaviyo:campaign:synthetic:'||v_email_campaign)::uuid,
      v_org,
      v_klaviyo_account,
      'synthetic:'||v_email_campaign,
      'E-NORA · '||replace(v_email_campaign,'_',' '),
      'draft',
      null,
      jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'provider_status','draft',
        'historical_performance_is_simulated',true,
        'provider_messages_sent',false
      ),
      now(),now(),now()
    )
    on conflict (account_id,external_campaign_id) do update set
      status='draft',send_time=null,raw_data=excluded.raw_data,last_synced_at=now(),updated_at=now();

    insert into public.klaviyo_campaign_messages (
      id,organization_id,campaign_id,external_message_id,channel,name,label,
      subject,preview_text,status,raw_data,last_synced_at
    )
    values (
      md5('enora_12m_v1:target:klaviyo:message:synthetic:'||v_email_campaign)::uuid,
      v_org,
      md5('enora_12m_v1:target:klaviyo:campaign:synthetic:'||v_email_campaign)::uuid,
      'synthetic:message:'||v_email_campaign,
      'email',
      'E-NORA Email '||to_char(v_day,'YYYYMM'),
      'Synthetic rolling message',
      case extract(month from v_day)::int
        when 11 then 'Black Friday: tus favoritos de E-NORA'
        when 12 then 'Últimos días para regalar E-NORA'
        when 1 then 'Empieza el año con algo nuevo'
        when 2 then '¿Cuál es tu próximo básico?'
        when 3 then 'Vuelve a tus favoritos'
        when 4 then 'Novedades que combinan contigo'
        when 5 then 'Lo más elegido este mes'
        when 6 then 'Verano E-NORA: selección ligera'
        when 7 then 'Tus esenciales de verano'
        when 8 then 'Últimos favoritos del verano'
        when 9 then 'Vuelta a la rutina, sin complicaciones'
        else 'Descubre lo nuevo de E-NORA'
      end,
      'Selección sintética para probar analítica de email.',
      'draft',
      jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'definition',jsonb_build_object(
          'content',jsonb_build_object(
            'subject',case extract(month from v_day)::int
              when 11 then 'Black Friday: tus favoritos de E-NORA'
              when 12 then 'Últimos días para regalar E-NORA'
              when 1 then 'Empieza el año con algo nuevo'
              when 2 then '¿Cuál es tu próximo básico?'
              when 3 then 'Vuelve a tus favoritos'
              when 4 then 'Novedades que combinan contigo'
              when 5 then 'Lo más elegido este mes'
              when 6 then 'Verano E-NORA: selección ligera'
              when 7 then 'Tus esenciales de verano'
              when 8 then 'Últimos favoritos del verano'
              when 9 then 'Vuelta a la rutina, sin complicaciones'
              else 'Descubre lo nuevo de E-NORA'
            end
          )
        )
      ),
      now()
    )
    on conflict (campaign_id,external_message_id) do update set
      subject=excluded.subject,
      preview_text=excluded.preview_text,
      status='draft',
      raw_data=excluded.raw_data,
      last_synced_at=now(),
      updated_at=now();

    with src as (
      select metric_id,metric_name,value,currency_code
      from public.klaviyo_daily_account_metrics
      where account_id=v_klaviyo_account
        and metric_date=v_source_day
        and raw_data->>'scenario_id'='enora_12m_v1'
    ),
    email_orders as (
      select
        count(*)::numeric purchases,
        coalesce(sum(net_sales),0)::numeric revenue
      from public.shopify_order_facts
      where organization_id=v_org
        and store_id=v_store
        and external_order_id like 'syn_order_%'
        and (processed_at at time zone 'Europe/Madrid')::date=v_day
        and first_visit_utm_source='klaviyo'
    )
    insert into public.klaviyo_daily_account_metrics (
      id,organization_id,account_id,metric_date,metric_id,metric_name,
      value,currency_code,source,raw_data
    )
    select
      md5('enora_12m_v1:target:klaviyo:daily:'||v_day::text||':'||replace(metric_id,'synthetic:',''))::uuid,
      v_org,
      v_klaviyo_account,
      v_day,
      metric_id,
      metric_name,
      case
        when metric_id='synthetic:purchases' then e.purchases
        when metric_id='synthetic:attributed_revenue' then e.revenue
        else round(src.value*v_factor)
      end,
      currency_code,
      'synthetic',
      jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'scenario','rolling_weekly_clone',
        'rolling_source_date',v_source_day,
        'rolling_factor',v_factor,
        'campaign_key',v_email_campaign,
        'full_aggregate',true
      )
    from src cross join email_orders e
    on conflict (account_id,metric_date,metric_id) do update set
      value=excluded.value,
      currency_code=excluded.currency_code,
      source='synthetic',
      raw_data=excluded.raw_data;

    with email_orders as (
      select
        o.external_order_id,
        o.processed_at,
        o.net_sales,
        o.first_visit_utm_campaign,
        c.external_customer_id,
        i.sku_snapshot,
        p.external_product_id,
        v.external_variant_id,
        p.handle
      from public.shopify_order_facts o
      join public.shopify_customers c
        on c.organization_id=o.organization_id
       and c.store_id=o.store_id
       and c.customer_reference_hash=o.customer_reference_hash
      join public.shopify_order_items i on i.order_id=o.id
      left join public.shopify_products p on p.id=i.product_id
      left join public.shopify_variants v on v.id=i.variant_id
      where o.organization_id=v_org
        and o.store_id=v_store
        and o.external_order_id like 'syn_order_%'
        and (o.processed_at at time zone 'Europe/Madrid')::date=v_day
        and o.first_visit_utm_source='klaviyo'
    )
    insert into public.klaviyo_tracking_events (
      id,organization_id,account_id,profile_id,event_name,source,
      source_event_id,dedupe_key,occurred_at,value,currency_code,properties,raw_data
    )
    select
      md5('enora_12m_v1:target:klaviyo:event:order:'||external_order_id)::uuid,
      v_org,
      v_klaviyo_account,
      md5('enora_12m_v1:target:klaviyo:profile:synthetic_profile_'||right(external_customer_id,4))::uuid,
      'Placed Order',
      'manual',
      external_order_id,
      md5('enora_12m_v1:rolling:placed-order:'||external_order_id),
      processed_at,
      net_sales,
      'EUR',
      jsonb_build_object(
        'order_id',external_order_id,
        'product_id',external_product_id,
        'variant_id',external_variant_id,
        'sku',sku_snapshot,
        'utm_source','klaviyo',
        'utm_medium','email',
        'utm_campaign',first_visit_utm_campaign,
        'source','synthetic',
        'scenario_id','enora_12m_v1'
      ),
      jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'campaign_external_id','synthetic:'||first_visit_utm_campaign
      )
    from email_orders
    on conflict (account_id,dedupe_key) do update set
      value=excluded.value,
      properties=excluded.properties,
      raw_data=excluded.raw_data;

    with email_orders as (
      select
        o.external_order_id,
        o.processed_at,
        o.first_visit_utm_campaign,
        c.external_customer_id,
        p.handle
      from public.shopify_order_facts o
      join public.shopify_customers c
        on c.organization_id=o.organization_id
       and c.store_id=o.store_id
       and c.customer_reference_hash=o.customer_reference_hash
      join public.shopify_order_items i on i.order_id=o.id
      left join public.shopify_products p on p.id=i.product_id
      where o.organization_id=v_org
        and o.store_id=v_store
        and o.external_order_id like 'syn_order_%'
        and (o.processed_at at time zone 'Europe/Madrid')::date=v_day
        and o.first_visit_utm_source='klaviyo'
    )
    insert into public.klaviyo_tracking_events (
      id,organization_id,account_id,profile_id,event_name,source,
      source_event_id,dedupe_key,occurred_at,properties,raw_data
    )
    select
      md5('enora_12m_v1:target:klaviyo:event:click:'||external_order_id)::uuid,
      v_org,
      v_klaviyo_account,
      md5('enora_12m_v1:target:klaviyo:profile:synthetic_profile_'||right(external_customer_id,4))::uuid,
      'Clicked Email',
      'manual',
      'synthetic:email-click:'||external_order_id,
      md5('enora_12m_v1:rolling:email-click:'||external_order_id),
      processed_at - interval '15 minutes',
      jsonb_build_object(
        'order_id',external_order_id,
        'utm_source','klaviyo',
        'utm_medium','email',
        'utm_campaign',first_visit_utm_campaign,
        'source','synthetic',
        'scenario_id','enora_12m_v1'
      ),
      jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'campaign_external_id','synthetic:'||first_visit_utm_campaign
      )
    from email_orders
    on conflict (account_id,dedupe_key) do update set
      properties=excluded.properties,
      raw_data=excluded.raw_data;

    with email_orders as (
      select
        o.external_order_id,
        o.processed_at,
        o.first_visit_utm_campaign,
        c.external_customer_id,
        p.handle
      from public.shopify_order_facts o
      join public.shopify_customers c
        on c.organization_id=o.organization_id
       and c.store_id=o.store_id
       and c.customer_reference_hash=o.customer_reference_hash
      join public.shopify_order_items i on i.order_id=o.id
      left join public.shopify_products p on p.id=i.product_id
      where o.organization_id=v_org
        and o.store_id=v_store
        and o.external_order_id like 'syn_order_%'
        and (o.processed_at at time zone 'Europe/Madrid')::date=v_day
        and o.first_visit_utm_source='klaviyo'
    )
    insert into public.klaviyo_email_click_events (
      id,organization_id,account_id,external_event_id,occurred_at,url,
      external_message_id,external_profile_id,raw_data
    )
    select
      md5('enora_12m_v1:target:klaviyo:click:'||external_order_id)::uuid,
      v_org,
      v_klaviyo_account,
      'synthetic:click:'||external_order_id,
      processed_at - interval '15 minutes',
      'https://synthetic.enora.invalid/products/'||handle||
        '?utm_source=klaviyo&utm_medium=email&utm_campaign='||
        first_visit_utm_campaign||'&utm_content=primary_cta',
      'synthetic:message:'||first_visit_utm_campaign,
      'synthetic_profile_'||right(external_customer_id,4),
      jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'order_id',external_order_id
      )
    from email_orders
    on conflict (account_id,external_event_id) do update set
      occurred_at=excluded.occurred_at,
      url=excluded.url,
      external_message_id=excluded.external_message_id,
      external_profile_id=excluded.external_profile_id,
      raw_data=excluded.raw_data;

    v_month_start := date_trunc('month',v_day)::date;

    select max(metric_date)+1 into v_period_end
    from public.klaviyo_daily_account_metrics
    where account_id=v_klaviyo_account
      and metric_date>=v_month_start
      and metric_date<=v_day
      and raw_data->>'scenario_id'='enora_12m_v1';

    insert into public.klaviyo_report_runs (
      id,organization_id,account_id,report_type,status,error_message,started_at,
      idempotency_key,period_start,period_end,timezone,currency_code,finished_at
    )
    values (
      md5('enora_12m_v1:target:klaviyo:report:'||to_char(v_month_start,'YYYYMM'))::uuid,
      v_org,
      v_klaviyo_account,
      'campaign_values',
      'completed',
      null,
      now(),
      'synthetic:enora_12m_v1:'||to_char(v_month_start,'YYYYMM'),
      v_month_start,
      v_period_end,
      'Europe/Madrid',
      'EUR',
      now()
    )
    on conflict (account_id,idempotency_key) do update set
      status='completed',
      period_start=excluded.period_start,
      period_end=excluded.period_end,
      timezone=excluded.timezone,
      currency_code=excluded.currency_code,
      finished_at=now();

    with agg as (
      select
        sum(value) filter (where metric_id='synthetic:recipients') recipients,
        sum(value) filter (where metric_id='synthetic:delivered') delivered,
        sum(value) filter (where metric_id='synthetic:opens') opens_unique,
        sum(value) filter (where metric_id='synthetic:clicks') clicks_unique,
        sum(value) filter (where metric_id='synthetic:unsubscribes') unsubscribes,
        sum(value) filter (where metric_id='synthetic:bounces') bounced,
        sum(value) filter (where metric_id='synthetic:purchases') conversions,
        sum(value) filter (where metric_id='synthetic:attributed_revenue') revenue
      from public.klaviyo_daily_account_metrics
      where account_id=v_klaviyo_account
        and metric_date>=v_month_start
        and metric_date<v_period_end
        and raw_data->>'scenario_id'='enora_12m_v1'
    )
    insert into public.klaviyo_report_values (
      id,organization_id,report_run_id,entity_type,external_entity_id,
      period_start,period_end,raw_data,entity_name,metric_id,conversions,revenue,
      currency_code,external_message_id,variation_id,variation_name
    )
    select
      md5('enora_12m_v1:target:klaviyo:report-value:synthetic:'||v_email_campaign||':'||v_month_start::text)::uuid,
      v_org,
      md5('enora_12m_v1:target:klaviyo:report:'||to_char(v_month_start,'YYYYMM'))::uuid,
      'campaign',
      'synthetic:'||v_email_campaign,
      v_month_start,
      v_period_end,
      jsonb_build_object(
        'source','synthetic',
        'scenario_id','enora_12m_v1',
        'statistics',jsonb_build_object(
          'recipients',coalesce(recipients,0),
          'delivered',coalesce(delivered,0),
          'opens_unique',coalesce(opens_unique,0),
          'clicks_unique',coalesce(clicks_unique,0),
          'unsubscribes',coalesce(unsubscribes,0),
          'bounced',coalesce(bounced,0),
          'spam_complaints',0,
          'conversion_uniques',coalesce(conversions,0),
          'conversion_value',coalesce(revenue,0)
        )
      ),
      'E-NORA · '||replace(v_email_campaign,'_',' '),
      'synthetic:email_report',
      coalesce(conversions,0),
      coalesce(revenue,0),
      'EUR',
      'synthetic:message:'||v_email_campaign,
      '',
      ''
    from agg
    on conflict (id) do update set
      period_end=excluded.period_end,
      raw_data=excluded.raw_data,
      entity_name=excluded.entity_name,
      conversions=excluded.conversions,
      revenue=excluded.revenue,
      currency_code=excluded.currency_code;

    v_days_written := v_days_written + 1;
  end loop;

  return jsonb_build_object(
    'status','ok',
    'through',v_today,
    'days_written',v_days_written
  );
end
$function$;

revoke all on function private.enora_synthetic_roll_forward()
from public, anon, authenticated;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname='enora-synthetic-roll-forward-hourly'
  ) then
    perform cron.unschedule('enora-synthetic-roll-forward-hourly');
  end if;
end $$;

select cron.schedule(
  'enora-synthetic-roll-forward-hourly',
  '17 * * * *',
  $$select private.enora_synthetic_roll_forward();$$
);
