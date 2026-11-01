-- Publish a bounded receipt, never OAuth metadata, provider payloads or error details.
create or replace function public.set_integration_webhook_health(target_connection uuid, health jsonb)
returns void language sql security invoker set search_path = '' as $$
  update public.integration_connections
    set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{webhooks}', health, true)
    where id = target_connection;
$$;
revoke all on function public.set_integration_webhook_health(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_integration_webhook_health(uuid, jsonb) to service_role;

create table if not exists public.integration_changes (
  connection_id uuid primary key references public.integration_connections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider varchar(40) not null,
  revision bigint not null default 1,
  changed_at timestamptz not null default now()
);
alter table public.integration_changes enable row level security;
revoke all on public.integration_changes from anon, authenticated;
grant select on public.integration_changes to authenticated;
grant all on public.integration_changes to service_role;
drop policy if exists integration_changes_read_authorized on public.integration_changes;
create policy integration_changes_read_authorized on public.integration_changes for select to authenticated
  using (organization_id in (select private.accessible_org_ids()));
create index if not exists integration_changes_organization_idx on public.integration_changes(organization_id);

create or replace function private.record_integration_change()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare target_connection uuid;
begin
  if tg_table_name = 'integration_sync_runs' then
    if new.sync_type <> 'webhook' or new.status not in ('succeeded','failed','partial') then return new; end if;
    target_connection := new.connection_id;
  else
    if new.status not in ('connected','error','revoked','disconnected') then return new; end if;
    target_connection := new.id;
  end if;
  insert into public.integration_changes(connection_id, organization_id, provider)
    values (target_connection, new.organization_id, new.provider)
    on conflict (connection_id) do update set revision = integration_changes.revision + 1, changed_at = clock_timestamp();
  return new;
end $$;
revoke all on function private.record_integration_change() from public, anon, authenticated;
grant execute on function private.record_integration_change() to service_role;
drop trigger if exists integration_connection_changed on public.integration_connections;
create trigger integration_connection_changed after insert or update on public.integration_connections
  for each row execute function private.record_integration_change();
drop trigger if exists integration_webhook_applied on public.integration_sync_runs;
create trigger integration_webhook_applied after insert or update on public.integration_sync_runs
  for each row execute function private.record_integration_change();

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'integration_changes') then
    alter publication supabase_realtime add table public.integration_changes;
  end if;
end $$;

-- Abort rather than silently discard distinct rows if an older deployment already created duplicates.
-- The existing set_updated_at trigger also runs on repeat upserts.
alter table public.klaviyo_campaign_audiences add column if not exists updated_at timestamptz not null default now();
create unique index if not exists klaviyo_campaign_audiences_natural_key
  on public.klaviyo_campaign_audiences (campaign_id, audience_type, external_audience_id);

create index if not exists webhook_events_ready_queue_idx
  on private.webhook_events (provider, next_retry_at, received_at)
  where status in ('queued', 'failed', 'received');
create index if not exists webhook_events_processing_lease_idx
  on private.webhook_events (provider, claimed_at) where status = 'processing';

alter table public.shopify_inventory_current_state add column if not exists source_updated_at timestamptz;
alter table public.shopify_order_items add column if not exists source_updated_at timestamptz;
alter table public.shopify_order_discount_applications add column if not exists source_updated_at timestamptz;

-- The provider's version, not arrival time, decides which payload may replace state.
create or replace function private.keep_newest_shopify_state()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  incoming_version timestamptz := (to_jsonb(new) ->> tg_argv[0])::timestamptz;
  stored_version timestamptz;
  parent_version timestamptz;
begin
  if tg_op = 'UPDATE' then
    stored_version := (to_jsonb(old) ->> tg_argv[0])::timestamptz;
    if stored_version is not null and (incoming_version is null or incoming_version < stored_version) then
      return old;
    end if;
  end if;
  if tg_table_name in ('shopify_order_items', 'shopify_order_discount_applications') then
    select o.external_updated_at into parent_version
      from public.shopify_order_facts o where o.id = new.order_id;
    if parent_version is not null and incoming_version is not null and incoming_version < parent_version then
      if tg_op = 'UPDATE' then return old; else return null; end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function private.keep_newest_shopify_state() from public, anon, authenticated;
grant execute on function private.keep_newest_shopify_state() to service_role;

drop trigger if exists aa_keep_newest_shopify_order on public.shopify_order_facts;
create trigger aa_keep_newest_shopify_order before insert or update on public.shopify_order_facts
  for each row execute function private.keep_newest_shopify_state('external_updated_at');
drop trigger if exists aa_keep_newest_shopify_inventory on public.shopify_inventory_current_state;
create trigger aa_keep_newest_shopify_inventory before insert or update on public.shopify_inventory_current_state
  for each row execute function private.keep_newest_shopify_state('source_updated_at');
drop trigger if exists aa_keep_newest_shopify_order_item on public.shopify_order_items;
create trigger aa_keep_newest_shopify_order_item before insert or update on public.shopify_order_items
  for each row execute function private.keep_newest_shopify_state('source_updated_at');
drop trigger if exists aa_keep_newest_shopify_discount on public.shopify_order_discount_applications;
create trigger aa_keep_newest_shopify_discount before insert or update on public.shopify_order_discount_applications
  for each row execute function private.keep_newest_shopify_state('source_updated_at');
