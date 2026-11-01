-- La muestra de pedidos de /shopify ordena por processed_at; los índices existentes van por
-- COALESCE(processed_at, external_created_at) y no sirven, así que hacía seq scan + sort.
create index if not exists shopify_order_facts_store_processed_desc_idx
  on public.shopify_order_facts (store_id, processed_at desc nulls last);
