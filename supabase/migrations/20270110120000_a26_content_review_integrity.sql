-- Dedicated A26 inventory: eligibility is enforced before any content is returned.
create or replace function public.a26_email_inventory_page(
  p_organization_id uuid,p_store_id uuid,p_after uuid default null,p_limit integer default 100
) returns jsonb language plpgsql stable security invoker set search_path='' as $function$
declare result jsonb;
begin
  if p_store_id is null then raise exception 'A26_STORE_REQUIRED'; end if;
  with accounts as (
    select k.* from public.klaviyo_accounts k join public.integration_connections c on c.id=k.connection_id
    join public.shopify_stores s on s.id=k.store_id and s.organization_id=k.organization_id and s.is_active
    where k.organization_id=p_organization_id and k.store_id=p_store_id
      and c.organization_id=p_organization_id and c.provider='klaviyo'
      and c.status in ('connected','syncing') and c.deletion_requested_at is null
  ), messages as (
    select 'flow' as source, f.id as parent_id,f.name::text as parent_name,f.status::text as parent_status,
      f.account_id,f.trigger_type::text as trigger_type,null::timestamptz as send_time,
      m.id as message_id,m.external_message_id::text,m.subject::text,m.preview_text,
      m.external_template_id::text,m.channel::text,m.status::text as message_status,
      m.raw_data,m.last_synced_at,a.external_action_id::text as action_id,
      a.status::text as action_status,a.position::bigint as position_in_parent
    from public.klaviyo_flow_messages m join public.klaviyo_flows f on f.id=m.flow_id
    join accounts k on k.id=f.account_id left join public.klaviyo_flow_actions a on a.id=m.action_id
    where m.organization_id=p_organization_id and f.organization_id=p_organization_id
    union all
    select 'campaign',c.id,c.name::text,c.status::text,c.account_id,null::text,
      coalesce(m.sent_at,c.send_time),m.id,m.external_message_id::text,m.subject::text,m.preview_text,
      m.external_template_id::text,m.channel::text,m.status::text,m.raw_data,m.last_synced_at,null::text,null::text,null::bigint
    from public.klaviyo_campaign_messages m join public.klaviyo_campaigns c on c.id=m.campaign_id
    join accounts k on k.id=c.account_id
    where m.organization_id=p_organization_id and c.organization_id=p_organization_id
  ), enriched as (
    select m.message_id,to_jsonb(m)-'raw_data' || jsonb_build_object(
      'template_name',t.name,'body_chars',length(t.html_content),
      'template_observed_at',t.last_synced_at,
      'adds_utm',case lower(m.raw_data->>'add_tracking_params') when 'true' then true when 'false' then false else null end,
      'sequence_order_verified',false,
      'source_revision',md5((to_jsonb(m)||jsonb_build_object('html',t.html_content,'text',t.text_content,'template_updated',t.updated_at))::text)
    ) as row_data
    from messages m left join public.klaviyo_templates t on t.account_id=m.account_id
      and t.external_template_id=m.external_template_id and t.organization_id=p_organization_id
  ), page as (
    select * from enriched where p_after is null or message_id>p_after
    order by message_id limit least(greatest(coalesce(p_limit,100),1),100)
  )
  select jsonb_build_object('rows',coalesce((select jsonb_agg(row_data order by message_id) from page),'[]'::jsonb),
    'total_count',(select count(*) from enriched),
    'next_cursor',case when exists(select 1 from enriched where message_id>(select max(message_id::text)::uuid from page))
      then (select max(message_id::text) from page) else null end)
  into result;
  return result;
