-- Candidate release evidence must prove that each live case ran the exact
-- immutable version whose manifest was captured for the evaluation.
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
        and (v_mode <> 'live' or (
          coalesce((e.evidence->>'gold_cases')::integer, 0) >= 10
          and coalesce((e.evidence->>'holdout_cases')::integer, 0) >= 3
          and e.evidence->>'candidate_pin_verified' = 'true'
          and coalesce((e.evidence->>'candidate_pinned_cases')::integer, 0)
            >= coalesce((e.evidence->>'gold_cases')::integer, 0)
              + coalesce((e.evidence->>'holdout_cases')::integer, 0)
        ))
        and r.agent_code = v_code and r.passed is true and r.checks > 0 and r.failed = '[]'::jsonb
    ) then return false; end if;
  end loop;
  if not exists (
    select 1 from public.agent_judge_calibration_runs cr
    join public.agent_judge_eval_dataset_freezes f on f.dataset_version = cr.dataset_version and f.rubric_version = cr.rubric_version
    join public.agent_judge_holdout_claims hc on hc.dataset_version = cr.dataset_version and hc.rubric_version = cr.rubric_version and hc.model = cr.model
    where cr.status = 'passed' and cr.evaluation_split = 'holdout' and cr.rubric_version = 'judge-rubrics-v1'
      and cr.report->>'allowed' = 'true' and cr.report->>'holdout_only' = 'true'
      and cr.report->>'holdout_manifest_sha256' = f.manifest_sha256
      and not exists (
        select 1 from public.agent_judge_calibration_runs newer
        where newer.dataset_version = cr.dataset_version and newer.rubric_version = cr.rubric_version
          and newer.evaluation_split = 'holdout' and newer.created_at > cr.created_at
      )
  ) then return false; end if;
  return true;
end;
$$;
revoke all on function private.agent_version_has_release_evidence(uuid) from public, anon, authenticated;
