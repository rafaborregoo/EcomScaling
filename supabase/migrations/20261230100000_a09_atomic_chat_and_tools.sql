-- Persist an A09 answer, its proposed writes and the completed run as one unit.
-- Only the API service role may call this function.
create or replace function public.finalize_copilot_chat_turn(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_user_message_id uuid,
  p_run_id uuid,
  p_answer text,
  p_metadata jsonb,
  p_output jsonb,
  p_schema_version text,
  p_completion jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_actor_id uuid;
  v_user_turn_id text;
  v_status text;
  v_assistant_id uuid;
  v_output_id uuid;
  v_proposals jsonb;
begin
  select conversation.user_id, message.metadata ->> 'client_turn_id'
    into v_actor_id, v_user_turn_id
    from public.ai_messages as message
    join public.ai_conversations as conversation
      on conversation.id = message.conversation_id
   where message.id = p_user_message_id
     and message.organization_id = p_organization_id
     and message.conversation_id = p_conversation_id
     and message.role = 'user'
     and conversation.organization_id = p_organization_id
   for update of message;
  if not found then
    raise exception 'copilot_user_message_not_found';
  end if;

  select run.status into v_status
    from public.agent_runs as run
   where run.id = p_run_id
     and run.organization_id = p_organization_id
     and run.actor_user_id = v_actor_id
     and run.trigger_type = 'chat'
   for update;
  if not found or v_status not in ('running', 'succeeded') then
    raise exception 'copilot_run_not_available';
  end if;

  if v_status = 'succeeded' then
    select id into v_assistant_id
      from public.ai_messages
     where run_id = p_run_id
       and organization_id = p_organization_id
       and conversation_id = p_conversation_id
       and role = 'assistant'
     limit 1;
    select id into v_output_id
      from public.agent_outputs
     where run_id = p_run_id and organization_id = p_organization_id;
    if v_assistant_id is null then
      raise exception 'copilot_run_missing_answer';
    end if;
    return jsonb_build_object('message_id', v_assistant_id, 'output_id', v_output_id, 'existing', true);
  end if;

  v_proposals := p_output -> 'proposed_writes';
  if jsonb_typeof(v_proposals) <> 'array' then
    raise exception 'copilot_proposals_invalid';
  end if;
  if jsonb_array_length(v_proposals) > 0 then
    insert into public.agent_outputs (
      run_id, organization_id, schema_version, output, approval_required, status
    ) values (
      p_run_id, p_organization_id, p_schema_version, p_output, true, 'pending_approval'
    ) returning id into v_output_id;
  end if;

  insert into public.ai_messages (
    conversation_id, organization_id, role, content, run_id, metadata
  ) values (
    p_conversation_id, p_organization_id, 'assistant', p_answer, p_run_id,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('client_turn_id', v_user_turn_id)
  ) returning id into v_assistant_id;

  update public.agent_runs
     set status = 'succeeded',
         provider = p_completion ->> 'provider',
         model = p_completion ->> 'model',
         input_tokens = (p_completion ->> 'input_tokens')::bigint,
         output_tokens = (p_completion ->> 'output_tokens')::bigint,
         cache_read_tokens = (p_completion ->> 'cache_read_tokens')::bigint,
         cache_creation_tokens = (p_completion ->> 'cache_creation_tokens')::bigint,
         reasoning_tokens = (p_completion ->> 'reasoning_tokens')::bigint,
         estimated_cost_usd = (p_completion ->> 'estimated_cost_usd')::numeric,
         cost_basis = p_completion ->> 'cost_basis',
         pricing_version = p_completion ->> 'pricing_version',
         latency_ms = (p_completion ->> 'latency_ms')::integer,
         stop_reason = p_completion ->> 'stop_reason',
         model_calls = (p_completion ->> 'model_calls')::integer,
         tool_call_count = (p_completion ->> 'tool_call_count')::integer,
         system_prompt_hash = p_completion ->> 'system_prompt_hash',
         declared_tools = array(select jsonb_array_elements_text(coalesce(p_completion -> 'declared_tools', '[]'::jsonb))),
         context_truncated = (p_completion ->> 'context_truncated')::boolean,
         finished_at = now()
   where id = p_run_id and organization_id = p_organization_id;

  return jsonb_build_object('message_id', v_assistant_id, 'output_id', v_output_id, 'existing', false);
end;
$$;

revoke all on function public.finalize_copilot_chat_turn(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_copilot_chat_turn(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, jsonb)
  to service_role;

comment on function public.finalize_copilot_chat_turn(uuid, uuid, uuid, uuid, text, jsonb, jsonb, text, jsonb)
  is 'A09: atomically publish one chat answer and its pending proposals after a completed model turn.';
