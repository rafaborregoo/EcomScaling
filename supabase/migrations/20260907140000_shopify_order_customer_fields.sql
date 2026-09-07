-- Campos que ya llegan en cada pedido y cliente de Shopify y que no guardabamos.
--
-- No hacen falta tablas nuevas: son columnas del objeto que el sync ya recorre,
-- asi que traerlas no cuesta ni una llamada mas a la API.

-- --- Pedidos ---------------------------------------------------------------

alter table public.shopify_order_facts
  -- Cada tienda usa las etiquetas a su manera (suscripcion, mayorista,
  -- incidencia). Sin ellas el analisis por segmento propio es imposible.
  add column tags text[] not null default '{}',
  -- Order.risk: pedidos que Shopify marca antes de prepararlos.
  add column risk_level varchar(20),
  -- Pasarelas con las que se cobro. El detalle con comisiones va en
  -- shopify_order_transactions; esto es el resumen para agrupar sin join.
  add column payment_gateway_names text[] not null default '{}',
  -- Order.returnStatus: distinto de `refunds`, que es solo el dinero. Aqui
  -- esta si hay una devolucion ABIERTA, que es dinero comprometido sin salir.
  add column return_status varchar(40);

-- Las etiquetas se consultan por pertenencia ("dame los mayoristas"), que es
-- justo lo que indexa GIN; un btree no sirve para `&&` ni `@>`.
create index shopify_order_facts_tags_idx
  on public.shopify_order_facts using gin (tags);

-- --- Clientes --------------------------------------------------------------

alter table public.shopify_customers
  -- Cuantos de los clientes se pueden contactar de verdad. Es la cifra que
  -- hay que cruzar con Klaviyo para saber si la lista esta bien construida.
  add column email_marketing_state varchar(40),
  add column sms_marketing_state varchar(40),
  add column verified_email boolean,
  add column locale varchar(20),
  -- Geografia de la direccion por defecto, plana: la pregunta que responde es
  -- "donde vendemos ya sin intentarlo", y para eso no hace falta el historial
  -- de direcciones completo.
  add column default_country_code varchar(2),
  add column default_province_code varchar(10),
  add column default_city varchar(120),
  -- Dias desde la ultima compra: la lista de reactivacion sale de aqui.
  add column last_order_at timestamptz;

create index shopify_customers_last_order_at_idx
  on public.shopify_customers (organization_id, last_order_at desc)
  where last_order_at is not null;

create index shopify_customers_country_idx
  on public.shopify_customers (organization_id, default_country_code)
  where default_country_code is not null;

comment on column public.shopify_order_facts.return_status is
  'Estado de devolucion del pedido (Order.returnStatus). Distinto de refunds: aqui hay devoluciones abiertas todavia sin reembolsar.';
comment on column public.shopify_customers.email_marketing_state is
  'Consentimiento de email (defaultEmailAddress.marketingState). SUBSCRIBED, NOT_SUBSCRIBED, PENDING...';
