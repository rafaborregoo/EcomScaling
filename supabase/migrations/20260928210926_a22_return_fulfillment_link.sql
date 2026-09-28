-- Preserve Shopify's exact fulfilled parcel relationship for each returned
-- line. Unknown/unmatched line IDs remain unlinked and must not be guessed.
alter table public.shopify_return_line_items
  add column if not exists external_fulfillment_line_item_id varchar(255),
  add column if not exists fulfillment_id uuid references public.shopify_fulfillments(id) on delete set null;

create index if not exists shopify_return_line_items_fulfillment_idx
  on public.shopify_return_line_items (fulfillment_id)
  where fulfillment_id is not null;

create index if not exists shopify_return_line_items_external_fulfillment_line_idx
  on public.shopify_return_line_items (external_fulfillment_line_item_id)
  where external_fulfillment_line_item_id is not null;
