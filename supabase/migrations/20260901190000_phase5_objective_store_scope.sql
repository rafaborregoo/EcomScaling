-- Fase 5: los objetivos pueden ser globales para el cliente o específicos
-- de una tienda. NULL mantiene el comportamiento agregado existente.
alter table public.organization_metric_targets
  add column if not exists store_id uuid references public.shopify_stores (id) on delete cascade;

alter table public.organization_metric_targets
  drop constraint if exists organization_metric_targets_unique_active;

create unique index if not exists organization_metric_targets_unique_scope
  on public.organization_metric_targets (
    organization_id,
    coalesce(store_id, '00000000-0000-0000-0000-000000000000'::uuid),
    metric_key,
    period,
    valid_from
  );

create index if not exists organization_metric_targets_store_idx
  on public.organization_metric_targets (organization_id, store_id, metric_key, valid_from);

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
  return new;
end;
$$;

revoke all on function private.enforce_metric_target_scope() from public;

drop trigger if exists enforce_metric_target_scope on public.organization_metric_targets;
create trigger enforce_metric_target_scope
before insert or update on public.organization_metric_targets
for each row execute function private.enforce_metric_target_scope();

comment on column public.organization_metric_targets.store_id is
  'Tienda a la que aplica el objetivo; NULL significa el agregado de toda la organizacion.';
