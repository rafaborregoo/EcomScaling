-- Las notas del consultor en tarjetas son por tienda: las cifras de cada
-- tienda son distintas, y una nota sobre la conversion de una no vale para
-- otra. store_id null = cliente sin tienda Shopify (o nota anterior a esto).
-- Idempotente (CLAUDE.md).

alter table public.zone_notes
  add column if not exists store_id uuid references public.shopify_stores (id) on delete cascade;

drop index if exists public.zone_notes_org_active_idx;
create index if not exists zone_notes_store_active_idx
  on public.zone_notes (organization_id, store_id, anchor, created_at desc)
  where archived_at is null;
