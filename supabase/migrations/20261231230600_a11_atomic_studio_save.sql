create or replace function public.save_a11_studio_draft(
  p_organization_id uuid, p_draft_id uuid, p_actor_user_id uuid,
  p_expected_version integer, p_fields jsonb, p_request jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_draft public.marketing_content_drafts%rowtype;
  v_leaves_review boolean;
begin
  select status <> 'draft' into v_leaves_review from public.marketing_content_drafts
    where id=p_draft_id and organization_id=p_organization_id and version=p_expected_version and status <> 'published'
    for update;
  if not found then raise exception 'A11_MARKETING_DRAFT_SAVE_STALE'; end if;

  update public.marketing_content_drafts set
    content_type=coalesce(p_fields->>'content_type',content_type),
    template_name=coalesce(p_fields->>'template_name',template_name),
    subject=coalesce(p_fields->>'subject',subject),
    preheader=coalesce(p_fields->>'preheader',preheader),
    from_name=coalesce(p_fields->>'from_name',from_name),
    reply_to=case when p_fields ? 'reply_to' then nullif(p_fields->>'reply_to','') else reply_to end,
    html=coalesce(p_fields->>'html',html),
    plain_text=coalesce(p_fields->>'plain_text',plain_text),
    blocks=coalesce(p_fields->'blocks',blocks),
    personalization_tokens=coalesce(p_fields->'personalization_tokens',personalization_tokens),
    request=p_request,
    version=version+1,
    status=case when v_leaves_review then 'draft' else status end,
    decided_by=case when v_leaves_review then null else decided_by end,
    decided_at=case when v_leaves_review then null else decided_at end,
    decision_reason=case when v_leaves_review then null else decision_reason end,
    last_edited_by=p_actor_user_id,last_edited_at=now(),updated_at=now()
  where id=p_draft_id and organization_id=p_organization_id and version=p_expected_version and status <> 'published'
  returning * into v_draft;
  if not found then raise exception 'A11_MARKETING_DRAFT_SAVE_STALE'; end if;

  insert into public.marketing_content_draft_versions
    (draft_id,organization_id,version,change_type,edited_by,snapshot)
  values(v_draft.id,p_organization_id,v_draft.version,'manual',p_actor_user_id,to_jsonb(v_draft));

  if v_leaves_review and v_draft.agent_output_id is not null then
    update public.agent_outputs set status='pending_approval'
      where id=v_draft.agent_output_id and organization_id=p_organization_id and status in ('approved','rejected');
  end if;
  return to_jsonb(v_draft);
end;
$$;
revoke all on function public.save_a11_studio_draft(uuid,uuid,uuid,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.save_a11_studio_draft(uuid,uuid,uuid,integer,jsonb,jsonb) to service_role;
