create table if not exists public.a11_marketing_generation_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  actor_user_id uuid not null,
  idempotency_key text not null,
  request_fingerprint text not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  attempt integer not null default 1 check (attempt > 0),
  draft_id uuid,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, actor_user_id, idempotency_key)
);

alter table public.a11_marketing_generation_requests enable row level security;
revoke all on public.a11_marketing_generation_requests from anon, authenticated;
grant select, insert, update on public.a11_marketing_generation_requests to service_role;

drop function if exists public.reserve_a11_marketing_generation(uuid, uuid, text, text, integer);
create or replace function public.reserve_a11_marketing_generation(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_daily_cap integer default 60
)
returns table(decision text, reserved_draft_id uuid, attempt integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.a11_marketing_generation_requests%rowtype;
  v_used integer;
  v_key text := left(coalesce(p_idempotency_key, ''), 64);
begin
  if p_organization_id is null or p_actor_user_id is null or v_key = '' or p_request_fingerprint !~ '^[0-9a-f]{64}$' then
    return query select 'invalid'::text, null::uuid, 0;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_organization_id::text || ':' || p_actor_user_id::text || ':' || (now() at time zone 'utc')::date::text, 0));
  select * into v_row
    from public.a11_marketing_generation_requests r
   where r.organization_id = p_organization_id
     and r.actor_user_id = p_actor_user_id
     and r.idempotency_key = v_key
   for update;

  if found then
    if v_row.request_fingerprint <> p_request_fingerprint then
      return query select 'conflict'::text, v_row.draft_id, v_row.attempt;
      return;
    end if;
    if v_row.status = 'completed' then
      return query select 'replay'::text, v_row.draft_id, v_row.attempt;
      return;
    end if;
    if v_row.status = 'running' and v_row.updated_at > now() - interval '15 minutes' then
      return query select 'in_progress'::text, v_row.draft_id, v_row.attempt;
      return;
    end if;
    update public.a11_marketing_generation_requests r
       set status = 'running', attempt = r.attempt + 1, updated_at = now(), last_error_code = null
     where r.id = v_row.id
     returning * into v_row;
    return query select 'reserved'::text, v_row.draft_id, v_row.attempt;
    return;
  end if;

  select count(*)::integer into v_used
    from public.a11_marketing_generation_requests r
   where r.organization_id = p_organization_id
     and r.actor_user_id = p_actor_user_id
     and r.created_at >= ((now() at time zone 'utc')::date at time zone 'utc');
  if v_used >= greatest(1, least(coalesce(p_daily_cap, 60), 200)) then
    return query select 'daily_limit'::text, null::uuid, 0;
    return;
  end if;

  insert into public.a11_marketing_generation_requests (organization_id, actor_user_id, idempotency_key, request_fingerprint)
  values (p_organization_id, p_actor_user_id, v_key, p_request_fingerprint)
  returning * into v_row;
  return query select 'reserved'::text, v_row.draft_id, v_row.attempt;
end;
$$;

revoke all on function public.reserve_a11_marketing_generation(uuid, uuid, text, text, integer) from public, anon, authenticated;
grant execute on function public.reserve_a11_marketing_generation(uuid, uuid, text, text, integer) to service_role;

drop function if exists public.finish_a11_marketing_generation(uuid, uuid, text, text, uuid, text);
create or replace function public.finish_a11_marketing_generation(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_idempotency_key text,
  p_status text,
  p_draft_id uuid default null,
  p_error_code text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_status not in ('completed', 'failed') then return false; end if;
  update public.a11_marketing_generation_requests r
     set status = p_status,
         draft_id = case when p_status = 'completed' then p_draft_id else null end,
         last_error_code = case when p_status = 'failed' then left(coalesce(p_error_code, 'generation_failed'), 120) else null end,
         updated_at = now()
   where r.organization_id = p_organization_id
     and r.actor_user_id = p_actor_user_id
     and r.idempotency_key = left(coalesce(p_idempotency_key, ''), 64);
  return found;
end;
$$;

revoke all on function public.finish_a11_marketing_generation(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.finish_a11_marketing_generation(uuid, uuid, text, text, uuid, text) to service_role;

create table if not exists public.marketing_draft_export_operations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  draft_id uuid not null,
  draft_version integer not null check (draft_version > 0),
  connection_id uuid not null,
  html_sha256 text not null check (html_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  klaviyo_template_id text,
  error_code text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, draft_id, draft_version, connection_id)
);

alter table public.marketing_draft_export_operations enable row level security;
revoke all on public.marketing_draft_export_operations from anon, authenticated;
grant select, insert, update on public.marketing_draft_export_operations to service_role;

create index if not exists marketing_draft_export_operations_recent_idx
  on public.marketing_draft_export_operations (organization_id, created_at desc);

comment on table public.a11_marketing_generation_requests is
  'Reserva de ejecuciones de A11 antes de llamar al proveedor; permite replay y evita doble gasto por reintentos.';
comment on table public.marketing_draft_export_operations is
  'Recibo idempotente de exportación del HTML aprobado a una cuenta Klaviyo concreta.';
