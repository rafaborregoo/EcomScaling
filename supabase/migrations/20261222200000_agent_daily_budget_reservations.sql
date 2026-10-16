-- Reserve the per-run maximum while an agent is active. A process-local check
-- cannot protect the organization budget from concurrent requests.

create table if not exists public.agent_daily_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null unique,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_day date not null,
  reserved_usd numeric(12, 6) not null check (reserved_usd >= 0),
  actual_usd numeric(12, 6),
  state text not null default 'reserved' check (state in ('reserved', 'settled')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists agent_daily_budget_reservations_active_idx
  on public.agent_daily_budget_reservations (organization_id, budget_day, expires_at)
  where state = 'reserved';

alter table public.agent_daily_budget_reservations enable row level security;
revoke all on public.agent_daily_budget_reservations from public, anon, authenticated;
grant all on public.agent_daily_budget_reservations to service_role;

create or replace function public.reserve_agent_daily_budget(
  target_organization_id uuid,
  reservation_run_id uuid,
  reservation_usd numeric,
  daily_budget_usd numeric
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_spent numeric(14, 6);
  v_reserved numeric(14, 6);
  v_existing public.agent_daily_budget_reservations%rowtype;
begin
  if reservation_usd < 0 or daily_budget_usd <= 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_budget');
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(target_organization_id::text || ':' || v_day::text, 0)
  );

  select * into v_existing
    from public.agent_daily_budget_reservations
   where run_id = reservation_run_id
     and organization_id = target_organization_id;
  if found then
    return jsonb_build_object('ok', true, 'existing', true);
  end if;

  select coalesce(sum(coalesce(estimated_cost_usd, 0)), 0)
    into v_spent
    from public.agent_runs
   where organization_id = target_organization_id
     and started_at >= v_start
     and started_at < v_start + interval '1 day';

  select coalesce(sum(reserved_usd), 0)
    into v_reserved
    from public.agent_daily_budget_reservations
   where organization_id = target_organization_id
     and budget_day = v_day
     and state = 'reserved'
     and expires_at > now();

  if v_spent + v_reserved + reservation_usd > daily_budget_usd then
    return jsonb_build_object(
      'ok', false,
      'error', 'daily_budget_exceeded',
      'spent_usd', v_spent,
      'reserved_usd', v_reserved,
      'requested_usd', reservation_usd,
      'remaining_usd', greatest(0, daily_budget_usd - v_spent - v_reserved)
    );
  end if;

  insert into public.agent_daily_budget_reservations (
    run_id, organization_id, budget_day, reserved_usd, expires_at
  ) values (
    reservation_run_id, target_organization_id, v_day, reservation_usd, now() + interval '24 hours'
  );

  return jsonb_build_object(
    'ok', true,
    'spent_usd', v_spent,
    'reserved_usd', v_reserved + reservation_usd,
    'remaining_usd', greatest(0, daily_budget_usd - v_spent - v_reserved - reservation_usd)
  );
end;
$$;

create or replace function public.settle_agent_daily_budget(
  target_organization_id uuid,
  reservation_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actual numeric(12, 6);
begin
  select coalesce(estimated_cost_usd, 0)
    into v_actual
    from public.agent_runs
   where id = reservation_run_id
     and organization_id = target_organization_id;
  v_actual := coalesce(v_actual, 0);

  update public.agent_daily_budget_reservations
     set state = 'settled',
         actual_usd = v_actual,
         settled_at = now()
   where run_id = reservation_run_id
     and organization_id = target_organization_id
     and state = 'reserved';

  return jsonb_build_object('ok', true, 'actual_usd', v_actual);
end;
$$;

revoke all on function public.reserve_agent_daily_budget(uuid, uuid, numeric, numeric) from public, anon, authenticated;
revoke all on function public.settle_agent_daily_budget(uuid, uuid) from public, anon, authenticated;
grant execute on function public.reserve_agent_daily_budget(uuid, uuid, numeric, numeric) to service_role;
grant execute on function public.settle_agent_daily_budget(uuid, uuid) to service_role;

comment on function public.reserve_agent_daily_budget(uuid, uuid, numeric, numeric) is
  'Atomically reserves an agent run maximum against the UTC organization budget under an advisory transaction lock.';
