alter table public.shopify_products
  add column if not exists description_html text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists shopify_category_id text,
  add column if not exists shopify_category_name text,
  add column if not exists metadata_coverage text not null default 'pending';

alter table public.shopify_products
  drop constraint if exists shopify_products_metadata_coverage_check;

alter table public.shopify_products
  add constraint shopify_products_metadata_coverage_check
  check (metadata_coverage in ('complete', 'partial', 'pending', 'unavailable'));

comment on column public.shopify_products.description_html is
  'Merchant-authored Shopify description. Treat as untrusted HTML; render only sanitized or derived plain text.';
comment on column public.shopify_products.tags is
  'Shopify product tags as returned by the Admin API.';
comment on column public.shopify_products.shopify_category_id is
  'Shopify Standard Product Taxonomy category GID, when assigned.';
comment on column public.shopify_products.shopify_category_name is
  'Shopify Standard Product Taxonomy category full name, when assigned.';
comment on column public.shopify_products.metadata_coverage is
  'Coverage of description, tags and category fields from Shopify; pending until a full content metadata sync.';
