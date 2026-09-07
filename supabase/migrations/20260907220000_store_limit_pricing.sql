-- Pricing por numero de tiendas: 2 tiendas 100 EUR, 3 tiendas 139 EUR, etc.
-- Una "tienda" a efectos de factura es una conexion Shopify activa, porque es
-- la que trae los datos que los agentes analizan. Una tienda sin consultor
-- cuenta igual: consume sync, almacenamiento y analisis lo mismo que una con.
-- Meta y Klaviyo NO son unidades facturables aparte -- cuelgan de una tienda
-- (ver store_id en meta_ad_accounts / klaviyo_accounts).
--
-- El limite vive en la suscripcion y no en una tabla de planes porque hoy el
-- plan es una etiqueta de texto (plan_code) sin catalogo: meter el catalogo
-- entero para guardar un entero seria construir el edificio antes que la
-- puerta. Cuando haya catalogo, esta columna pasa a derivarse de el.
--
-- NULL = sin limite. Es el valor de todo lo que ya existe, asi que la
-- migracion no puede dejar a ningun cliente por encima de su plan de golpe.

alter table public.service_subscriptions
  add column if not exists store_limit integer;

alter table public.service_subscriptions
  drop constraint if exists service_subscriptions_store_limit_positive;

alter table public.service_subscriptions
  add constraint service_subscriptions_store_limit_positive
  check (store_limit is null or store_limit > 0);

comment on column public.service_subscriptions.store_limit is
  'Maximo de conexiones Shopify activas que permite el plan; NULL = sin limite.';

-- Conteo canonico de tiendas facturables. Existe como funcion y no como un
-- count() suelto en Node para que el limite, la factura y lo que ve el cliente
-- salgan los tres del mismo sitio (ADR-0006 pto 6). Las conexiones 'pending'
-- no cuentan: es un OAuth empezado y no terminado, y cobrar por eso -- o
-- bloquear por eso -- seria cobrar por una tienda que no trae ningun dato.
create or replace function public.billable_store_count(target_organization_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.integration_connections c
  where c.organization_id = target_organization_id
    and c.provider = 'shopify'
    and c.status in ('connected', 'syncing', 'error')
    and c.disconnected_at is null;
$$;

revoke all on function public.billable_store_count(uuid) from public;
grant execute on function public.billable_store_count(uuid) to authenticated, service_role;

create index if not exists integration_connections_billable_store_idx
  on public.integration_connections (organization_id, provider, status)
  where disconnected_at is null;