end;
$function$;
revoke all on function public.a26_email_inventory_page(uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.a26_email_inventory_page(uuid,uuid,uuid,integer) to service_role;

create table if not exists public.a26_content_reviews (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.shopify_stores(id) on delete cascade,
  account_id uuid not null references public.klaviyo_accounts(id) on delete cascade,
  message_id uuid not null,content_hash text not null check(content_hash ~ '^[a-f0-9]{64}$'),
  source_revision text not null,output_id uuid not null references public.agent_outputs(id) on delete cascade,
  review_ref text not null,review jsonb not null,evidence jsonb not null,
  status text not null default 'open' check(status in ('open','superseded','verified','inconclusive')),
  delivery_status text not null default 'proposed' check(delivery_status in ('proposed','materialized','draft_created','verified')),
  task_id uuid references public.tasks(id) on delete set null,
  draft_id uuid,closure_evidence jsonb,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
  unique(output_id,review_ref)
);
create index if not exists a26_content_reviews_message_idx on public.a26_content_reviews(organization_id,store_id,message_id,created_at desc);
alter table public.a26_content_reviews enable row level security;
revoke all on public.a26_content_reviews from public,anon,authenticated;
grant select,insert,update,delete on public.a26_content_reviews to service_role;

create or replace function public.materialize_a26_content_task(
  p_task jsonb,p_organization_id uuid,p_store_id uuid,p_output_id uuid,p_proposal_index integer,
  p_plan_id uuid,p_plan_version integer,p_milestone_id uuid,p_review_ref text
) returns jsonb language plpgsql security invoker set search_path='' as $function$
declare v_review public.a26_content_reviews; v_task_id uuid; v_created boolean; v_cursor uuid; v_page jsonb; v_current jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text||p_store_id::text||'a26',0));
  if not exists(select 1 from public.agent_outputs o join public.agent_runs r on r.id=o.run_id
    join public.agent_versions av on av.id=r.agent_version_id join public.agent_definitions d on d.id=av.definition_id
    where o.id=p_output_id and o.organization_id=p_organization_id and o.status='pending_approval'
      and r.store_id=p_store_id and r.organization_id=p_organization_id and d.code='a26_contenido_email') then
    return jsonb_build_object('status','output_not_pending_or_out_of_scope'); end if;
  select * into v_review from public.a26_content_reviews where output_id=p_output_id and review_ref=p_review_ref
    and organization_id=p_organization_id and store_id=p_store_id for update;
  if v_review.id is null then return jsonb_build_object('status','review_missing'); end if;
  -- Revalidate the source revision at approval, including templates and message state.
  for i in 1..50 loop
    v_page:=public.a26_email_inventory_page(p_organization_id,p_store_id,v_cursor,100);
    select x into v_current from jsonb_array_elements(v_page->'rows') x where x->>'message_id'=v_review.message_id::text;
    exit when v_current is not null or v_page->>'next_cursor' is null;
    v_cursor:=(v_page->>'next_cursor')::uuid;
  end loop;
  if v_current is null or v_current->>'source_revision' is distinct from v_review.source_revision then
    update public.a26_content_reviews set status='superseded',updated_at=now() where id=v_review.id;
    return jsonb_build_object('status','content_changed_since_analysis'); end if;
  if p_plan_id is not null then
    perform 1 from public.strategic_plans p where p.id=p_plan_id and p.organization_id=p_organization_id
      and p.store_id=p_store_id and p.version=p_plan_version and p.status='active' and p.approved_at is not null for share;
    if not found then return jsonb_build_object('status','camino_changed_since_analysis'); end if;
  elsif p_plan_version is not null or p_milestone_id is not null then
    return jsonb_build_object('status','invalid_camino_snapshot'); end if;
  if p_milestone_id is not null and not exists(select 1 from public.strategic_plan_milestones m
    join public.strategic_plan_phases ph on ph.id=m.phase_id join public.strategic_plans p on p.id=ph.plan_id
    where m.id=p_milestone_id and m.organization_id=p_organization_id and m.status in ('in_progress','pending')
      and ph.status in ('active','pending') and p.id=p_plan_id and p.store_id=p_store_id and p.version=p_plan_version) then
    return jsonb_build_object('status','milestone_out_of_scope'); end if;
  select task_id into v_task_id from public.a26_content_reviews
    where organization_id=p_organization_id and store_id=p_store_id and message_id=v_review.message_id
      and content_hash=v_review.content_hash and review->>'dimension'=v_review.review->>'dimension'
      and task_id is not null order by created_at desc limit 1;
  if v_task_id is not null then return jsonb_build_object('status','materialized','task_id',v_task_id,'created',false); end if;
  insert into public.tasks(agent_output_id,agent_proposal_index,organization_id,store_id,source,priority,title,description,created_by,assigned_to,metadata,categories)
  values(p_output_id,p_proposal_index,p_organization_id,p_store_id,'ai_consultant',coalesce(p_task->>'priority','medium')::public.task_priority,
    p_task->>'title',concat(p_task->>'description',E'\n\nCambio permitido: ',v_review.review->>'permitted_change',E'\nCierre: ',v_review.review->>'acceptance_criterion'),
    nullif(p_task->>'created_by','')::uuid,nullif(p_task->>'assigned_to','')::uuid,
    coalesce(p_task->'metadata','{}'::jsonb)||jsonb_build_object('a26_review_id',v_review.id,'content_hash',v_review.content_hash,'message_id',v_review.message_id),
    array['klaviyo']) on conflict(agent_output_id,agent_proposal_index) do nothing returning id into v_task_id;
  v_created:=v_task_id is not null;
  if v_task_id is null then select id into v_task_id from public.tasks where agent_output_id=p_output_id and agent_proposal_index=p_proposal_index
    and organization_id=p_organization_id and store_id=p_store_id; end if;
  if v_task_id is null then raise exception 'A26_TASK_RECOVERY_FAILED'; end if;
  if p_milestone_id is not null then insert into public.milestone_task_links(organization_id,milestone_id,task_id)
    values(p_organization_id,p_milestone_id,v_task_id) on conflict(milestone_id,task_id) do nothing; end if;
  update public.a26_content_reviews set task_id=v_task_id,delivery_status='materialized',updated_at=now() where id=v_review.id;
  return jsonb_build_object('status','materialized','task_id',v_task_id,'created',v_created);
end;
$function$;
revoke all on function public.materialize_a26_content_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.materialize_a26_content_task(jsonb,uuid,uuid,uuid,integer,uuid,integer,uuid,text) to service_role;

notify pgrst,'reload schema';
