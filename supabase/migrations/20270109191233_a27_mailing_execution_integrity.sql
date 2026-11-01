-- A27: immutable approval, recoverable bootstrap and fenced graph writes.
-- Created with migration new; ordered after the existing January migrations.
-- The foundation migration defines this flag, but it is missing in the remote
-- schemas; the runtime filters Klaviyo accounts by it.
alter table public.klaviyo_accounts
  add column if not exists is_active boolean not null default true;

alter table public.marketing_mailing_sequences
  add column if not exists revision uuid not null default gen_random_uuid(),
  add column if not exists generation_token uuid,
  add column if not exists request_fingerprint text,
  add column if not exists agent_run_id uuid references public.agent_runs(id) on delete set null,
  add column if not exists agent_output_id uuid references public.agent_outputs(id) on delete set null,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists graph_lease_token uuid,
  add column if not exists graph_bootstrap jsonb,
  add column if not exists cancelled_at timestamptz,
  add column if not exists production_finished_at timestamptz;
alter table public.marketing_mailing_sequences add column if not exists context_snapshot jsonb;

-- The API authorizes the exact store on every read. Organization-only RLS on
-- the projection must not provide an alternative, broader authenticated read.
drop policy if exists "marketing_mailing_campaign_emails_select_authorized" on public.marketing_mailing_campaign_emails;
revoke all on public.marketing_mailing_campaign_emails from public, anon, authenticated;

alter table public.marketing_mailing_sequences drop constraint if exists marketing_mailing_sequences_status_check;
alter table public.marketing_mailing_sequences add constraint marketing_mailing_sequences_status_check
  check (status in ('generating', 'failed', 'planned', 'in_progress', 'completed', 'partial', 'abandoned'));

create unique index if not exists mailing_sequence_live_request_idx
  on public.marketing_mailing_sequences(organization_id, store_id, request_fingerprint)
  where request_fingerprint is not null and status in ('generating', 'planned', 'in_progress');
create index if not exists mailing_sequence_resume_idx
  on public.marketing_mailing_sequences(updated_at, id) where orchestrator = 'graph' and status = 'in_progress';

create table if not exists public.marketing_mailing_delivery_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sequence_id uuid not null references public.marketing_mailing_sequences(id) on delete cascade,
  store_id uuid references public.shopify_stores(id) on delete set null,
  revision uuid not null, sequence_number smallint not null check(sequence_number between 1 and 7),
  draft_id uuid references public.marketing_content_drafts(id) on delete set null,
  draft_version integer not null,
  provider_campaign_id uuid references public.klaviyo_campaigns(id) on delete set null,
  provider_message_id uuid references public.klaviyo_campaign_messages(id) on delete set null,
  provider_account_id uuid references public.klaviyo_accounts(id) on delete set null,
  provider_account_external_id text not null, provider_campaign_external_id text not null,
  provider_message_external_id text not null,
  provider_send_time timestamptz not null, provider_source_updated_at timestamptz not null,
  draft_export_hash text,
  content_match_status text not null default 'unverified' check(content_match_status = 'unverified'),
  linked_by uuid references public.profiles(id) on delete set null,
  linked_at timestamptz not null default now(),
  unique(sequence_id, revision, sequence_number, draft_id, draft_version),
  unique(organization_id, provider_account_external_id, provider_message_external_id)
);
create index if not exists mailing_delivery_receipts_scope_idx on public.marketing_mailing_delivery_receipts
  (organization_id, store_id, provider_send_time desc, id);
alter table public.marketing_mailing_delivery_receipts enable row level security;
revoke all on public.marketing_mailing_delivery_receipts from public, anon, authenticated;
grant select, insert on public.marketing_mailing_delivery_receipts to service_role;

