-- Una "tienda" es la que tiene conexion Shopify; los datos de Meta y Klaviyo
-- son datos DE esa tienda. Hasta ahora las cuentas de ambos proveedores solo
-- colgaban de organization_id, asi que con dos tiendas en un mismo cliente no
-- habia forma de decir que cuenta publicitaria pertenece a cual: /marketing
-- mostraba la suma de las dos sin avisar.
--
-- El punto de discriminacion en Meta es la cuenta publicitaria (un portfolio
-- puede tener una por tienda, con su propio pixel), no la conexion: una sola
-- conexion OAuth legitimamente sirve a varias tiendas. En Klaviyo la cuenta es
-- 1:1 con la conexion, pero se marca en la misma tabla para que el patron sea
-- uno solo: "la entidad cuenta del proveedor lleva la tienda a la que pertenece".
--
-- NULL = sin asignar (comportamiento actual, agregado de la organizacion).
-- Mismo criterio que organization_metric_targets.store_id (fase 5).
--
-- ON DELETE SET NULL a proposito, no CASCADE: desconectar la tienda de Shopify
-- no puede llevarse por delante el historico de insights de Meta ni los
-- informes de Klaviyo, que siguen siendo datos validos del cliente.

alter table public.meta_ad_accounts
  add column if not exists store_id uuid references public.shopify_stores (id) on delete set null;

alter table public.klaviyo_accounts
  add column if not exists store_id uuid references public.shopify_stores (id) on delete set null;

create index if not exists meta_ad_accounts_store_idx
  on public.meta_ad_accounts (organization_id, store_id);

create index if not exists klaviyo_accounts_store_idx
  on public.klaviyo_accounts (organization_id, store_id);

-- La tienda tiene que ser del mismo cliente que la cuenta. Sin esto, un id de
-- tienda de otra organizacion colaria por la API y filtraria datos entre
-- clientes. Misma forma que private.enforce_metric_target_scope().
create or replace function private.enforce_provider_account_store_scope()
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

revoke all on function private.enforce_provider_account_store_scope() from public;

drop trigger if exists enforce_meta_ad_account_store_scope on public.meta_ad_accounts;
create trigger enforce_meta_ad_account_store_scope
before insert or update on public.meta_ad_accounts
for each row execute function private.enforce_provider_account_store_scope();

drop trigger if exists enforce_klaviyo_account_store_scope on public.klaviyo_accounts;
create trigger enforce_klaviyo_account_store_scope
before insert or update on public.klaviyo_accounts
for each row execute function private.enforce_provider_account_store_scope();

-- Backfill: donde el cliente tiene exactamente UNA tienda la asignacion es
-- inequivoca y se hace sola. Donde tiene varias se deja NULL a proposito --
-- adivinar ahi es justo el error que esta migracion existe para impedir.
with single_store as (
  select organization_id, (array_agg(id))[1] as store_id
  from public.shopify_stores
  where is_active
  group by organization_id
  having count(*) = 1
)
update public.meta_ad_accounts a
set store_id = s.store_id
from single_store s
where a.organization_id = s.organization_id and a.store_id is null;

with single_store as (
  select organization_id, (array_agg(id))[1] as store_id
  from public.shopify_stores
  where is_active
  group by organization_id
  having count(*) = 1
)
update public.klaviyo_accounts a
set store_id = s.store_id
from single_store s
where a.organization_id = s.organization_id and a.store_id is null;

comment on column public.meta_ad_accounts.store_id is
  'Tienda Shopify a la que pertenece esta cuenta publicitaria; NULL = sin asignar.';
comment on column public.klaviyo_accounts.store_id is
  'Tienda Shopify a la que pertenece esta cuenta de Klaviyo; NULL = sin asignar.';
