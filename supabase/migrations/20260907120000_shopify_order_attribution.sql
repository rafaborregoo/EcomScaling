-- Atribucion y recurrencia por pedido (Shopify `customerJourneySummary`).
--
-- Dos agujeros que esto cierra:
--
-- 1. `is_first_customer_order` se derivaba de `customer.numberOfOrders == 1`,
--    que no significa "este fue su primer pedido" sino "este cliente solo ha
--    comprado una vez". En produccion estaba a `false` en los 721 pedidos: el
--    primer pedido de todo cliente que repite quedaba mal marcado. El campo
--    bueno es `customerOrderIndex` (1 = primer pedido), y ademas sirve para
--    cohortes de 2o, 3er pedido.
--
-- 2. No habia NADA de atribucion: de donde llega cada pedido. `firstVisit` da
--    la adquisicion (que campana lo trajo) y `lastVisit` que cerro la venta.
--    Se guardan los dos porque responden preguntas distintas y mezclarlos es
--    el error clasico de atribucion.
--
-- Columnas planas sobre `shopify_order_facts` y no una tabla 1:1: toda metrica
-- de atribucion cruza con importe y fecha del pedido, y una tabla aparte
-- obligaria a un join en cada una.
alter table public.shopify_order_facts
  add column customer_order_index integer,
  add column days_to_conversion integer,
  -- Adquisicion: la primera visita de la que hay constancia.
  add column first_visit_source varchar(120),
  add column first_visit_source_type varchar(60),
  add column first_visit_landing_page text,
  add column first_visit_referrer_url text,
  add column first_visit_utm_source varchar(120),
  add column first_visit_utm_medium varchar(120),
  add column first_visit_utm_campaign varchar(200),
  add column first_visit_at timestamptz,
  -- Cierre: la ultima visita antes de comprar.
  add column last_visit_source varchar(120),
  add column last_visit_source_type varchar(60);

-- El indice lleva `organization_id` delante porque toda consulta va acotada al
-- tenant antes que nada, y la fecha detras porque las metricas siempre piden
-- una ventana.
create index shopify_order_facts_attribution_idx
  on public.shopify_order_facts (organization_id, external_created_at desc)
  where customer_order_index is not null;

comment on column public.shopify_order_facts.customer_order_index is
  'Posicion del pedido en el historial del cliente (1 = primer pedido). Fuente: customerJourneySummary.customerOrderIndex.';
comment on column public.shopify_order_facts.is_first_customer_order is
  'Derivado de customer_order_index = 1. Nulo si la tienda todavia no ha resincronizado con atribucion.';