create or replace function public.link_mailing_delivery(
  p_organization_id uuid, p_sequence_id uuid, p_revision uuid, p_number integer,
  p_draft_id uuid, p_draft_version integer, p_message_id uuid, p_actor uuid
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.marketing_mailing_sequences; d public.marketing_content_drafts;
  m public.klaviyo_campaign_messages; c public.klaviyo_campaigns; a public.klaviyo_accounts;
  receipt public.marketing_mailing_delivery_receipts;
begin
  select * into s from public.marketing_mailing_sequences where id = p_sequence_id and organization_id = p_organization_id for update;
  if not found or s.revision is distinct from p_revision or s.approved_at is null then raise exception 'mailing_delivery_revision_conflict'; end if;
  select * into d from public.marketing_content_drafts where id = p_draft_id and organization_id = p_organization_id for update;
  if not found or d.version is distinct from p_draft_version or d.status::text not in ('approved','published')
    or d.request->'mailing_sequence'->>'sequence_id' is distinct from s.id::text
    or d.request->'mailing_sequence'->>'revision' is distinct from s.revision::text
    or d.request->'mailing_sequence'->>'email_number' is distinct from p_number::text then raise exception 'mailing_delivery_draft_conflict'; end if;
  select * into m from public.klaviyo_campaign_messages where id = p_message_id and organization_id = p_organization_id for share;
  if not found or m.channel <> 'email' then raise exception 'mailing_delivery_message_invalid'; end if;
  select * into c from public.klaviyo_campaigns where id = m.campaign_id and organization_id = p_organization_id for share;
  if not found or lower(coalesce(c.status,'')) <> 'sent' or coalesce(m.sent_at,c.send_time) is null
    or coalesce(m.sent_at,c.send_time) > clock_timestamp()
    or coalesce(m.sent_at,c.send_time) < s.approved_at then raise exception 'mailing_delivery_not_sent'; end if;
  select * into a from public.klaviyo_accounts where id = c.account_id and organization_id = p_organization_id
    and store_id = s.store_id and is_active for share;
  if not found or not exists(select 1 from public.integration_connections where id = a.connection_id
    and organization_id = p_organization_id and status::text in ('connected','syncing')) then raise exception 'mailing_delivery_scope_invalid'; end if;
  insert into public.marketing_mailing_delivery_receipts(organization_id, sequence_id, store_id, revision, sequence_number,
    draft_id, draft_version, provider_campaign_id, provider_message_id, provider_account_id, provider_account_external_id,
    provider_campaign_external_id, provider_message_external_id, provider_send_time, provider_source_updated_at,
    draft_export_hash, linked_by)
    values(s.organization_id, s.id, s.store_id, s.revision, p_number, d.id, d.version, c.id, m.id, a.id,
      a.external_account_id, c.external_campaign_id, m.external_message_id, coalesce(m.sent_at,c.send_time), m.updated_at,
      d.request->>'klaviyo_export_hash', p_actor)
    on conflict(sequence_id,revision,sequence_number,draft_id,draft_version) do nothing returning * into receipt;
  if not found then
    select * into receipt from public.marketing_mailing_delivery_receipts where sequence_id = s.id and revision = s.revision
      and sequence_number = p_number and draft_id = d.id and draft_version = d.version;
    if receipt.provider_message_id is distinct from m.id then raise exception 'mailing_delivery_link_conflict'; end if;
  end if;
  return to_jsonb(receipt);
end $$;
revoke all on function public.link_mailing_delivery(uuid,uuid,uuid,integer,uuid,integer,uuid,uuid) from public, anon, authenticated;
grant execute on function public.link_mailing_delivery(uuid,uuid,uuid,integer,uuid,integer,uuid,uuid) to service_role;

create or replace function public.approve_mailing_sequence(
  p_organization_id uuid, p_sequence_id uuid, p_revision uuid, p_actor_id uuid,
  p_orchestrator text, p_bootstrap jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.marketing_mailing_sequences; output_status text;
begin
  select * into s from public.marketing_mailing_sequences
    where id = p_sequence_id and organization_id = p_organization_id for update;
  if not found or s.revision is distinct from p_revision then raise exception 'mailing_revision_conflict'; end if;
  if s.status = 'in_progress' and s.orchestrator = p_orchestrator and s.approved_at is not null then
    return jsonb_build_object('id', s.id, 'status', s.status);
  end if;
  if s.status <> 'planned' or p_orchestrator not in ('browser', 'graph') then raise exception 'mailing_transition_conflict'; end if;
  if coalesce(s.plan->>'decision', 'ready') <> 'ready' then raise exception 'mailing_plan_not_ready'; end if;
  if jsonb_array_length(coalesce(s.request->'scheduled_for', '[]'::jsonb)) <> jsonb_array_length(s.plan->'emails')
    or exists(select 1 from jsonb_array_elements_text(s.request->'scheduled_for') d(value)
      where d.value::timestamptz <= clock_timestamp()) then raise exception 'mailing_schedule_invalid'; end if;
  if p_orchestrator = 'graph' and (p_bootstrap is null or p_bootstrap->>'sequence_id' <> s.id::text
    or p_bootstrap->>'organization_id' <> s.organization_id::text
    or p_bootstrap->>'store_id' is distinct from s.store_id::text) then raise exception 'mailing_bootstrap_invalid'; end if;
  if s.agent_output_id is not null then
    select status::text into output_status from public.agent_outputs
      where id = s.agent_output_id and organization_id = s.organization_id and run_id = s.agent_run_id
        and output = s.plan for update;
    if not found or output_status not in ('pending_approval', 'approved', 'published') then raise exception 'mailing_output_conflict'; end if;
    if output_status = 'pending_approval' then
      update public.agent_outputs set status = 'approved' where id = s.agent_output_id;
      insert into public.agent_approvals(output_id, organization_id, decision, decided_by, reason)
        values (s.agent_output_id, s.organization_id, 'approved', p_actor_id, 'Estrategia A27: revisión ' || s.revision::text);
    end if;
  end if;
  update public.marketing_mailing_sequences set status = 'in_progress', orchestrator = p_orchestrator,
    approved_by = p_actor_id, approved_at = clock_timestamp(), graph_bootstrap = p_bootstrap,
    graph_requires_consultant_review = false
    where id = s.id;
  return jsonb_build_object('id', s.id, 'status', 'in_progress');
end $$;
revoke all on function public.approve_mailing_sequence(uuid,uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.approve_mailing_sequence(uuid,uuid,uuid,uuid,text,jsonb) to service_role;

create or replace function public.set_mailing_draft_schedule(p_organization_id uuid, p_draft_id uuid, p_scheduled_for timestamptz, p_token uuid)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.marketing_mailing_sequences; d public.marketing_content_drafts; email_number integer;
begin
  select * into d from public.marketing_content_drafts where id = p_draft_id and organization_id = p_organization_id;
  if not found or d.request->'mailing_sequence'->>'sequence_id' is null then return false; end if;
  select * into s from public.marketing_mailing_sequences where organization_id = p_organization_id
    and id = (d.request->'mailing_sequence'->>'sequence_id')::uuid for update;
  email_number := (d.request->'mailing_sequence'->>'email_number')::integer;
  if not found or s.status <> 'in_progress' or s.cancelled_at is not null or s.approved_at is null
    or d.request->'mailing_sequence'->>'revision' is distinct from s.revision::text
    or d.request->>'store_id' is distinct from s.request->>'store_connection_id'
    or (s.orchestrator = 'graph' and (p_token is null or s.graph_lease_token is distinct from p_token
      or s.graph_lease_until is null or s.graph_lease_until <= clock_timestamp()))
    or email_number is null or email_number < 1 or email_number > jsonb_array_length(s.plan->'emails')
    or p_scheduled_for is null or p_scheduled_for <= clock_timestamp()
    or p_scheduled_for is distinct from (s.request->'scheduled_for'->>(email_number - 1))::timestamptz then return false; end if;
  update public.marketing_content_drafts set scheduled_for = p_scheduled_for
    where id = d.id and request = d.request and version = d.version and status::text in ('pending_approval','approved','published');
  return found;
end $$;
revoke all on function public.set_mailing_draft_schedule(uuid,uuid,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.set_mailing_draft_schedule(uuid,uuid,timestamptz,uuid) to service_role;

-- Lock the sequence only for the database operation, never during a model call.
create or replace function public.finalize_a27_mailing_generation(
  p_sequence_id uuid, p_revision uuid, p_token uuid,
  p_run_id uuid, p_organization_id uuid, p_actor_user_id uuid, p_schema_version text,
  p_output jsonb, p_draft jsonb, p_run_completion jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare s public.marketing_mailing_sequences; packet jsonb; email_number integer;
begin
  select * into s from public.marketing_mailing_sequences where id = p_sequence_id and organization_id = p_organization_id for update;
  if not found or s.status <> 'in_progress' or s.cancelled_at is not null or s.approved_at is null
    or s.revision is distinct from p_revision
    or (s.orchestrator = 'graph' and (p_token is null or s.graph_lease_token is distinct from p_token
      or s.graph_lease_until is null or s.graph_lease_until <= clock_timestamp())) then raise exception 'mailing_generation_lease_lost_or_cancelled'; end if;
  packet := p_draft->'request'->'mailing_sequence';
  email_number := (packet->>'email_number')::integer;
  if packet->>'sequence_id' is distinct from s.id::text or packet->>'revision' is distinct from s.revision::text
    or p_draft->'request'->>'store_id' is distinct from s.request->>'store_connection_id'
    or email_number is null or email_number < 1 or email_number > jsonb_array_length(s.plan->'emails')
    or (packet->>'scheduled_for')::timestamptz is distinct from (s.request->'scheduled_for'->>(email_number - 1))::timestamptz
    or (s.request->'scheduled_for'->>(email_number - 1))::timestamptz <= clock_timestamp()
    or coalesce(p_draft->>'idempotency_key','') !~ ('^' || s.id::text || ':' || email_number::text || '(:r[1-4])?$')
    then raise exception 'mailing_production_packet_invalid'; end if;
  return public.finalize_a11_marketing_generation(p_run_id, p_organization_id, p_actor_user_id, p_schema_version, p_output, p_draft, p_run_completion);
end $$;
revoke all on function public.finalize_a27_mailing_generation(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.finalize_a27_mailing_generation(uuid,uuid,uuid,uuid,uuid,uuid,text,jsonb,jsonb,jsonb) to service_role;

create or replace function public.mutate_mailing_graph(
  p_sequence_id uuid, p_token uuid, p_operation text, p_payload jsonb default '{}'::jsonb
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare s public.marketing_mailing_sequences; e public.marketing_mailing_campaign_emails;
  c public.mailing_campaign_checkpoints; w public.mailing_campaign_checkpoint_writes;
  item jsonb; latest text; next_status text; rejected_output uuid;
begin
  select * into s from public.marketing_mailing_sequences where id = p_sequence_id for update;
  if not found or s.orchestrator <> 'graph' or p_token is null then return false; end if;
  if p_operation = 'claim' then
    if s.status <> 'in_progress' or (s.graph_lease_until is not null and s.graph_lease_until > clock_timestamp()) then return false; end if;
    update public.marketing_mailing_sequences set graph_lease_token = p_token,
      graph_lease_until = clock_timestamp() + interval '15 minutes' where id = s.id;
    return true;
  end if;
  if s.graph_lease_token is distinct from p_token or p_token is null then return false; end if;
  if p_operation = 'release' then
    update public.marketing_mailing_sequences set graph_lease_token = null, graph_lease_until = null where id = s.id;
    return true;
  end if;
  if s.graph_lease_until is null or s.graph_lease_until <= clock_timestamp() or s.cancelled_at is not null
    or (s.status <> 'in_progress' and s.production_finished_at is null) then return false; end if;
  if p_operation = 'renew' then
    update public.marketing_mailing_sequences set graph_lease_until = clock_timestamp() + interval '15 minutes' where id = s.id;
  elsif p_operation = 'assert' then
    return true;
  elsif p_operation = 'project' then
    if s.status <> 'in_progress' then return false; end if;
    e := jsonb_populate_record(null::public.marketing_mailing_campaign_emails, p_payload);
    if not exists(select 1 from jsonb_array_elements(s.plan->'emails') planned
      where (planned->>'sequence_number')::integer = e.sequence_number)
      or e.scheduled_for is distinct from (s.request->'scheduled_for'->>(e.sequence_number - 1))::timestamptz
      then raise exception 'mailing_email_out_of_plan'; end if;
    insert into public.marketing_mailing_campaign_emails(sequence_id, sequence_number, organization_id, store_id,
      title, scheduled_for, status, attempt, draft_id, auto_review_passed, rejections, last_error,
      decided_by, decided_role, decided_membership_role)
      values(s.id, e.sequence_number, s.organization_id, s.store_id, e.title, e.scheduled_for, e.status,
        e.attempt, e.draft_id, e.auto_review_passed, coalesce(e.rejections,'[]'::jsonb), e.last_error,
        e.decided_by, e.decided_role, e.decided_membership_role)
    on conflict(sequence_id,sequence_number) do update set title = excluded.title, scheduled_for = excluded.scheduled_for,
      status = excluded.status, attempt = excluded.attempt, draft_id = excluded.draft_id, auto_review_passed = excluded.auto_review_passed,
      rejections = excluded.rejections, last_error = excluded.last_error, decided_by = excluded.decided_by,
      decided_role = excluded.decided_role, decided_membership_role = excluded.decided_membership_role,
      consultant_review_decision = case when excluded.attempt <> marketing_mailing_campaign_emails.attempt
        or excluded.draft_id is distinct from marketing_mailing_campaign_emails.draft_id then null else marketing_mailing_campaign_emails.consultant_review_decision end,
      consultant_review_reason = case when excluded.attempt <> marketing_mailing_campaign_emails.attempt
        or excluded.draft_id is distinct from marketing_mailing_campaign_emails.draft_id then null else marketing_mailing_campaign_emails.consultant_review_reason end,
      consultant_reviewed_by = case when excluded.attempt <> marketing_mailing_campaign_emails.attempt
        or excluded.draft_id is distinct from marketing_mailing_campaign_emails.draft_id then null else marketing_mailing_campaign_emails.consultant_reviewed_by end,
      consultant_reviewed_at = case when excluded.attempt <> marketing_mailing_campaign_emails.attempt
        or excluded.draft_id is distinct from marketing_mailing_campaign_emails.draft_id then null else marketing_mailing_campaign_emails.consultant_reviewed_at end,
      failure_decision = case when excluded.status = 'failed' then marketing_mailing_campaign_emails.failure_decision else null end,
      failure_decided_by = case when excluded.status = 'failed' then marketing_mailing_campaign_emails.failure_decided_by else null end,
      failure_decided_at = case when excluded.status = 'failed' then marketing_mailing_campaign_emails.failure_decided_at else null end;
  elsif p_operation = 'reject_draft' then
    update public.marketing_content_drafts set status = 'rejected', decided_at = (p_payload->>'at')::timestamptz,
      decision_reason = p_payload->>'reason'
      where id = (p_payload->>'draft_id')::uuid and organization_id = s.organization_id and status::text = 'pending_approval'
        and request->'mailing_sequence'->>'sequence_id' = s.id::text
      returning agent_output_id into rejected_output;
    if rejected_output is not null then
      update public.agent_outputs set status = 'rejected' where id = rejected_output
        and organization_id = s.organization_id and status::text = 'pending_approval';
    end if;
  elsif p_operation = 'checkpoint' then
    c := jsonb_populate_record(null::public.mailing_campaign_checkpoints, p_payload);
    insert into public.mailing_campaign_checkpoints(thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id,
      organization_id, store_id, sequence_id, checkpoint_type, checkpoint, metadata_type, metadata)
      values(s.id::text, c.checkpoint_ns, c.checkpoint_id, c.parent_checkpoint_id, s.organization_id, s.store_id, s.id,
        c.checkpoint_type, c.checkpoint, c.metadata_type, c.metadata)
    on conflict(thread_id,checkpoint_ns,checkpoint_id) do update set
      checkpoint = excluded.checkpoint, metadata = excluded.metadata, checkpoint_type = excluded.checkpoint_type,
      metadata_type = excluded.metadata_type, parent_checkpoint_id = excluded.parent_checkpoint_id;
  elsif p_operation = 'writes' then
    for item in select value from jsonb_array_elements(p_payload->'rows') loop
      w := jsonb_populate_record(null::public.mailing_campaign_checkpoint_writes, item);
      insert into public.mailing_campaign_checkpoint_writes(thread_id, checkpoint_ns, checkpoint_id, task_id, idx,
        channel, value_type, value, organization_id, store_id, sequence_id)
        values(s.id::text, w.checkpoint_ns, w.checkpoint_id, w.task_id, w.idx, w.channel, w.value_type, w.value,
          s.organization_id, s.store_id, s.id)
      on conflict(thread_id,checkpoint_ns,checkpoint_id,task_id,idx) do update set
        channel = excluded.channel, value_type = excluded.value_type, value = excluded.value
      where coalesce((p_payload->>'overwrite')::boolean, false);
    end loop;
  elsif p_operation = 'prune' then
    select checkpoint_id into latest from public.mailing_campaign_checkpoints
      where sequence_id = s.id and checkpoint_ns = '' order by checkpoint_id desc limit 1;
    if latest is not null then
      delete from public.mailing_campaign_checkpoint_writes where sequence_id = s.id and checkpoint_id <> latest;
      delete from public.mailing_campaign_checkpoints where sequence_id = s.id and checkpoint_id <> latest;
    end if;
  elsif p_operation = 'close' then
    if s.status <> 'in_progress' then return s.production_finished_at is not null; end if;
    if (select count(*) from public.marketing_mailing_campaign_emails where sequence_id = s.id)
      <> jsonb_array_length(s.plan->'emails') or exists(select 1 from public.marketing_mailing_campaign_emails
        where sequence_id = s.id and status not in ('scheduled', 'rejected')) then raise exception 'mailing_results_incomplete'; end if;
    select case when bool_and(status = 'scheduled') then 'completed'
      when bool_or(status = 'scheduled') then 'partial' else 'abandoned' end into next_status
      from public.marketing_mailing_campaign_emails where sequence_id = s.id;
    update public.marketing_mailing_sequences set status = next_status,
      production_finished_at = clock_timestamp() where id = s.id;
  else raise exception 'mailing_operation_invalid';
  end if;
  return true;
end $$;
revoke all on function public.mutate_mailing_graph(uuid,uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.mutate_mailing_graph(uuid,uuid,text,jsonb) to service_role;

-- Enrich the final A12 contract without changing its public return signature.
create or replace function public.a27_mailing_report(
  target_organization_id uuid, period_start date, period_end date, target_store_id uuid
) returns setof jsonb language sql stable security invoker set search_path = '' as $$
  select to_jsonb(r) || jsonb_build_object(
    'account_id', a.id, 'currency_code', currency.code,
    'account_status', case when a.id is null then 'unresolved' when a.is_active and ic.status::text in ('connected','syncing')
      then 'active' else 'inactive' end,
    'period_start', currency.observed_start, 'period_end', currency.observed_end,
    'revenue', case when currency.code is not null and a.id is not null then r.revenue else null end
  )
  from public.klaviyo_email_report(target_organization_id, period_start, period_end, target_store_id) r
  left join public.klaviyo_campaigns c on r.entity_type = 'campaign' and c.id = r.entity_id and c.organization_id = target_organization_id
  left join public.klaviyo_flows f on r.entity_type = 'flow' and f.id = r.entity_id and f.organization_id = target_organization_id
  left join public.klaviyo_accounts a on a.id = coalesce(c.account_id, f.account_id)
    and a.organization_id = target_organization_id and a.store_id = target_store_id
  left join public.integration_connections ic on ic.id = a.connection_id and ic.organization_id = target_organization_id
  left join lateral (
    select case when count(*) filter(where rv.revenue is not null or rv.raw_data->'statistics'->>'conversion_value' is not null) > 0
      and count(distinct rv.currency_code) filter(where rv.revenue is not null or rv.raw_data->'statistics'->>'conversion_value' is not null) = 1
      and count(*) filter(where (rv.revenue is not null or rv.raw_data->'statistics'->>'conversion_value' is not null)
        and rv.currency_code is null) = 0 then max(rv.currency_code) else null end as code,
      min(rv.period_start)::date as observed_start, max(rv.period_end)::date as observed_end
    from public.klaviyo_report_values rv join public.klaviyo_report_runs rr on rr.id = rv.report_run_id
    where rv.organization_id = target_organization_id and rr.organization_id = target_organization_id
      and rr.account_id = a.id and rv.entity_type::text = r.entity_type and rv.variation_id = ''
      and rv.external_entity_id = coalesce(c.external_campaign_id, f.external_flow_id)
      and rv.period_start >= a27_mailing_report.period_start and rv.period_end <= a27_mailing_report.period_end
      and date_trunc('month', rv.period_start)::date = r.bucket_month
  ) currency on true
  order by r.bucket_month, r.entity_type, r.entity_id;
$$;
revoke all on function public.a27_mailing_report(uuid,date,date,uuid) from public, anon, authenticated;
grant execute on function public.a27_mailing_report(uuid,date,date,uuid) to service_role;
create index if not exists a27_report_values_entity_interval_idx on public.klaviyo_report_values
  (organization_id, entity_type, external_entity_id, period_start, period_end, report_run_id) where variation_id = '';

create or replace function public.reserve_a27_manual_refresh(
  p_run_id uuid, p_organization_id uuid, p_agent_code text, p_daily_limit integer, p_request_key text, p_store_id uuid
) returns text language plpgsql security invoker set search_path = '' as $$
declare used integer;
begin
  if p_agent_code is distinct from 'a27_planificador_mailing' or p_store_id is null then raise exception 'invalid_a27_quota_scope'; end if;
  perform pg_advisory_xact_lock(hashtextextended(concat_ws(':',p_organization_id,p_agent_code,p_store_id),0));
  if exists(select 1 from public.agent_manual_refresh_reservations where organization_id = p_organization_id
    and agent_code = p_agent_code and store_id = p_store_id and request_key = p_request_key) then return 'duplicate'; end if;
  select count(*) into used from public.agent_manual_refresh_reservations where organization_id = p_organization_id
    and agent_code = p_agent_code and store_id = p_store_id and reserved_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  used := used + (select count(*) from public.agent_runs r join public.agent_versions v on v.id = r.agent_version_id
    join public.agent_definitions d on d.id = v.definition_id where r.organization_id = p_organization_id
    and r.store_id = p_store_id and r.trigger_type = 'manual' and d.code = p_agent_code
    and r.started_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc'
    and not exists(select 1 from public.agent_manual_refresh_reservations q where q.run_id = r.id));
  if used >= greatest(p_daily_limit,0) then return 'limit'; end if;
  insert into public.agent_manual_refresh_reservations(run_id,organization_id,agent_code,request_key,store_id)
    values(p_run_id,p_organization_id,p_agent_code,p_request_key,p_store_id) on conflict do nothing;
  return case when found then 'reserved' else 'duplicate' end;
end $$;
revoke all on function public.reserve_a27_manual_refresh(uuid,uuid,text,integer,text,uuid) from public, anon, authenticated;
grant execute on function public.reserve_a27_manual_refresh(uuid,uuid,text,integer,text,uuid) to service_role;
