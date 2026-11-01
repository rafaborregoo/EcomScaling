-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Freeze each adjudicated holdout before calibration and bind release promotion
-- to the latest passing calibration for that immutable dataset version.
create table if not exists public.agent_judge_eval_dataset_freezes (
  dataset_version text primary key,
  rubric_version text not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  case_count integer not null check (case_count > 0),
  frozen_at timestamptz not null default now()
);
alter table public.agent_judge_eval_dataset_freezes enable row level security;
revoke all on public.agent_judge_eval_dataset_freezes from public, anon, authenticated;
grant select on public.agent_judge_eval_dataset_freezes to service_role;

create or replace function private.reject_frozen_agent_judge_dataset_mutation()
returns trigger language plpgsql set search_path = pg_catalog, public, private as $$
declare v_dataset_version text;
begin
  if tg_table_name = 'agent_judge_eval_cases' then
    v_dataset_version := coalesce(new.dataset_version, old.dataset_version);
  elsif tg_table_name = 'agent_judge_eval_case_reviews' then
    select dataset_version into v_dataset_version from public.agent_judge_eval_cases where id = coalesce(new.case_id, old.case_id);
  else
    select dataset_version into v_dataset_version from public.agent_judge_eval_cases where id = coalesce(new.case_id, old.case_id);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('agent_judge_dataset:' || v_dataset_version, 0));
  if exists (select 1 from public.agent_judge_eval_dataset_freezes where dataset_version = v_dataset_version) then
    raise exception 'agent_judge_dataset_frozen' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function private.reject_frozen_agent_judge_dataset_mutation() from public, anon, authenticated;

drop trigger if exists agent_judge_cases_freeze_guard on public.agent_judge_eval_cases;
create trigger agent_judge_cases_freeze_guard before insert or update or delete on public.agent_judge_eval_cases
for each row execute function private.reject_frozen_agent_judge_dataset_mutation();
drop trigger if exists agent_judge_reviews_freeze_guard on public.agent_judge_eval_case_reviews;
create trigger agent_judge_reviews_freeze_guard before insert or update or delete on public.agent_judge_eval_case_reviews
for each row execute function private.reject_frozen_agent_judge_dataset_mutation();
drop trigger if exists agent_judge_adjudications_freeze_guard on public.agent_judge_eval_case_adjudications;
create trigger agent_judge_adjudications_freeze_guard before insert or update or delete on public.agent_judge_eval_case_adjudications
for each row execute function private.reject_frozen_agent_judge_dataset_mutation();

create or replace function private.freeze_agent_judge_holdout(p_dataset_version text, p_rubric_version text)
returns table(manifest_sha256 text, case_count integer)
language plpgsql security definer set search_path = pg_catalog, public, private, extensions as $$
declare v_count integer; v_approved integer; v_manifest text;
begin
  if p_dataset_version is null or length(btrim(p_dataset_version)) not between 1 and 80 then
    raise exception 'agent_judge_holdout_not_ready:invalid_version' using errcode = '23514';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('agent_judge_dataset:' || p_dataset_version, 0));
  if exists (select 1 from public.agent_judge_eval_dataset_freezes f where f.dataset_version = p_dataset_version and f.rubric_version <> p_rubric_version) then
    raise exception 'agent_judge_holdout_not_ready:rubric_version_mismatch' using errcode = '23514';
  end if;
  select count(*) into v_count from public.agent_judge_eval_cases c
    where c.dataset_version = p_dataset_version and c.split = 'holdout';
  if v_count = 0 then raise exception 'agent_judge_holdout_not_ready:empty' using errcode = '23514'; end if;
  select count(*) into v_approved
  from public.agent_judge_eval_cases c
  join lateral (
    select count(*) as n, count(distinct r.reviewer_id) as reviewers,
      bool_and(r.reviewer_id <> a.adjudicator_id) as independent
    from public.agent_judge_eval_case_reviews r
    left join public.agent_judge_eval_case_adjudications a on a.case_id = c.id
    where r.case_id = c.id
  ) rv on true
  join public.agent_judge_eval_case_adjudications a on a.case_id = c.id
  where c.dataset_version = p_dataset_version and c.split = 'holdout'
    and c.rubric_version = p_rubric_version and c.provenance = 'anonymized_production'
    and c.privacy_reviewed is true and rv.n = 2 and rv.reviewers = 2 and rv.independent is true
    and a.adjudicator_id not in (select r.reviewer_id from public.agent_judge_eval_case_reviews r where r.case_id = c.id);
  if v_approved <> v_count then raise exception 'agent_judge_holdout_not_ready:unapproved_cases' using errcode = '23514'; end if;
  select encode(extensions.digest(convert_to(coalesce(jsonb_agg(jsonb_build_object(
    'case', to_jsonb(c), 'reviews', coalesce(rv.items, '[]'::jsonb), 'adjudication', to_jsonb(a)
  ) order by c.id)::text, '[]'), 'UTF8'), 'sha256'), 'hex')
    into v_manifest
  from public.agent_judge_eval_cases c
  join public.agent_judge_eval_case_adjudications a on a.case_id = c.id
  join lateral (select jsonb_agg(to_jsonb(r) order by r.reviewer_id) as items from public.agent_judge_eval_case_reviews r where r.case_id = c.id) rv on true
  where c.dataset_version = p_dataset_version and c.split = 'holdout';
  insert into public.agent_judge_eval_dataset_freezes(dataset_version, rubric_version, manifest_sha256, case_count)
    values (p_dataset_version, p_rubric_version, v_manifest, v_count)
    on conflict (dataset_version) do nothing;
  return query select f.manifest_sha256, f.case_count from public.agent_judge_eval_dataset_freezes f where f.dataset_version = p_dataset_version;
