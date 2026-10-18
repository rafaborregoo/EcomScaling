-- Durable idempotency keys for proposed tasks. Old tasks remain readable and
-- simply have null keys.
alter table public.tasks
  add column if not exists agent_output_id uuid references public.agent_outputs(id) on delete set null,
  add column if not exists agent_proposal_index integer;

alter table public.shopify_stores
  add column if not exists country_code varchar(2),
  add column if not exists market_codes text[] not null default '{}',
  add column if not exists business_vertical text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'shopify_stores_country_code_supported' and conrelid = 'public.shopify_stores'::regclass) then
    alter table public.shopify_stores add constraint shopify_stores_country_code_supported
      check (country_code is null or country_code in ('ES', 'PT', 'FR', 'IT', 'DE', 'GB', 'US', 'MX'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'shopify_stores_market_codes_supported' and conrelid = 'public.shopify_stores'::regclass) then
    alter table public.shopify_stores add constraint shopify_stores_market_codes_supported
      check (market_codes <@ array['ES', 'PT', 'FR', 'IT', 'DE', 'UK', 'US', 'MX']::text[]);
  end if;
end $$;

comment on column public.shopify_stores.market_codes is
  'Mercados de venta configurados para el calendario comercial; vacío significa desconocido.';

create unique index if not exists tasks_agent_proposal_once_idx
  on public.tasks (agent_output_id, agent_proposal_index);

create table if not exists public.agent_output_decision_claims (
  output_id uuid primary key references public.agent_outputs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  edits jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now()
);

alter table public.agent_output_decision_claims enable row level security;
revoke all on public.agent_output_decision_claims from public, anon, authenticated;
grant all on public.agent_output_decision_claims to service_role;

create or replace function public.claim_agent_output_decision(
  p_output_id uuid,
  p_organization_id uuid,
  p_token uuid,
  p_decision text,
  p_edits jsonb default '[]'::jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_output public.agent_outputs%rowtype;
  v_claim public.agent_output_decision_claims%rowtype;
  v_effective_edits jsonb;
begin
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('claimed', false, 'reason', 'invalid_decision');
  end if;
  select * into v_output
    from public.agent_outputs
    where id = p_output_id and organization_id = p_organization_id
    for update;
  if not found or v_output.status <> 'pending_approval' then
    return jsonb_build_object('claimed', false, 'reason', 'not_pending');
  end if;
  if nullif(v_output.output->>'decision_intent', '') is not null
     and v_output.output->>'decision_intent' <> p_decision then
    return jsonb_build_object('claimed', false, 'reason', 'decision_conflict');
  end if;

  select * into v_claim from public.agent_output_decision_claims
    where output_id = p_output_id for update;
  if found and v_claim.started_at > now() - interval '30 minutes' then
    return jsonb_build_object('claimed', false, 'reason', 'decision_in_progress');
  end if;
  if found and v_claim.decision <> p_decision then
    return jsonb_build_object('claimed', false, 'reason', 'decision_conflict');
  end if;
  if found then
    v_effective_edits := case
      when jsonb_typeof(p_edits) = 'array' and jsonb_array_length(p_edits) > 0 then p_edits
      else v_claim.edits
    end;
    delete from public.agent_output_decision_claims where output_id = p_output_id;
  else
    v_effective_edits := case when jsonb_typeof(p_edits) = 'array' then p_edits else '[]'::jsonb end;
  end if;

  insert into public.agent_output_decision_claims
    (output_id, organization_id, token, decision, edits)
  values
    (p_output_id, p_organization_id, p_token, p_decision,
     v_effective_edits);
  update public.agent_outputs
    set output = output || jsonb_build_object('proposal_edits', v_effective_edits, 'decision_intent', p_decision), updated_at = now()
    where id = p_output_id;
  select * into v_output from public.agent_outputs where id = p_output_id;
  return jsonb_build_object('claimed', true, 'output', v_output.output, 'run_id', v_output.run_id);
end;
$$;

revoke all on function public.claim_agent_output_decision(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.claim_agent_output_decision(uuid, uuid, uuid, text, jsonb) to service_role;

create or replace function public.release_agent_output_decision(
  p_output_id uuid,
  p_token uuid
) returns boolean
language sql
security invoker
set search_path = ''
as $$
  with released as (
    delete from public.agent_output_decision_claims
    where output_id = p_output_id and token = p_token
    returning 1
  ) select exists(select 1 from released);
$$;

revoke all on function public.release_agent_output_decision(uuid, uuid) from public, anon, authenticated;
grant execute on function public.release_agent_output_decision(uuid, uuid) to service_role;

create table if not exists public.agent_manual_refresh_reservations (
  run_id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  agent_code text not null,
  reserved_at timestamptz not null default now(),
  request_key text,
  reservation_day date not null default ((now() at time zone 'utc')::date)
);

alter table public.agent_manual_refresh_reservations add column if not exists request_key text;
alter table public.agent_manual_refresh_reservations add column if not exists reservation_day date not null default ((now() at time zone 'utc')::date);
create unique index if not exists agent_manual_refresh_request_once_idx
  on public.agent_manual_refresh_reservations (organization_id, agent_code, reservation_day, request_key)
  where request_key is not null;
create index if not exists agent_manual_refresh_count_idx
  on public.agent_manual_refresh_reservations (organization_id, agent_code, reserved_at desc);

alter table public.agent_manual_refresh_reservations enable row level security;
revoke all on public.agent_manual_refresh_reservations from public, anon, authenticated;
grant all on public.agent_manual_refresh_reservations to service_role;

create or replace function public.reserve_agent_manual_refresh(
  p_run_id uuid,
  p_organization_id uuid,
  p_agent_code text,
  p_daily_limit integer,
  p_request_key text default null
) returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_day_start timestamptz := date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  v_reserved integer;
  v_runs integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_agent_code || ':' || v_day_start::text, 0));
  if p_request_key is not null and exists (
    select 1 from public.agent_manual_refresh_reservations
    where organization_id = p_organization_id and agent_code = p_agent_code
      and reservation_day = v_day_start::date and request_key = p_request_key
  ) then
    return 'duplicate';
  end if;
  select count(*) into v_runs
    from public.agent_runs r
    join public.agent_versions v on v.id = r.agent_version_id
    join public.agent_definitions d on d.id = v.definition_id
    where r.organization_id = p_organization_id and r.trigger_type = 'manual'
      and r.started_at >= v_day_start and d.code = p_agent_code
      and not exists (select 1 from public.agent_manual_refresh_reservations q where q.run_id = r.id);
  select count(*) into v_reserved from public.agent_manual_refresh_reservations
    where organization_id = p_organization_id and agent_code = p_agent_code
      and reserved_at >= v_day_start;
  if v_runs + v_reserved >= greatest(p_daily_limit, 0) then
    return 'limit';
  end if;
  insert into public.agent_manual_refresh_reservations(run_id, organization_id, agent_code, request_key)
  values (p_run_id, p_organization_id, p_agent_code, p_request_key)
  on conflict do nothing;
  return case when found then 'reserved' else 'duplicate' end;
end;
$$;

revoke all on function public.reserve_agent_manual_refresh(uuid, uuid, text, integer, text) from public, anon, authenticated;
grant execute on function public.reserve_agent_manual_refresh(uuid, uuid, text, integer, text) to service_role;

comment on table public.agent_manual_refresh_reservations is
  'Atomic per-organization/agent UTC-day manual run reservations; failed attempts consume the reserved slot for that day.';
