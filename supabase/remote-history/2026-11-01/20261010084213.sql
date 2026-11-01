-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Prevent holdout repeated peeking: the calibrated judge sees each frozen
-- holdout/rubric pair once. Iteration belongs in development/calibration data.
create table if not exists public.agent_judge_holdout_claims (
  id uuid primary key default gen_random_uuid(),
  dataset_version text not null,
  rubric_version text not null,
  model text not null,
  request_id uuid not null unique,
  claimed_by uuid not null references auth.users(id),
  claimed_at timestamptz not null default now(),
  unique(dataset_version, rubric_version)
);
alter table public.agent_judge_holdout_claims enable row level security;
revoke all on public.agent_judge_holdout_claims from public, anon, authenticated;
grant select on public.agent_judge_holdout_claims to service_role;
drop trigger if exists agent_judge_holdout_claims_append_only on public.agent_judge_holdout_claims;
create trigger agent_judge_holdout_claims_append_only before update or delete on public.agent_judge_holdout_claims
for each row execute function public.reject_agent_judge_eval_mutation();

create or replace function private.claim_agent_judge_holdout(
  p_dataset_version text,
  p_rubric_version text,
  p_model text,
  p_request_id uuid,
  p_claimed_by uuid
)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, private as $$
declare v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('agent_judge_dataset:' || p_dataset_version, 0));
  if not exists (
    select 1 from public.agent_judge_eval_dataset_freezes f
    where f.dataset_version = p_dataset_version and f.rubric_version = p_rubric_version
  ) then
    raise exception 'agent_judge_holdout_not_frozen' using errcode = '23514';
  end if;
  insert into public.agent_judge_holdout_claims(dataset_version, rubric_version, model, request_id, claimed_by)
    values (p_dataset_version, p_rubric_version, p_model, p_request_id, p_claimed_by)
    returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'agent_judge_holdout_already_consumed' using errcode = '23505';
end;
$$;
revoke all on function private.claim_agent_judge_holdout(text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function private.claim_agent_judge_holdout(text, text, text, uuid, uuid) to service_role;

create or replace function public.claim_agent_judge_holdout(
  p_dataset_version text,
  p_rubric_version text,
  p_model text,
  p_request_id uuid,
  p_claimed_by uuid
)
returns uuid language sql security invoker set search_path = pg_catalog, private as $$
  select private.claim_agent_judge_holdout(p_dataset_version, p_rubric_version, p_model, p_request_id, p_claimed_by);
$$;
revoke all on function public.claim_agent_judge_holdout(text, text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.claim_agent_judge_holdout(text, text, text, uuid, uuid) to service_role;

comment on table public.agent_judge_holdout_claims is 'Append-only one-time claim preventing repeated evaluation against the same judge holdout/rubric pair.';


