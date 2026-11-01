-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- A release holdout fixture is consumed by the first candidate run attempt.
-- Even failed/interrupted runs consume it so the same blind example cannot be
-- replayed while iterating on prompts or models.
create table if not exists public.agent_release_eval_holdout_claims (
  fixture_id uuid primary key references public.agent_release_eval_cases(id) on delete restrict,
  agent_version_id uuid not null references public.agent_versions(id) on delete restrict,
  claimed_at timestamptz not null default now()
);

alter table public.agent_release_eval_holdout_claims enable row level security;
revoke all on public.agent_release_eval_holdout_claims from public, anon, authenticated;
revoke all on public.agent_release_eval_holdout_claims from service_role;
grant select on public.agent_release_eval_holdout_claims to service_role;

create or replace function public.reject_agent_release_eval_holdout_claim_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  raise exception 'agent_release_eval_holdout_claims_are_append_only';
end;
$$;

drop trigger if exists agent_release_eval_holdout_claims_append_only
  on public.agent_release_eval_holdout_claims;
create trigger agent_release_eval_holdout_claims_append_only
before update or delete on public.agent_release_eval_holdout_claims
for each row execute function public.reject_agent_release_eval_holdout_claim_mutation();

create or replace function public.claim_agent_release_eval_holdout(
  p_fixture_ids uuid[],
  p_agent_version_id uuid,
  p_agent_code text
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_requested integer;
  v_release_rows integer;
begin
  if p_fixture_ids is null or cardinality(p_fixture_ids) = 0
     or p_agent_version_id is null or p_agent_code is null then
    raise exception 'agent_release_eval_holdout_claim_invalid';
  end if;

  select count(distinct id)::integer into v_requested
  from unnest(p_fixture_ids) as u(id);
  if v_requested <> cardinality(p_fixture_ids) then
    raise exception 'agent_release_eval_holdout_claim_duplicate_ids';
  end if;

  select count(*)::integer into v_release_rows
  from public.agent_release_eval_cases c
  where c.id = any(p_fixture_ids) and c.split = 'release' and c.agent_code = p_agent_code;
  if v_release_rows <> v_requested then
    raise exception 'agent_release_eval_holdout_claim_requires_release_fixtures';
  end if;

  if not exists (
    select 1 from public.agent_versions v
    join public.agent_definitions d on d.id = v.definition_id
    where v.id = p_agent_version_id and d.code = p_agent_code
  ) then
    raise exception 'agent_release_eval_holdout_candidate_mismatch';
  end if;

  -- The primary key is the concurrency-safe, global single-use lock. A unique
  -- violation aborts the whole statement, so no partial batch can be claimed.
  insert into public.agent_release_eval_holdout_claims (fixture_id, agent_version_id)
  select id, p_agent_version_id
  from unnest(p_fixture_ids) as u(id);

  return v_requested;
end;
$$;

revoke all on function public.claim_agent_release_eval_holdout(uuid[], uuid, text) from public, anon, authenticated;
grant execute on function public.claim_agent_release_eval_holdout(uuid[], uuid, text) to service_role;

comment on table public.agent_release_eval_holdout_claims is
  'Append-only one-time consumption ledger for candidate release holdout fixtures; any attempt consumes the case.'
