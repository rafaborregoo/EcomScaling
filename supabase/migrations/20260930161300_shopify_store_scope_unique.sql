-- Composite shop/org relationships need a matching unique key before the
-- coverage tables that reference (organization_id, id) are created.
do $migration$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.shopify_stores'::regclass
      and conname = 'shopify_stores_organization_id_id_key'
  ) then
    alter table public.shopify_stores
      add constraint shopify_stores_organization_id_id_key
      unique (organization_id, id);
  elsif not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.shopify_stores'::regclass
      and conname = 'shopify_stores_organization_id_id_key'
      and pg_get_constraintdef(oid) = 'UNIQUE (organization_id, id)'
  ) then
    raise exception 'shopify_stores_organization_id_id_key has an unexpected definition';
  end if;
end
$migration$;
