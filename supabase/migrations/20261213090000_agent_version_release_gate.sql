-- Las versiones nuevas se prueban inactivas y solo se promueven cuando su
-- versión exacta supera las suites offline y live del dataset vigente.
-- Un rollback reactiva la versión anterior en la misma transacción.

create or replace function private.agent_version_has_release_evidence(p_agent_version_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_code text;
  v_mode text;
begin
  select d.code into v_code
  from public.agent_versions av
  join public.agent_definitions d on d.id = av.definition_id
  where av.id = p_agent_version_id;
  if v_code is null then return false; end if;

  foreach v_mode in array array['offline', 'live'] loop
    if not exists (
      select 1
      from public.agent_version_evaluations e
      join public.agent_version_eval_results r on r.evaluation_id = e.id
      where e.agent_version_id = p_agent_version_id
        and e.dataset_version = '2026-09-29.v2'
        and e.evaluation_mode = v_mode
        and e.status = 'passed'
        and e.evaluated_agent_codes @> to_jsonb(array[v_code]::text[])
        and r.agent_code = v_code
        and r.passed is true
        and r.checks > 0
        and r.failed = '[]'::jsonb
    ) then return false; end if;
  end loop;
  return true;
end;
$$;

create or replace function private.require_agent_version_release_evidence()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
begin
  if new.is_active is not true
     or (tg_op = 'UPDATE' and old.is_active is true) then
    return new;
  end if;

  if not private.agent_version_has_release_evidence(new.id) then
    raise exception using errcode = '23514',
      message = 'agent_release_gate:evaluation_missing_or_failed';
  end if;

  return new;
end;
$$;

drop trigger if exists agent_versions_release_evidence_required on public.agent_versions;
create trigger agent_versions_release_evidence_required
before insert or update of is_active on public.agent_versions
for each row execute function private.require_agent_version_release_evidence();

revoke all on function private.require_agent_version_release_evidence() from public, anon, authenticated;
revoke all on function private.agent_version_has_release_evidence(uuid) from public, anon, authenticated;

create or replace function public.promote_agent_version(p_agent_version_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_definition_id uuid;
begin
  select definition_id into v_definition_id
  from public.agent_versions
  where id = p_agent_version_id
  for update;

  if v_definition_id is null then
    raise exception using errcode = 'P0002', message = 'agent_release_gate:candidate_not_found';
  end if;

  if not private.agent_version_has_release_evidence(p_agent_version_id) then
    raise exception using errcode = '23514',
      message = 'agent_release_gate:evaluation_missing_or_failed';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_definition_id::text, 0));

  -- The target trigger validates both evidence modes before this transaction
  -- can commit. If validation fails, deactivation rolls back with promotion.
  update public.agent_versions
  set is_active = false
  where definition_id = v_definition_id and is_active is true and id <> p_agent_version_id;

  update public.agent_versions
  set is_active = true
  where id = p_agent_version_id;
end;
$$;

revoke all on function public.promote_agent_version(uuid) from public, anon, authenticated;
grant execute on function public.promote_agent_version(uuid) to service_role;

comment on function public.promote_agent_version(uuid) is
  'Promotes one immutable agent version only after passing offline and live evidence for the current dataset; transaction preserves the previous active version on failure.';
