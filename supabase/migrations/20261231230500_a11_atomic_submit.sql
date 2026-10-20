create or replace function public.submit_a11_marketing_draft(
  p_organization_id uuid, p_draft_id uuid, p_expected_version integer, p_actor_user_id uuid
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_draft public.marketing_content_drafts%rowtype;
begin
  update public.marketing_content_drafts
  set status='pending_approval', version=version+1,
      last_edited_by=p_actor_user_id, last_edited_at=now(), updated_at=now()
  where id=p_draft_id and organization_id=p_organization_id
    and status='draft' and version=p_expected_version
  returning * into v_draft;
  if not found then raise exception 'A11_MARKETING_DRAFT_SUBMIT_STALE'; end if;

  insert into public.marketing_content_draft_versions
    (draft_id, organization_id, version, change_type, edited_by, snapshot)
  values (v_draft.id, p_organization_id, v_draft.version, 'manual', p_actor_user_id, to_jsonb(v_draft));
  return to_jsonb(v_draft);
end;
$$;
revoke all on function public.submit_a11_marketing_draft(uuid,uuid,integer,uuid) from public, anon, authenticated;
grant execute on function public.submit_a11_marketing_draft(uuid,uuid,integer,uuid) to service_role;
