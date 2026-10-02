-- Marca la última importación completa que observó cada pertenencia.
-- La reconciliación solo retira filas antiguas tras recorrer todo el snapshot.
alter table public.shopify_product_collections
  add column if not exists last_seen_at timestamptz;

create index if not exists shopify_product_collections_store_last_seen_idx
  on public.shopify_product_collections (collection_id, last_seen_at);
