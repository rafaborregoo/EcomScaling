-- Plan de las tiendas propias del consultor.
--
-- createOwnStore creaba la organizacion y la membership de owner, pero ninguna
-- fila en service_subscriptions. Eso no era solo cosmetico ("Sin plan" en las
-- vistas): assertStoreLimit lee el store_limit de la suscripcion activa y, si no
-- encuentra suscripcion, devuelve null -- o sea, sin tope. Una tienda propia
-- podia conectar tiendas Shopify sin limite mientras que un cliente si lo tiene.
--
-- Aqui se rellenan las que ya existian. A partir de ahora las crea el codigo
-- (OWN_STORE_PLAN_* en apps/api/src/consultant.ts): si cambia el tope alli,
-- cambia el de abajo.
--
-- Tienda propia = tiene un owner activo cuyo perfil es consultant o
-- platform_admin, y ninguna consultant_assignment activa (eso la haria cartera,
-- no tienda propia). El insert es idempotente por el `not exists`: reaplicarla
-- no duplica suscripciones ni pisa las que ya tengan uno.

insert into public.service_subscriptions (
  organization_id,
  plan_code,
  status,
  store_limit,
  starts_at
)
select
  o.id,
  'consultant',
  'active'::subscription_status,
  2,
  now()
from public.organizations o
where not exists (
    select 1
    from public.service_subscriptions s
    where s.organization_id = o.id
  )
  and exists (
    select 1
    from public.organization_members om
    join public.profiles p on p.id = om.user_id
    where om.organization_id = o.id
      and om.is_active
      and om.role = 'owner'
      and p.platform_role in ('consultant', 'platform_admin')
  )
  and not exists (
    select 1
    from public.consultant_assignments ca
    where ca.organization_id = o.id
      and ca.is_active
  );
