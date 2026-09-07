-- Sesiones y tasa de conversión de Shopify (bloque de sync `sessions`).
--
-- Por qué: hasta ahora el módulo Shopify solo tenía el lado de pedidos. Sin
-- sesiones no hay tasa de conversión y no se puede medir el embudo: el
-- consultor veía "cuánto se vendió" pero no "cuánta gente entró". El dato sale
-- de ShopifyQL (`shopifyqlQuery`, schema `sessions`), que exige el scope
-- `read_reports`; las conexiones creadas antes de añadirlo tienen que
-- reautorizarse.
--
-- ADR-0006:
--  1. Estado actual = esta tabla con upsert in-place (unique store_id+fecha),
--     nunca append-only leído con DISTINCT ON. Shopify revisa el dato de
--     analítica de días recientes, así que reimportar un día lo corrige.
--  6. Métricas = funciones SQL `stable`, sin `security definer`, vía .rpc(),
--     con el índice que calza con el predicado de fecha creado aquí mismo.
--  7. Escrituras por SUPABASE_SERVICE_ROLE_KEY; la RLS solo permite `select`.

create table public.shopify_sessions_daily (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  store_id uuid not null references public.shopify_stores (id) on delete cascade,
  bucket_date date not null,
  sessions integer not null default 0,
  online_store_visitors integer not null default 0,
  -- Tasa que reporta Shopify (0-1). Nullable: no siempre viene en la respuesta.
  conversion_rate numeric(8, 5),
  -- Respuesta cruda de la fila para no perder columnas que ShopifyQL devuelva
  -- y todavía no modelemos (ADR-0006 pto 8: que se vea si el supuesto falla).
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shopify_sessions_daily_unique unique (store_id, bucket_date)
);

create index shopify_sessions_daily_org_date_idx
  on public.shopify_sessions_daily (organization_id, bucket_date);
create index shopify_sessions_daily_store_date_idx
  on public.shopify_sessions_daily (store_id, bucket_date);

alter table public.shopify_sessions_daily enable row level security;

create policy "shopify_sessions_daily_select_authorized"
on public.shopify_sessions_daily
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.shopify_sessions_daily to authenticated;

create trigger set_shopify_sessions_daily_updated_at
before update on public.shopify_sessions_daily
for each row execute function private.set_updated_at();

comment on table public.shopify_sessions_daily is
  'Sesiones diarias de la tienda desde ShopifyQL (schema sessions). Upsert in-place por (store_id, bucket_date): Shopify revisa la analitica de dias recientes.';

-- Embudo del periodo: sesiones (Shopify) + pedidos y facturacion (nuestros
-- order_facts). La tasa de conversion se devuelve por duplicado a proposito:
--  - conversion_rate_shopify: la que reporta Shopify, ponderada por sesiones.
--  - conversion_rate_own: pedidos propios / sesiones, mismo periodo.
-- No se promedian ni se suman entre si (ADR-0021): cada cifra lleva su fuente.
create or replace function public.shopify_funnel_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  sessions bigint,
  online_store_visitors bigint,
  conversion_rate_shopify numeric,
  orders_count bigint,
  net_sales numeric,
  conversion_rate_own numeric,
  revenue_per_session numeric,
  days_with_sessions bigint
)
language sql
stable
as $$
  with s as (
    select
      coalesce(sum(d.sessions), 0)::bigint as sessions,
      coalesce(sum(d.online_store_visitors), 0)::bigint as visitors,
      -- Media ponderada por sesiones, no media de medias.
      case
        when coalesce(sum(d.sessions), 0) > 0
        then sum(d.conversion_rate * d.sessions) / nullif(sum(d.sessions), 0)
      end as conversion_rate_shopify,
      count(*)::bigint as days_with_sessions
    from public.shopify_sessions_daily d
    where d.organization_id = target_organization_id
      and (target_store_id is null or d.store_id = target_store_id)
      -- period_start null = "Todo": sin cota inferior.
      and (period_start is null or d.bucket_date >= date_trunc('day', period_start)::date)
      and d.bucket_date <= date_trunc('day', period_end)::date
  ),
  o as (
    select
      count(*)::bigint as orders_count,
      coalesce(sum(f.net_sales), 0) as net_sales
    from public.shopify_order_facts f
    where f.organization_id = target_organization_id
      and (target_store_id is null or f.store_id = target_store_id)
      and f.is_test_order = false
      and f.cancelled_at is null
      and (period_start is null or coalesce(f.processed_at, f.external_created_at) >= period_start)
      and coalesce(f.processed_at, f.external_created_at) <= period_end
  )
  select
    s.sessions,
    s.visitors,
    round(s.conversion_rate_shopify, 5) as conversion_rate_shopify,
    o.orders_count,
    o.net_sales,
    case when s.sessions > 0
      then round(o.orders_count::numeric / s.sessions, 5)
    end as conversion_rate_own,
    case when s.sessions > 0
      then round(o.net_sales / s.sessions, 2)
    end as revenue_per_session,
    s.days_with_sessions
  from s cross join o;
$$;

grant execute on function public.shopify_funnel_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- Serie diaria del embudo, para el grafico de evolucion. Rellena con 0 los
-- dias sin datos igual que shopify_sales_daily.
create or replace function public.shopify_funnel_daily(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
  bucket_date date,
  sessions bigint,
  orders_count bigint,
  conversion_rate_own numeric
)
language sql
stable
as $$
  with days as (
    select generate_series(
      date_trunc('day', period_start),
      date_trunc('day', period_end),
      interval '1 day'
    )::date as bucket_date
  ),
  s as (
    select d.bucket_date, sum(d.sessions)::bigint as sessions
    from public.shopify_sessions_daily d
    where d.organization_id = target_organization_id
      and (target_store_id is null or d.store_id = target_store_id)
      and d.bucket_date >= date_trunc('day', period_start)::date
      and d.bucket_date <= date_trunc('day', period_end)::date
    group by 1
  ),
  o as (
    select
      date_trunc('day', coalesce(f.processed_at, f.external_created_at))::date as bucket_date,
      count(*)::bigint as orders_count
    from public.shopify_order_facts f
    where f.organization_id = target_organization_id
      and (target_store_id is null or f.store_id = target_store_id)
      and f.is_test_order = false
      and f.cancelled_at is null
      and coalesce(f.processed_at, f.external_created_at) >= period_start
      and coalesce(f.processed_at, f.external_created_at) <= period_end
    group by 1
  )
  select
    d.bucket_date,
    coalesce(s.sessions, 0) as sessions,
    coalesce(o.orders_count, 0) as orders_count,
    case when coalesce(s.sessions, 0) > 0
      then round(coalesce(o.orders_count, 0)::numeric / s.sessions, 5)
    end as conversion_rate_own
  from days d
  left join s on s.bucket_date = d.bucket_date
  left join o on o.bucket_date = d.bucket_date
  order by d.bucket_date;
$$;

grant execute on function public.shopify_funnel_daily(uuid, timestamptz, timestamptz, uuid) to authenticated;
