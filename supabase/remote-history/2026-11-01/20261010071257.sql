-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
-- Append-only consultant feedback for human calibration of the agent judge.
create table if not exists public.agent_judgment_feedback (
  id uuid primary key default gen_random_uuid(),
  judgment_id uuid not null references public.agent_run_judgments(id) on delete cascade,
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete cascade,
  criterion_id text not null check (length(criterion_id) between 1 and 100),
  decision text not null check (decision in ('agree', 'incorrect', 'not_applicable', 'corrected')),
  reason_code text check (reason_code is null or reason_code in ('accuracy', 'missing_evidence', 'wrong_scope', 'not_actionable', 'duplicate', 'other')),
  note text check (note is null or length(note) <= 1200),
  request_id uuid not null,
  created_at timestamptz not null default now(),
  constraint agent_judgment_feedback_disagreement_reason check (
    decision = 'agree' or reason_code is not null
  ),
  constraint agent_judgment_feedback_other_note check (
    reason_code is distinct from 'other' or length(trim(coalesce(note, ''))) > 0
  ),
  constraint agent_judgment_feedback_request_unique unique (reviewer_id, request_id)
);

create index if not exists agent_judgment_feedback_run_idx
  on public.agent_judgment_feedback (organization_id, agent_run_id, reviewer_id, created_at desc);
create index if not exists agent_judgment_feedback_judgment_idx
  on public.agent_judgment_feedback (judgment_id, criterion_id, created_at desc);

alter table public.agent_judgment_feedback enable row level security;
revoke all on public.agent_judgment_feedback from anon, authenticated;
grant select, insert, update, delete on public.agent_judgment_feedback to service_role;

create or replace function public.record_agent_judgment_feedback(
  p_judgment_id uuid,
  p_agent_run_id uuid,
  p_organization_id uuid,
  p_criterion_id text,
  p_decision text,
  p_reason_code text,
  p_note text,
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
     or length(coalesce(p_note, '')) > 1200 then
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
    criterion_id, decision, reason_code, note, request_id
  ) values (
    p_judgment_id, p_agent_run_id, p_organization_id, v_reviewer_id,
    p_criterion_id, p_decision, p_reason_code, nullif(trim(p_note), ''), p_request_id
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
       or v_existing.note is distinct from p_note then
      raise unique_violation using message = 'feedback_request_id_reused_with_different_payload';
    end if;
    return v_existing.id;
  end if;
  raise unique_violation using message = 'feedback_idempotency_conflict';
end;
$$;

revoke all on function public.record_agent_judgment_feedback(uuid, uuid, uuid, text, text, text, text, uuid)
  from public, anon;
grant execute on function public.record_agent_judgment_feedback(uuid, uuid, uuid, text, text, text, text, uuid)
  to authenticated;

comment on table public.agent_judgment_feedback is
  'Append-only consultant labels on judge criteria; service-role reads are exposed only through organization-scoped trace APIs.';


