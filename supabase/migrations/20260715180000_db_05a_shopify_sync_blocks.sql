-- DB-05a: track Shopify sync progress per data block (catalog, inventory, orders, refunds)
-- instead of a single monolithic sync run, so partial failures are isolated and visible.

alter table public.integration_sync_runs
  add column if not exists sync_scope varchar(40);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'integration_sync_runs_sync_scope_check'
      and conrelid = 'public.integration_sync_runs'::regclass
  ) then
    alter table public.integration_sync_runs
      add constraint integration_sync_runs_sync_scope_check check (
        sync_scope is null
        or sync_scope in ('catalog', 'inventory', 'orders', 'refunds', 'customers')
      );
  end if;
end $$;

create index if not exists integration_sync_runs_scope_idx
on public.integration_sync_runs (connection_id, sync_scope, created_at desc);
