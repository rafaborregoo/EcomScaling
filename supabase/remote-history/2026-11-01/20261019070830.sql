-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
create table if not exists public.a11_studio_chat_requests (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  request_date date not null default (now() at time zone 'utc')::date,
  fingerprint text not null,
  status text not null check (status in ('running', 'completed')),
  response jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, actor_user_id, request_id)
);
alter table public.a11_studio_chat_requests enable row level security;
revoke all on public.a11_studio_chat_requests from public, anon, authenticated;
grant all on public.a11_studio_chat_requests to service_role;

create or replace function public.reserve_a11_studio_chat_request(
  p_organization_id uuid, p_actor_user_id uuid, p_request_id uuid,
  p_fingerprint text, p_daily_cap integer
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_existing public.a11_studio_chat_requests%rowtype;
  v_used integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_actor_user_id::text || ':' || (now() at time zone 'utc')::date::text, 11));
  select * into v_existing from public.a11_studio_chat_requests
    where organization_id=p_organization_id and actor_user_id=p_actor_user_id and request_id=p_request_id;
  if found then
    if v_existing.fingerprint <> p_fingerprint then return jsonb_build_object('status','key_reused'); end if;
    if v_existing.status='completed' then return jsonb_build_object('status','completed','response',v_existing.response); end if;
    return jsonb_build_object('status','running');
  end if;
  select count(*)::integer into v_used from public.a11_studio_chat_requests
    where organization_id=p_organization_id and actor_user_id=p_actor_user_id and request_date=(now() at time zone 'utc')::date;
  if v_used >= p_daily_cap then return jsonb_build_object('status','daily_cap','used',v_used); end if;
  insert into public.a11_studio_chat_requests(organization_id,actor_user_id,request_id,request_date,fingerprint,status)
    values(p_organization_id,p_actor_user_id,p_request_id,(now() at time zone 'utc')::date,p_fingerprint,'running');
  return jsonb_build_object('status','reserved','used',v_used+1);
end;
$$;

create or replace function public.finish_a11_studio_chat_request(
  p_organization_id uuid, p_actor_user_id uuid, p_request_id uuid,
  p_fingerprint text, p_response jsonb
) returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update public.a11_studio_chat_requests set status='completed', response=p_response, updated_at=now()
    where organization_id=p_organization_id and actor_user_id=p_actor_user_id and request_id=p_request_id
      and fingerprint=p_fingerprint and status='running';
  return found;
end;
$$;

revoke all on function public.reserve_a11_studio_chat_request(uuid,uuid,uuid,text,integer) from public, anon, authenticated;
revoke all on function public.finish_a11_studio_chat_request(uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.reserve_a11_studio_chat_request(uuid,uuid,uuid,text,integer) to service_role;
grant execute on function public.finish_a11_studio_chat_request(uuid,uuid,uuid,text,jsonb) to service_role;