end;
$$;
revoke all on function private.freeze_agent_judge_holdout(text, text) from public, anon, authenticated;
grant execute on function private.freeze_agent_judge_holdout(text, text) to service_role;

create or replace function public.freeze_agent_judge_holdout(p_dataset_version text, p_rubric_version text)
returns table(manifest_sha256 text, case_count integer)
language sql security invoker set search_path = pg_catalog, private as $$
  select * from private.freeze_agent_judge_holdout(p_dataset_version, p_rubric_version);
$$;
revoke all on function public.freeze_agent_judge_holdout(text, text) from public, anon, authenticated;
grant execute on function public.freeze_agent_judge_holdout(text, text) to service_role;

create or replace function private.agent_version_has_release_evidence(p_agent_version_id uuid)
returns boolean language plpgsql stable security definer
set search_path = pg_catalog, public, private, extensions as $$
declare v_code text; v_fingerprint text; v_mode text;
begin
  select d.code, m.manifest_sha256 into v_code, v_fingerprint
  from public.agent_versions av
  join public.agent_definitions d on d.id = av.definition_id
  join public.agent_version_release_manifests m on m.agent_version_id = av.id
  where av.id = p_agent_version_id
    and m.manifest_sha256 = private.agent_version_release_manifest(av.id)->>'manifest_sha256';
  if v_code is null or v_fingerprint is null then return false; end if;
  foreach v_mode in array array['offline', 'live'] loop
    if not exists (
      select 1 from public.agent_version_evaluations e
      join public.agent_version_eval_results r on r.evaluation_id = e.id
      where e.agent_version_id = p_agent_version_id and e.dataset_version = '2026-09-29.v2'
        and e.evaluation_mode = v_mode and e.status = 'passed'
        and e.evaluated_agent_codes @> to_jsonb(array[v_code]::text[])
        and e.evidence->>'candidate_fingerprint' = v_fingerprint
        and e.evidence->>'release_eligible' = 'true'
        and (v_mode <> 'live' or (coalesce((e.evidence->>'gold_cases')::integer, 0) >= 10 and coalesce((e.evidence->>'holdout_cases')::integer, 0) >= 3))
        and r.agent_code = v_code and r.passed is true and r.checks > 0 and r.failed = '[]'::jsonb
    ) then return false; end if;
  end loop;
  if not exists (
    select 1 from public.agent_judge_calibration_runs cr
    join public.agent_judge_eval_dataset_freezes f on f.dataset_version = cr.dataset_version
    where cr.status = 'passed' and cr.rubric_version = 'judge-rubrics-v1'
      and cr.report->>'allowed' = 'true'
      and cr.report->>'holdout_manifest_sha256' = f.manifest_sha256
      and not exists (select 1 from public.agent_judge_calibration_runs newer where newer.dataset_version = cr.dataset_version and newer.created_at > cr.created_at)
  ) then return false; end if;
  return true;
end;
$$;
revoke all on function private.agent_version_has_release_evidence(uuid) from public, anon, authenticated;

comment on table public.agent_judge_eval_dataset_freezes is 'Immutable SHA-256 manifest of fully adjudicated holdout cases; a new dataset version is required to change cases.';


