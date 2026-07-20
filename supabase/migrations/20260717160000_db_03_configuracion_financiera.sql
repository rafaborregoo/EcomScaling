-- DB-03: configuracion financiera manual (settings, gastos fijos, reglas de
-- envio y objetivos) para calcular beneficio neto y break-even sin hojas
-- externas. Lectura via RLS (can_access_org); escritura solo via API con
-- service role + chequeo manual de rol owner/manager, igual que product_costs.
-- Cambios quedan auditados en audit_logs via trigger.

create table public.organization_financial_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  currency_code varchar(3) not null default 'EUR',
  payment_fee_pct numeric(5, 2) not null default 0,
  payment_fee_fixed numeric(10, 2) not null default 0,
  default_shipping_cost numeric(10, 2) not null default 0,
  vat_pct numeric(5, 2) not null default 0,
  notes text,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_financial_settings_unique_org unique (organization_id),
  constraint organization_financial_settings_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint organization_financial_settings_payment_fee_pct_range check (payment_fee_pct >= 0 and payment_fee_pct <= 100),
  constraint organization_financial_settings_payment_fee_fixed_range check (payment_fee_fixed >= 0),
  constraint organization_financial_settings_shipping_range check (default_shipping_cost >= 0),
  constraint organization_financial_settings_vat_pct_range check (vat_pct >= 0 and vat_pct <= 100)
);

create table public.fixed_expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name varchar(160) not null,
  category varchar(80),
  amount numeric(12, 2) not null,
  currency_code varchar(3) not null default 'EUR',
  billing_period varchar(20) not null default 'monthly',
  valid_from date not null default current_date,
  valid_until date,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fixed_expenses_amount_range check (amount >= 0),
  constraint fixed_expenses_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint fixed_expenses_billing_period_values check (billing_period in ('monthly', 'yearly')),
  constraint fixed_expenses_valid_period check (valid_until is null or valid_until > valid_from)
);

create table public.shipping_cost_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name varchar(160) not null,
  country_code varchar(2),
  cost_per_order numeric(10, 2) not null,
  currency_code varchar(3) not null default 'EUR',
  min_order_total numeric(12, 2) not null default 0,
  max_order_total numeric(12, 2),
  valid_from date not null default current_date,
  valid_until date,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shipping_cost_rules_cost_range check (cost_per_order >= 0),
  constraint shipping_cost_rules_currency_format check (currency_code ~ '^[A-Z]{3}$'),
  constraint shipping_cost_rules_country_format check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint shipping_cost_rules_order_total_range check (max_order_total is null or max_order_total > min_order_total),
  constraint shipping_cost_rules_min_total_range check (min_order_total >= 0),
  constraint shipping_cost_rules_valid_period check (valid_until is null or valid_until > valid_from)
);

create table public.organization_metric_targets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  metric_key varchar(80) not null,
  target_value numeric(14, 2) not null,
  period varchar(20) not null default 'monthly',
  valid_from date not null default current_date,
  valid_until date,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_metric_targets_period_values check (period in ('monthly', 'quarterly', 'yearly')),
  constraint organization_metric_targets_valid_period check (valid_until is null or valid_until > valid_from),
  constraint organization_metric_targets_unique_active unique (organization_id, metric_key, period, valid_from)
);

create index organization_financial_settings_org_idx on public.organization_financial_settings (organization_id);
create index fixed_expenses_org_idx on public.fixed_expenses (organization_id);
create index fixed_expenses_org_active_idx on public.fixed_expenses (organization_id, valid_from, valid_until) where is_active;
create index shipping_cost_rules_org_idx on public.shipping_cost_rules (organization_id);
create index shipping_cost_rules_org_active_idx on public.shipping_cost_rules (organization_id, valid_from, valid_until) where is_active;
create index organization_metric_targets_org_idx on public.organization_metric_targets (organization_id);
create index organization_metric_targets_lookup_idx on public.organization_metric_targets (organization_id, metric_key, valid_from);

create trigger set_organization_financial_settings_updated_at
before update on public.organization_financial_settings
for each row execute function private.set_updated_at();

create trigger set_fixed_expenses_updated_at
before update on public.fixed_expenses
for each row execute function private.set_updated_at();

create trigger set_shipping_cost_rules_updated_at
before update on public.shipping_cost_rules
for each row execute function private.set_updated_at();

create trigger set_organization_metric_targets_updated_at
before update on public.organization_metric_targets
for each row execute function private.set_updated_at();

-- Auditoria: cualquier cambio financiero relevante queda en audit_logs con
-- old/new completos. security definer porque el insert lo dispara el service
-- role de la API y audit_logs no tiene policy de insert para authenticated.
create or replace function private.log_financial_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (organization_id, actor_user_id, action, entity_type, entity_id, old_data, new_data)
  values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    tg_table_name || '_' || lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.log_financial_change() from public;

create trigger audit_organization_financial_settings
after insert or update or delete on public.organization_financial_settings
for each row execute function private.log_financial_change();

create trigger audit_fixed_expenses
after insert or update or delete on public.fixed_expenses
for each row execute function private.log_financial_change();

