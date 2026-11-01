-- ARCHIVO HISTORICO REMOTO: solo evidencia; no ejecutar ni incorporar automaticamente a migraciones.
-- Recuperado de supabase_migrations.schema_migrations el 2026-11-01.
create or replace function public.finalize_a11_marketing_generation(
  p_run_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_schema_version text,
  p_output jsonb,
  p_draft jsonb,
  p_run_completion jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_output_id uuid := gen_random_uuid();
  v_draft_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_output public.agent_outputs%rowtype;
  v_draft public.marketing_content_drafts%rowtype;
begin
  insert into public.agent_outputs (id, run_id, organization_id, schema_version, output, approval_required, status, created_at)
  values (v_output_id, p_run_id, p_organization_id, p_schema_version, p_output, true, 'pending_approval', v_now)
  returning * into v_output;

  insert into public.marketing_content_drafts (
    id, organization_id, idempotency_key, idempotency_fingerprint, created_by, agent_run_id, agent_output_id,
    content_type, status, version, request, brand_colors, verbatim_texts, summary, template_name, subject, preheader,
    from_name, reply_to, purpose, audience, locale, tone, plain_text, html, blocks, personalization_tokens,
    compliance_notes, sources, confidence, warnings, created_at, updated_at
  ) values (
    v_draft_id, p_organization_id, nullif(p_draft->>'idempotency_key',''), nullif(p_draft->>'idempotency_fingerprint',''), p_actor_user_id,
    p_run_id, v_output_id, p_draft->>'content_type', 'pending_approval', 1, p_draft->'request',
    coalesce(p_draft->'brand_colors','{}'::jsonb), coalesce(p_draft->'verbatim_texts','[]'::jsonb), p_draft->>'summary',
    p_draft->>'template_name', p_draft->>'subject', p_draft->>'preheader', p_draft->>'from_name', nullif(p_draft->>'reply_to',''),
    p_draft->>'purpose', p_draft->>'audience', p_draft->>'locale', p_draft->>'tone', p_draft->>'plain_text', p_draft->>'html',
    coalesce(p_draft->'blocks','[]'::jsonb), coalesce(p_draft->'personalization_tokens','[]'::jsonb),
    coalesce(p_draft->'compliance_notes','[]'::jsonb), coalesce(p_draft->'sources','[]'::jsonb), p_draft->>'confidence',
    coalesce(p_draft->'warnings','[]'::jsonb), v_now, v_now
  ) returning * into v_draft;

  insert into public.marketing_content_draft_versions (draft_id, organization_id, version, change_type, edited_by, snapshot, created_at)
  values (v_draft_id, p_organization_id, 1, 'generated', p_actor_user_id, to_jsonb(v_draft), v_now);

  update public.agent_runs r set
    status = 'succeeded',
    provider = p_run_completion->>'provider',
    model = p_run_completion->>'model',
    input_tokens = nullif(p_run_completion->>'input_tokens','')::integer,
    output_tokens = nullif(p_run_completion->>'output_tokens','')::integer,
    cache_read_tokens = nullif(p_run_completion->>'cache_read_tokens','')::integer,
    cache_creation_tokens = nullif(p_run_completion->>'cache_creation_tokens','')::integer,
    reasoning_tokens = nullif(p_run_completion->>'reasoning_tokens','')::integer,
    estimated_cost_usd = nullif(p_run_completion->>'estimated_cost_usd','')::numeric,
    cost_basis = p_run_completion->>'cost_basis',
    pricing_version = p_run_completion->>'pricing_version',
    latency_ms = nullif(p_run_completion->>'latency_ms','')::integer,
    stop_reason = p_run_completion->>'stop_reason',
    model_calls = nullif(p_run_completion->>'model_calls','')::integer,
    tool_call_count = nullif(p_run_completion->>'tool_call_count','')::integer,
    system_prompt_hash = p_run_completion->>'system_prompt_hash',
    declared_tools = coalesce(p_run_completion->'declared_tools','[]'::jsonb),
    context_truncated = coalesce((p_run_completion->>'context_truncated')::boolean,false),
    finished_at = v_now
  where r.id = p_run_id and r.organization_id = p_organization_id and r.status = 'running';
  if not found then raise exception 'a11_run_not_running'; end if;

  return jsonb_build_object('output', to_jsonb(v_output), 'draft', to_jsonb(v_draft));
end;
$$;

revoke all on function public.finalize_a11_marketing_generation(uuid, uuid, uuid, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.finalize_a11_marketing_generation(uuid, uuid, uuid, text, jsonb, jsonb, jsonb) to service_role;


