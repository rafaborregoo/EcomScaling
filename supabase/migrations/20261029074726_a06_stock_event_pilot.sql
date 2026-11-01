-- A06 pilot only. No store is enrolled and no paid call is enabled by this migration.
create table if not exists public.a06_stock_event_settings (
  store_id uuid primary key references public.shopify_stores(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  mode text not null default 'shadow' check (mode in ('off', 'shadow', 'live')),
  coverage_review_days numeric not null default 3 check (coverage_review_days between 0.25 and 90),
  cooldown_minutes integer not null default 15 check (cooldown_minutes between 1 and 1440),
  daily_model_cap integer not null default 4 check (daily_model_cap between 1 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.a06_stock_event_queue (
  store_id uuid primary key references public.a06_stock_event_settings(store_id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revision bigint not null default 1,
  processed_revision bigint not null default 0,
  changes jsonb not null default '{}'::jsonb,
  pending_since timestamptz,
  due_at timestamptz,
  lease_token uuid,
  lease_until timestamptz,
  last_model_at timestamptz,
  last_model_signature text,
  updated_at timestamptz not null default now()
);
create index if not exists a06_stock_event_queue_due_idx on public.a06_stock_event_queue(due_at)
  where due_at is not null;

create table if not exists public.a06_stock_event_evaluations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.a06_stock_event_settings(store_id) on delete cascade,
  revision bigint not null,
  mode text not null check (mode in ('off', 'shadow', 'live')),
  decision text not null,
  evidence jsonb not null default '{}'::jsonb,
  run_id uuid references public.agent_runs(id) on delete set null,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists a06_stock_event_evaluations_store_time_idx
  on public.a06_stock_event_evaluations(store_id, created_at desc);
create index if not exists a06_stock_event_evaluations_org_time_idx
  on public.a06_stock_event_evaluations(organization_id, created_at desc);

alter table public.a06_stock_event_settings enable row level security;
alter table public.a06_stock_event_queue enable row level security;
alter table public.a06_stock_event_evaluations enable row level security;
revoke all on public.a06_stock_event_settings, public.a06_stock_event_queue,
  public.a06_stock_event_evaluations from public, anon, authenticated;
grant all on public.a06_stock_event_settings, public.a06_stock_event_queue,
  public.a06_stock_event_evaluations to service_role;

-- Verify tenant ownership even for privileged callers before enrollment.
create function private.a06_verify_event_store() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.shopify_stores s
    where s.id = new.store_id and s.organization_id = new.organization_id) then
    raise exception 'a06_event_store_scope_mismatch';
  end if;
  return new;
end;
$$;
revoke all on function private.a06_verify_event_store() from public, anon, authenticated;
drop trigger if exists a06_event_settings_scope on public.a06_stock_event_settings;
create trigger a06_event_settings_scope before insert or update on public.a06_stock_event_settings
  for each row execute function private.a06_verify_event_store();

-- Inventory writes and the wakeup are one transaction. Initial imports do not
-- generate events; updates with the same quantity do not call this function.
create function private.a06_capture_inventory_change() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  store uuid;
  product uuid;
  variant uuid;
  change_key text := new.id::text;
  payload jsonb;
begin
  -- Reject delayed source events as triggers; they are not evidence of a new risk.
  if new.updated_at < old.updated_at or new.updated_at < now() - interval '48 hours' then
    return new;
  end if;
  select p.store_id, p.id, v.id into store, product, variant
  from public.shopify_inventory_items i
  join public.shopify_variants v on v.id = i.variant_id and v.organization_id = i.organization_id
  join public.shopify_products p on p.id = v.product_id and p.organization_id = v.organization_id
  join public.a06_stock_event_settings cfg on cfg.store_id = p.store_id
    and cfg.organization_id = p.organization_id and cfg.mode <> 'off'
  where i.id = new.inventory_item_id and i.organization_id = new.organization_id
    and i.tracked and v.is_active and p.status = 'ACTIVE';
  if store is null then return new; end if;
  payload := jsonb_build_object('inventory_state_id', new.id, 'product_id', product,
    'variant_id', variant, 'location_id', new.location_id,
    'previous_quantity', case when old.is_active then old.available_quantity else null end,
    'available_quantity', case when new.is_active then new.available_quantity else null end,
    'observed_at', new.updated_at);
  insert into public.a06_stock_event_queue as q
    (store_id, organization_id, changes, pending_since, due_at)
  values (store, new.organization_id, jsonb_build_object(change_key, payload), now(), now() + interval '60 seconds')
  on conflict (store_id) do update set
    revision = q.revision + 1,
    changes = case when q.revision = q.processed_revision then jsonb_build_object(change_key, payload)
      else q.changes || jsonb_build_object(change_key, payload || jsonb_build_object('previous_quantity',
        case when q.changes ? change_key then q.changes->change_key->'previous_quantity'
          else payload->'previous_quantity' end)) end,
    pending_since = case when q.revision = q.processed_revision then now() else q.pending_since end,
    due_at = case when q.revision = q.processed_revision then now() + interval '60 seconds'
      else least(q.pending_since + interval '5 minutes', now() + interval '60 seconds') end,
    updated_at = now();
  return new;
end;
$$;
revoke all on function private.a06_capture_inventory_change() from public, anon, authenticated;
drop trigger if exists a06_inventory_event on public.shopify_inventory_current_state;
create trigger a06_inventory_event after update of available_quantity, is_active
  on public.shopify_inventory_current_state for each row
  when (old.available_quantity is distinct from new.available_quantity or old.is_active is distinct from new.is_active)
  execute function private.a06_capture_inventory_change();

create function public.claim_a06_stock_events(batch_size integer default 5)
returns setof public.a06_stock_event_queue
language sql security invoker set search_path = '' as $$
  with due as (
    select q.store_id from public.a06_stock_event_queue q
    join public.a06_stock_event_settings cfg on cfg.store_id = q.store_id and cfg.mode <> 'off'
    where q.revision > q.processed_revision and q.due_at <= now()
      and (q.lease_until is null or q.lease_until < now())
    order by q.due_at, q.store_id limit greatest(1, least(batch_size, 20))
    for update of q skip locked
  )
  update public.a06_stock_event_queue q set lease_token = gen_random_uuid(),
    lease_until = now() + interval '30 minutes', updated_at = now()
  from due where q.store_id = due.store_id returning q.*;
$$;
revoke all on function public.claim_a06_stock_events(integer) from public, anon, authenticated;
grant execute on function public.claim_a06_stock_events(integer) to service_role;

-- Acknowledgements are fenced by the claim token. Never erase a newer change.
create function public.finish_a06_stock_event(
  target_store_id uuid, claim_token uuid, claim_revision bigint,
  retry_at timestamptz default null, model_signature text default null,
  model_ran boolean default false
) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  update public.a06_stock_event_queue q set
    processed_revision = case when retry_at is null then claim_revision else q.processed_revision end,
    changes = case when retry_at is null and q.revision = claim_revision then '{}'::jsonb else q.changes end,
    pending_since = case when retry_at is null and q.revision = claim_revision then null else now() end,
    due_at = case when retry_at is not null then retry_at
      when q.revision > claim_revision then now() + interval '60 seconds' else null end,
    lease_token = null, lease_until = null,
    last_model_at = case when model_ran then now() else q.last_model_at end,
    last_model_signature = case when model_ran then model_signature
      when retry_at is null and model_signature is null then null else q.last_model_signature end,
    updated_at = now()
  where q.store_id = target_store_id and q.lease_token = claim_token;
  return found;
end;
$$;
revoke all on function public.finish_a06_stock_event(uuid, uuid, bigint, timestamptz, text, boolean) from public, anon, authenticated;
grant execute on function public.finish_a06_stock_event(uuid, uuid, bigint, timestamptz, text, boolean) to service_role;

comment on table public.a06_stock_event_settings is
  'A06 pilot enrollment only. shadow records decisions without AI calls; coverage_review_days is a review threshold, never a supplier lead time or reorder point.';
