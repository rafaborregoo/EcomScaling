create or replace function public.decide_a11_marketing_draft(
  p_organization_id uuid,
  p_draft_id uuid,
  p_expected_version integer,
  p_decision text,
  p_decided_by uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft public.marketing_content_drafts%rowtype;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'A11_INVALID_DECISION';
  end if;

  update public.marketing_content_drafts
  set status = p_decision,
      decided_by = p_decided_by,
      decided_at = now(),
      decision_reason = p_reason
  where id = p_draft_id
    and organization_id = p_organization_id
    and status = 'pending_approval'
    and version = p_expected_version
  returning * into v_draft;

  if not found then
    raise exception 'A11_MARKETING_DRAFT_STALE';
  end if;

  if v_draft.agent_output_id is not null then
    update public.agent_outputs
    set status = p_decision
    where id = v_draft.agent_output_id
      and organization_id = p_organization_id
      and status = 'pending_approval';

    if not found then
      raise exception 'A11_AGENT_OUTPUT_NOT_PENDING';
    end if;

    insert into public.agent_approvals (output_id, organization_id, decision, decided_by, reason)
    values (v_draft.agent_output_id, p_organization_id, p_decision, p_decided_by, p_reason);
  end if;

  return to_jsonb(v_draft);
end;
$$;

revoke all on function public.decide_a11_marketing_draft(uuid, uuid, integer, text, uuid, text) from public, anon, authenticated;
grant execute on function public.decide_a11_marketing_draft(uuid, uuid, integer, text, uuid, text) to service_role;
