alter table public.shopify_variants
  add column if not exists selected_options jsonb not null default '[]'::jsonb;

alter table public.shopify_variants
  drop constraint if exists shopify_variants_selected_options_array,
  add constraint shopify_variants_selected_options_array
  check (jsonb_typeof(selected_options) = 'array');

comment on column public.shopify_variants.selected_options is
  'Opciones seleccionadas de Shopify para la variante, como Color=Negro o Talla=M; no contiene opciones de otros productos ni de otras tiendas.';