create trigger audit_shipping_cost_rules
after insert or update or delete on public.shipping_cost_rules
for each row execute function private.log_financial_change();

create trigger audit_organization_metric_targets
after insert or update or delete on public.organization_metric_targets
for each row execute function private.log_financial_change();

alter table public.organization_financial_settings enable row level security;
alter table public.fixed_expenses enable row level security;
alter table public.shipping_cost_rules enable row level security;
alter table public.organization_metric_targets enable row level security;

create policy "organization_financial_settings_select_authorized"
on public.organization_financial_settings
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "fixed_expenses_select_authorized"
on public.fixed_expenses
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "shipping_cost_rules_select_authorized"
on public.shipping_cost_rules
for select
to authenticated
using (private.can_access_org(organization_id));

create policy "organization_metric_targets_select_authorized"
on public.organization_metric_targets
for select
to authenticated
using (private.can_access_org(organization_id));

grant select on public.organization_financial_settings to authenticated;
grant select on public.fixed_expenses to authenticated;
grant select on public.shipping_cost_rules to authenticated;
grant select on public.organization_metric_targets to authenticated;

comment on table public.organization_financial_settings is 'Parametros financieros manuales por organizacion (comisiones de pago, envio por defecto, IVA). Una fila por organizacion, upsert in-place.';
comment on table public.fixed_expenses is 'Gastos fijos con vigencia temporal para el calculo de beneficio neto y break-even.';
comment on table public.shipping_cost_rules is 'Reglas de coste de envio por pais/tramo de pedido. default_shipping_cost de settings actua como fallback.';
comment on table public.organization_metric_targets is 'Objetivos de metricas por organizacion y periodo.';

-- Motor financiero MVP: beneficio neto estimado y break-even mensual.
-- security invoker (default): las RLS de las tablas subyacentes limitan filas
-- aunque target_organization_id venga falseado. Misma convencion de scope por
-- tienda que db_05g.
create or replace function public.shopify_financial_summary(
  target_organization_id uuid,
  period_start timestamptz,
  period_end timestamptz,
  target_store_id uuid
)
returns table (
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
  items_without_cost bigint
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
  sales as (
    select
      coalesce(sum(o.net_sales), 0) as net_sales,
      count(*) as orders_count
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and (target_store_id is null or o.store_id = target_store_id)
      and o.is_test_order = false
      and o.cancelled_at is null
      and (period_start is null or coalesce(o.processed_at, o.external_created_at) >= period_start)
      and coalesce(o.processed_at, o.external_created_at) <= period_end
  ),
  margin as (
    select m.cogs, m.items_without_cost
    from public.shopify_margin_summary(target_organization_id, period_start, period_end, target_store_id) m
  ),
  settings as (
    select s.payment_fee_pct, s.payment_fee_fixed, s.default_shipping_cost
    from public.organization_financial_settings s
    where s.organization_id = target_organization_id
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
  )
  select
    s.net_sales,
    s.orders_count,
    m.cogs,
    s.net_sales - m.cogs as gross_margin,
    round(s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0), 2) as payment_fees,
    round(s.orders_count * coalesce(st.default_shipping_cost, 0), 2) as shipping_costs,
    round(f.fixed_costs_period, 2) as fixed_costs,
    round(
      s.net_sales - m.cogs
      - (s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0))
      - s.orders_count * coalesce(st.default_shipping_cost, 0)
      - f.fixed_costs_period,
      2
    ) as net_profit,
    case
      when s.net_sales > 0 then round(
        (
          s.net_sales - m.cogs
          - (s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0))
          - s.orders_count * coalesce(st.default_shipping_cost, 0)
          - f.fixed_costs_period
        ) / s.net_sales * 100,
        2
      )
      else 0
    end as net_margin_pct,
    round(f.monthly_fixed_costs, 2) as monthly_fixed_costs,
    case
      when s.net_sales > 0
        and (
          s.net_sales - m.cogs
          - (s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0))
          - s.orders_count * coalesce(st.default_shipping_cost, 0)
        ) > 0
      then round(
        f.monthly_fixed_costs / (
          (
            s.net_sales - m.cogs
            - (s.net_sales * coalesce(st.payment_fee_pct, 0) / 100 + s.orders_count * coalesce(st.payment_fee_fixed, 0))
            - s.orders_count * coalesce(st.default_shipping_cost, 0)
          ) / s.net_sales
        ),
        2
      )
      else null
    end as break_even_monthly_revenue,
    exists (select 1 from settings) as has_settings,
    f.fixed_expenses_count,
    m.items_without_cost
  from sales s
  cross join margin m
  cross join fixed f
  left join settings st on true;
$$;

grant execute on function public.shopify_financial_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

comment on function public.shopify_financial_summary is 'Beneficio neto estimado del periodo: ventas netas - COGS (solo lineas con coste, ver items_without_cost) - comisiones de pago - envio estimado por pedido - gastos fijos prorrateados. break_even_monthly_revenue = gastos fijos mensuales / ratio de margen de contribucion; null si el margen de contribucion no es positivo.';
