-- FASE 3 / D03 — Motor de madurez: los hechos del negocio, medidos en SQL.
--
-- El contrato de D03 (`20260915090000`) define que es un perfil de madurez.
-- Esto es lo que hace falta para que un motor pueda llenarlo **mirando el dato
-- que la tienda ya tiene**, sin preguntarle nada a nadie.
--
-- LO QUE ESTE BLOQUE NO HACE, Y ES LA DECISION PRINCIPAL. El apartado 19 del
-- artefacto dice, con todas las letras, que el algoritmo de scoring, los
-- umbrales y las ponderaciones **no estan definidos**. Asi que el motor no
-- calcula `required_level` ni emite hallazgos de brecha: inventar esos umbrales
-- seria fabricar la respuesta y presentarla como derivada del documento. Lo que
-- si hace es mirar el dato y decir que capacidades demuestra el negocio --con
-- el numero delante-- y, sobre todo, **cuales no puede ver y por que**.
--
-- Y LO SEGUNDO, QUE VALE IGUAL: una capacidad que el dato no puede ver **no se
-- escribe**. Ponerla en `absent` seria afirmar que no existe, y un dato que
-- falta no sostiene esa afirmacion. "No lo se" y "no lo hay" son cosas
-- distintas, y confundirlas en un diagnostico es como se le dice a un cliente
-- que no tiene algo que si tiene.
--
-- La funcion es `stable` y sin `security definer` (ADR-0006 punto 6), y no crea
-- indices nuevos: el predicado de fecha usa `coalesce(processed_at,
-- external_created_at)` justamente porque ya existe el indice parcial
-- `shopify_order_facts (organization_id, store_id, coalesce(...)) where
-- is_test_order = false and cancelled_at is null`. Escribirlo de otra forma
-- seria dejar el indice sin usar y anadir uno igual al lado.
--
-- Idempotente (ADR-0014 / CLAUDE.md).

-- ---------------------------------------------------------------------------
-- 1. Los hechos medidos
-- ---------------------------------------------------------------------------

drop function if exists public.maturity_business_facts(uuid, uuid, timestamptz, timestamptz);

create or replace function public.maturity_business_facts(
  target_organization_id uuid,
  target_store_id uuid,
  period_start timestamptz,
  period_end timestamptz
)
returns table (
  window_days integer,
  orders bigint,
  net_sales numeric,
  orders_with_attribution bigint,
  channels bigint,
  currencies bigint,
  repeat_orders bigint,
  orders_with_repeat_flag bigint,
  customers bigint,
  repeat_customers bigint,
  products bigint,
  variants bigint,
  session_days bigint,
  sessions bigint,
  fulfillments bigint,
  fulfilled_orders bigint,
  inventory_items bigint,
  inventory_items_with_cost bigint,
  inventory_snapshots bigint,
  discounts bigint,
  discounts_used bigint,
  active_months bigint
)
language sql
stable
set search_path = ''
as $$
  with pedidos as (
    select *
    from public.shopify_order_facts o
    where o.organization_id = target_organization_id
      and o.store_id = target_store_id
      and o.is_test_order = false
      and o.cancelled_at is null
      and coalesce(o.processed_at, o.external_created_at) >= period_start
      and coalesce(o.processed_at, o.external_created_at) < period_end
  )
  select
    greatest(1, (period_end::date - period_start::date))::integer as window_days,
    (select count(*) from pedidos),
    coalesce((select sum(p.net_sales) from pedidos p), 0),
    (select count(*) from pedidos p where p.first_visit_source_type is not null),
    (select count(distinct p.first_visit_source_type) from pedidos p
      where p.first_visit_source_type is not null),
    (select count(distinct p.currency_code) from pedidos p where p.currency_code is not null),
    (select count(*) from pedidos p where p.is_first_customer_order = false),
    (select count(*) from pedidos p where p.is_first_customer_order is not null),
    (select count(*) from public.shopify_customers c
      where c.organization_id = target_organization_id and c.store_id = target_store_id),
    (select count(*) from public.shopify_customers c
      where c.organization_id = target_organization_id and c.store_id = target_store_id
        and coalesce(c.number_of_orders, 0) > 1),
    (select count(*) from public.shopify_products pr
      where pr.organization_id = target_organization_id and pr.store_id = target_store_id),
    -- Variantes e inventario no llevan tienda: son del catalogo de la
    -- organizacion. Con una sola tienda es lo mismo; con varias, el dia que las
    -- haya, habra que decidir como se reparte un catalogo compartido.
    (select count(*) from public.shopify_variants v
      where v.organization_id = target_organization_id),
    -- Dias **con visitas**, no dias con fila. Una serie diaria tiene una fila
    -- por dia aunque ese dia no entrara nadie, asi que contar filas mide que la
    -- serie existe, no que haya trafico: en la prueba real salieron 365 dias de
    -- cobertura sobre 9 sesiones en todo el ano.
    (select count(*) from public.shopify_sessions_daily s
      where s.organization_id = target_organization_id and s.store_id = target_store_id
        and s.bucket_date >= period_start::date and s.bucket_date < period_end::date
        and coalesce(s.sessions, 0) > 0),
    coalesce((select sum(s.sessions) from public.shopify_sessions_daily s
      where s.organization_id = target_organization_id and s.store_id = target_store_id
        and s.bucket_date >= period_start::date and s.bucket_date < period_end::date), 0),
    (select count(*) from public.shopify_fulfillments f
      where f.organization_id = target_organization_id and f.store_id = target_store_id),
    (select count(distinct f.order_id) from public.shopify_fulfillments f
      where f.organization_id = target_organization_id and f.store_id = target_store_id),
    (select count(*) from public.shopify_inventory_items i
      where i.organization_id = target_organization_id),
    (select count(*) from public.shopify_inventory_items i
      where i.organization_id = target_organization_id and i.current_unit_cost is not null),
    (select count(*) from public.shopify_inventory_level_snapshots l
      where l.organization_id = target_organization_id),
    (select count(*) from public.shopify_discounts d
      where d.organization_id = target_organization_id and d.store_id = target_store_id),
    (select count(*) from public.shopify_discounts d
      where d.organization_id = target_organization_id and d.store_id = target_store_id
        and coalesce(d.usage_count, 0) > 0),
    (select count(distinct date_trunc('month', coalesce(p.processed_at, p.external_created_at)))
      from pedidos p)
