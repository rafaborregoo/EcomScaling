-- Mi Camino: un objetivo puede ser la metrica de un hito. Asi el objetivo deja
-- de flotar en un panel aparte y se ve dentro del hito que lo persigue.
-- NULL mantiene el objetivo suelto de siempre (solo lo ve quien edita el plan).
alter table public.organization_metric_targets
  add column if not exists milestone_id uuid references public.strategic_plan_milestones (id) on delete cascade;

-- Dos hitos pueden perseguir la misma metrica (p. ej. ventas en la fase 1 y en
-- la 3): el hito entra en la unicidad.
drop index if exists public.organization_metric_targets_unique_scope;
create unique index if not exists organization_metric_targets_unique_scope
  on public.organization_metric_targets (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(milestone_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric_key,
    period,
    valid_from
  );

create index if not exists organization_metric_targets_milestone_idx
  on public.organization_metric_targets (milestone_id)
  where milestone_id is not null;

create or replace function private.enforce_metric_target_scope()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.store_id is not null and not exists (
    select 1 from public.shopify_stores s
    where s.id = new.store_id and s.organization_id = new.organization_id
  ) then
    raise exception 'store must belong to the same organization';
  end if;
  if new.milestone_id is not null and not exists (
    select 1 from public.strategic_plan_milestones m
    where m.id = new.milestone_id and m.organization_id = new.organization_id
  ) then
    raise exception 'milestone must belong to the same organization';
  end if;
  return new;
end;
$$;

revoke all on function private.enforce_metric_target_scope() from public;

comment on column public.organization_metric_targets.milestone_id is
  'Hito de Mi Camino cuya metrica es este objetivo; NULL = objetivo suelto de la organizacion.';

-- Moneda del camino: se elige al crearlo y se puede cambiar. Antes la cifra
-- salia en la moneda que reportaba la tienda (USD en tiendas de prueba) sin
-- opcion de elegir. NULL = la del objetivo del plan o EUR.
alter table public.strategic_plans
  add column if not exists currency_code varchar(3);

alter table public.strategic_plans
  drop constraint if exists strategic_plans_currency_code_format;
alter table public.strategic_plans
  add constraint strategic_plans_currency_code_format
  check (currency_code is null or currency_code ~ '^[A-Z]{3}$');

comment on column public.strategic_plans.currency_code is
  'Moneda en la que se muestran las cifras de dinero del camino (ISO 4217). No convierte importes.';
