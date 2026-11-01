-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
create table if not exists public.a05_campaign_decision_claims (
  output_id uuid primary key references public.agent_outputs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token uuid not null,
  decision text not null check (decision in ('approved', 'rejected')),
  started_at timestamptz not null default now()
);
create index if not exists a05_campaign_decision_claims_org_idx on public.a05_campaign_decision_claims (organization_id);
alter table public.a05_campaign_decision_claims enable row level security;
revoke all on public.a05_campaign_decision_claims from public, anon, authenticated;
grant all on public.a05_campaign_decision_claims to service_role;
create or replace function public.a05_claim_campaign_decision(p_output_id uuid,p_organization_id uuid,p_token uuid,p_decision text) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_status text; v_claim public.a05_campaign_decision_claims%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then return false; end if;
  select status into v_status from public.agent_outputs where id = p_output_id and organization_id = p_organization_id for update;
  if not found or v_status in ('published', 'rejected') then return false; end if;
  select * into v_claim from public.a05_campaign_decision_claims where output_id = p_output_id for update;
  if found and v_claim.started_at > now() - interval '15 minutes' then return false; end if;
  delete from public.a05_campaign_decision_claims where output_id = p_output_id;
  insert into public.a05_campaign_decision_claims(output_id, organization_id, token, decision) values (p_output_id, p_organization_id, p_token, p_decision);
  return true;
end;
$$;
create or replace function public.a05_release_campaign_decision(p_output_id uuid,p_token uuid) returns boolean language sql security invoker set search_path = '' as $$
  with released as (delete from public.a05_campaign_decision_claims where output_id = p_output_id and token = p_token returning 1) select exists(select 1 from released);
$$;
create or replace function public.a05_finish_campaign_decision(p_output_id uuid,p_organization_id uuid,p_token uuid,p_decision text,p_decided_by uuid,p_reason text) returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_status text;
begin
  if p_decision not in ('approved', 'rejected') then return false; end if;
  select status into v_status from public.agent_outputs where id = p_output_id and organization_id = p_organization_id for update;
  if not found or v_status in ('published', 'rejected') then return false; end if;
  if not exists (select 1 from public.a05_campaign_decision_claims where output_id = p_output_id and organization_id = p_organization_id and token = p_token and decision = p_decision) then return false; end if;
  update public.agent_outputs set status = case when p_decision = 'approved' then 'published' else 'rejected' end, published_at = case when p_decision = 'approved' then now() else published_at end, updated_at = now() where id = p_output_id and organization_id = p_organization_id;
  insert into public.agent_approvals(output_id, organization_id, decision, decided_by, reason)
    select p_output_id, p_organization_id, p_decision, p_decided_by, p_reason
    where not exists (select 1 from public.agent_approvals where output_id = p_output_id and decision = p_decision);
  delete from public.a05_campaign_decision_claims where output_id = p_output_id and token = p_token;
  return true;
end;
$$;
revoke all on function public.a05_claim_campaign_decision(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.a05_release_campaign_decision(uuid, uuid) from public, anon, authenticated;
revoke all on function public.a05_finish_campaign_decision(uuid, uuid, uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.a05_claim_campaign_decision(uuid, uuid, uuid, text) to service_role;
grant execute on function public.a05_release_campaign_decision(uuid, uuid) to service_role;
grant execute on function public.a05_finish_campaign_decision(uuid, uuid, uuid, text, uuid, text) to service_role;
