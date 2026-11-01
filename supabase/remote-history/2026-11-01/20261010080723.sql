-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Reviewer corrections now preserve the criterion label needed for judge calibration.
alter table public.agent_judgment_feedback
  add column if not exists corrected_status text,
  add column if not exists corrected_score smallint;

alter table public.agent_judgment_feedback
  add constraint agent_judgment_feedback_corrected_status check (
    corrected_status is null or corrected_status in ('evaluable', 'no_evaluable')
  ),
  add constraint agent_judgment_feedback_corrected_score check (
    corrected_score is null or corrected_score between 0 and 4
  ),
  add constraint agent_judgment_feedback_correction_shape check (
    (decision = 'corrected' and corrected_status = 'evaluable' and corrected_score is not null)
    or (decision = 'corrected' and corrected_status = 'no_evaluable' and corrected_score is null)
    or (decision = 'corrected' and corrected_status is null and corrected_score is null) -- legacy feedback before score capture
    or (decision <> 'corrected' and corrected_status is null and corrected_score is null)
  );

-- Replace the RPC in one migration so old callers cannot omit correction labels.
drop function if exists public.record_agent_judgment_feedback(uuid, uuid, uuid, text, text, text, text, uuid);

create function public.record_agent_judgment_feedback(
  p_judgment_id uuid,
  p_agent_run_id uuid,
  p_organization_id uuid,
  p_criterion_id text,
  p_decision text,
  p_reason_code text,
  p_note text,
  p_corrected_status text,
  p_corrected_score smallint,
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_reviewer_id uuid := auth.uid();
  v_existing public.agent_judgment_feedback%rowtype;
  v_feedback_id uuid;
begin
  if v_reviewer_id is null then
    raise insufficient_privilege using message = 'authentication_required';
  end if;
  if not (private.is_platform_admin() or private.is_assigned_consultant(p_organization_id)) then
    raise insufficient_privilege using message = 'judge_feedback_access_denied';
  end if;
  if p_decision not in ('agree', 'incorrect', 'not_applicable', 'corrected')
     or (p_decision <> 'agree' and p_reason_code is null)
     or (p_reason_code is not null and p_reason_code not in ('accuracy', 'missing_evidence', 'wrong_scope', 'not_actionable', 'duplicate', 'other'))
     or (p_reason_code = 'other' and length(trim(coalesce(p_note, ''))) = 0)
     or length(coalesce(p_note, '')) > 1200
     or (p_decision = 'corrected' and (p_corrected_status is null or p_corrected_status not in ('evaluable', 'no_evaluable')))
     or (p_decision = 'corrected' and p_corrected_status = 'evaluable' and (p_corrected_score is null or p_corrected_score not between 0 and 4))
     or (p_decision = 'corrected' and p_corrected_status = 'no_evaluable' and p_corrected_score is not null)
     or (p_decision <> 'corrected' and (p_corrected_status is not null or p_corrected_score is not null)) then
    raise check_violation using message = 'invalid_agent_judge_feedback';
  end if;
  if not exists (
    select 1
    from public.agent_run_judgments j
    cross join lateral jsonb_array_elements(coalesce(j.result->'criteria', '[]'::jsonb)) c
    where j.id = p_judgment_id
      and j.agent_run_id = p_agent_run_id
      and j.organization_id = p_organization_id
      and c->>'criterion_id' = p_criterion_id
  ) then
    raise check_violation using message = 'judge_feedback_criterion_not_in_rubric';
  end if;

  insert into public.agent_judgment_feedback (
    judgment_id, agent_run_id, organization_id, reviewer_id,
    criterion_id, decision, reason_code, note, corrected_status, corrected_score, request_id
  ) values (
    p_judgment_id, p_agent_run_id, p_organization_id, v_reviewer_id,
    p_criterion_id, p_decision, p_reason_code, nullif(trim(p_note), ''),
    p_corrected_status, p_corrected_score, p_request_id
  ) on conflict (reviewer_id, request_id) do nothing
  returning id into v_feedback_id;
  if v_feedback_id is not null then
    return v_feedback_id;
  end if;

  select * into v_existing
  from public.agent_judgment_feedback
  where reviewer_id = v_reviewer_id and request_id = p_request_id;
  if found then
    if v_existing.judgment_id <> p_judgment_id
       or v_existing.agent_run_id <> p_agent_run_id
       or v_existing.organization_id <> p_organization_id
       or v_existing.criterion_id <> p_criterion_id
       or v_existing.decision <> p_decision
       or v_existing.reason_code is distinct from p_reason_code
       or v_existing.note is distinct from nullif(trim(p_note), '')
       or v_existing.corrected_status is distinct from p_corrected_status
       or v_existing.corrected_score is distinct from p_corrected_score then
      raise unique_violation using message = 'feedback_request_id_reused_with_different_payload';
    end if;
    return v_existing.id;
  end if;
  raise unique_violation using message = 'feedback_idempotency_conflict';
end;
$$;

revoke all on function public.record_agent_judgment_feedback(uuid, uuid, uuid, text, text, text, text, text, smallint, uuid)
  from public, anon;
grant execute on function public.record_agent_judgment_feedback(uuid, uuid, uuid, text, text, text, text, text, smallint, uuid)
  to authenticated;

notify pgrst, 'reload schema';