$$;

comment on function public.maturity_business_facts(uuid, uuid, timestamptz, timestamptz) is
  'F3/D03 paso 2. Complejidad y cobertura del dato de una tienda, medidas. Ninguna de estas '
  'cifras es una opinion: son las que deciden que capacidades se pueden observar y cuales no.';

-- ---------------------------------------------------------------------------
-- 2. El grafo de capacidades, con lo que el artefacto dice y nada mas
-- ---------------------------------------------------------------------------
--
-- `capability_dependencies` se creo vacia el 2026-09-15 a proposito: el grafo
-- es conocimiento de ecommerce y no se inventa desde una migracion. Lo que si
-- se puede declarar es **lo que el artefacto escribe literalmente**, que son
-- estas siete aristas: el apartado 13 dice que escalar adquisicion requiere
-- inventario, finanzas, creatividad, conversion, operaciones y datos; y el 14
-- pone el ejemplo de techo, "creative production capacity -> paid acquisition
-- scalability".
--
-- El resto del grafo sigue sin escribirse. Poner aqui lo que a mi me parece que
-- depende de que seria exactamente lo que el plan maestro prohibe.

insert into public.capability_dependencies (capability, depends_on, relation, rationale)
select v.capability, v.depends_on, v.relation, v.rationale
from (values
  ('acquisition', 'inventory', 'requires',
   'Escalar adquisicion sin inventario que sostenga la demanda termina en roturas de stock (apartado 13).'),
  ('acquisition', 'finance', 'requires',
   'Escalar adquisicion sin finanzas es comprar trafico sin saber si sale a cuenta (apartado 13).'),
  ('acquisition', 'creative', 'requires',
   'Escalar adquisicion necesita piezas creativas que alimenten el volumen (apartado 13).'),
  ('acquisition', 'conversion', 'requires',
   'Escalar adquisicion hacia un funnel que no convierte multiplica el gasto, no las ventas (apartado 13).'),
  ('acquisition', 'operations', 'requires',
   'Escalar adquisicion sin operaciones deteriora la experiencia de quien ya compro (apartado 13).'),
  ('acquisition', 'data', 'requires',
   'Escalar adquisicion sin datos es escalar a ciegas: no se sabe que funciona (apartado 13).'),
  ('acquisition', 'creative', 'ceiling',
   'La capacidad de producir creatividades pone techo a cuanto se puede escalar en pago (apartado 14).')
) as v(capability, depends_on, relation, rationale)
where not exists (
  select 1 from public.capability_dependencies d
  where d.capability = v.capability
    and d.depends_on = v.depends_on
    and d.relation = v.relation
);

-- ---------------------------------------------------------------------------
-- 3. Lectura del perfil vigente
-- ---------------------------------------------------------------------------
--
-- La pantalla pide siempre el perfil vigente de una organizacion. El indice
-- existente (`maturity_profiles_org_idx`) ordena por fecha; este responde
-- directamente a "cual esta vigente", que es la consulta real.

create index if not exists maturity_profiles_vigente_lectura_idx
  on public.maturity_profiles (organization_id, store_id)
  where superseded_at is null;
