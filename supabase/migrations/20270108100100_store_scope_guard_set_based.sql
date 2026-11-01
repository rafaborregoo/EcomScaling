-- a20_store_scope_guard: evaluar el alcance de tienda una vez por consulta, no una vez por fila.
--
-- Sintoma: /shopify (Resumen) fallaba con «No hemos podido cargar los datos de tu tienda».
-- `shopify_sales_summary` y las demas RPC de metricas devolvian
-- «canceling statement due to statement timeout» (statement_timeout de 8 s del rol authenticated).
--
-- Causa: la policy RESTRICTIVE `a20_store_scope_guard` llamaba a
-- `private.can_access_agent_store_scope(organization_id, store_id)` con COLUMNAS como argumentos,
-- asi que se ejecutaba una vez por fila (~0,5 ms cada una). Con 10.378 pedidos, una RPC de 965 filas
-- tardaba 5,3 s como `authenticated` frente a 0,2-0,6 s como service_role, y `getShopifyMetrics`
-- lanza una decena en paralelo. Mismo patron y misma cura que 20260908190000_rls_permiso_una_vez_por_consulta:
-- el predicado pasa de "funcion(columna)" a "columna in (select conjunto())".
--
-- Semantica identica a `can_access_agent_store_scope`: platform admin, consultor asignado a la
-- organizacion, miembro activo con alcance de organizacion, o miembro activo con alcance de tienda
-- sobre esa tienda. Las funciones se dejan como estaban; solo cambia la expresion de las policies.
--
-- Idempotente: create or replace en las funciones y drop policy if exists antes de crear.

create or replace function private.store_scope_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $fn$
  select ca.organization_id
  from public.consultant_assignments ca
  join public.profiles p on p.id = ca.consultant_user_id
  join public.organizations o on o.id = ca.organization_id
  where ca.consultant_user_id = (select auth.uid())
    and ca.is_active
    and p.is_active
    and private.is_consultant(ca.consultant_user_id)
    and o.status in ('onboarding', 'active')
  union
  select m.organization_id
  from public.organization_members m
  where m.user_id = (select auth.uid())
    and m.is_active
    and coalesce(m.access_scope, 'organization') = 'organization';
$fn$;

create or replace function private.store_scope_store_ids()
returns setof uuid
language sql
stable
security definer
set search_path to ''
as $fn$
  select s
  from public.organization_members m, unnest(coalesce(m.store_ids, '{}'::uuid[])) as s
  where m.user_id = (select auth.uid())
    and m.is_active
    and coalesce(m.access_scope, 'organization') = 'store';
$fn$;

revoke all on function private.store_scope_org_ids() from public, anon;
revoke all on function private.store_scope_store_ids() from public, anon;
grant execute on function private.store_scope_org_ids() to authenticated;
grant execute on function private.store_scope_store_ids() to authenticated;

drop policy if exists a20_store_scope_guard on public.shopify_order_facts;
create policy a20_store_scope_guard on public.shopify_order_facts
as restrictive for select to authenticated
using (
  (select private.is_platform_admin())
  or organization_id in (select private.store_scope_org_ids())
  or (store_id is not null and store_id in (select private.store_scope_store_ids()))
);

drop policy if exists a20_store_scope_guard on public.shopify_products;
create policy a20_store_scope_guard on public.shopify_products
as restrictive for select to authenticated
using (
  (select private.is_platform_admin())
  or organization_id in (select private.store_scope_org_ids())
  or (store_id is not null and store_id in (select private.store_scope_store_ids()))
);

drop policy if exists a20_store_scope_guard on public.shopify_order_items;
create policy a20_store_scope_guard on public.shopify_order_items
as restrictive for select to authenticated
using (
  (select private.is_platform_admin())
  or organization_id in (select private.store_scope_org_ids())
  or order_id in (
    select o.id from public.shopify_order_facts o
    where o.store_id in (select private.store_scope_store_ids())
  )
);
