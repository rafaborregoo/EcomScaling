-- Run against TEST ES IA as postgres. One statement, so an assertion failure
-- cannot be hidden by a later ROLLBACK result in a multi-statement client.
-- The expected exception rolls back only the fixture subtransaction.
do $test$
declare
  consultant uuid;
  viewer uuid;
  client_org uuid := gen_random_uuid();
  own_org uuid := gen_random_uuid();
  connection_a uuid := gen_random_uuid();
  connection_b uuid := gen_random_uuid();
  store_a uuid := gen_random_uuid();
  store_b uuid := gen_random_uuid();
  draft_plan uuid := gen_random_uuid();
  live_a uuid := gen_random_uuid();
  live_b uuid := gen_random_uuid();
  phase uuid := gen_random_uuid();
  milestone uuid := gen_random_uuid();
  review uuid := gen_random_uuid();
  other_review uuid := gen_random_uuid();
  n integer;
begin
  begin
  select id into consultant from public.profiles where is_active and private.is_consultant(id) limit 1;
  select id into viewer from public.profiles where is_active and platform_role <> 'platform_admin' and not private.is_consultant(id) limit 1;
  if consultant is null or viewer is null then raise exception 'TEST_FIXTURES_REQUIRE_CONSULTANT_AND_MEMBER'; end if;

  insert into public.organizations(id, display_name, slug, status, kind) values
    (client_org, 'Audit rollback client', 'audit-'||client_org, 'active', 'client'),
    (own_org, 'Audit rollback own store', 'audit-'||own_org, 'active', 'client');
  insert into public.organization_members(organization_id,user_id,role,is_active,access_scope) values
    (client_org,viewer,'readonly',true,'organization'), (own_org,consultant,'owner',true,'organization');
  insert into public.integration_connections(id,organization_id,provider,provider_account_id) values
    (connection_a,client_org,'shopify',store_a::text), (connection_b,client_org,'shopify',store_b::text);
  insert into public.shopify_stores(id,organization_id,connection_id,external_shop_id,myshopify_domain,shop_name,currency_code) values
    (store_a,client_org,connection_a,store_a::text,store_a||'.myshopify.com','Audit A','EUR'),
    (store_b,client_org,connection_b,store_b::text,store_b||'.myshopify.com','Audit B','EUR');
  insert into public.strategic_plans(id,organization_id,store_id,name,status,created_by) values
    (draft_plan,client_org,store_a,'Audit draft','draft',consultant),
    (live_a,client_org,store_a,'Audit live A','active',consultant),
    (live_b,client_org,store_b,'Audit live B','active',consultant);
  insert into public.strategic_plan_phases(id,organization_id,plan_id,name,position) values
    (phase,client_org,draft_plan,'Hidden phase',1);
  insert into public.strategic_plan_milestones(id,organization_id,phase_id,name,position) values
    (milestone,client_org,phase,'Hidden milestone',1);
  insert into public.consultant_client_review_events(id,organization_id,consultant_user_id) values
    (review,own_org,consultant), (other_review,own_org,viewer);
  insert into public.report_schedules(organization_id,template_id,store_id,recipients,is_active) values
    (client_org,'shopify_comercial',store_a,array['audit@example.invalid'],false),
    (client_org,'shopify_comercial',store_b,array['audit@example.invalid'],false);
  insert into public.report_schedules(organization_id,template_id,store_id,recipients,is_active)
    values(client_org,'shopify_comercial',store_a,array['updated@example.invalid'],false)
    on conflict(organization_id,template_id,store_id) do update set recipients=excluded.recipients;
  select count(*) into n from public.report_schedules where organization_id=client_org;
  if n<>2 then raise exception 'STORE_SCHEDULE_UNIQUENESS_REGRESSION'; end if;

  perform set_config('request.jwt.claim.sub',viewer::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated')::text,true);
  set local role authenticated;
  select count(*) into n from public.strategic_plans where id=draft_plan;
  if n<>0 then raise exception 'READONLY_DRAFT_LEAK'; end if;
  select count(*) into n from public.strategic_plan_phases where id=phase;
  if n<>0 then raise exception 'READONLY_PHASE_LEAK'; end if;
  select count(*) into n from public.strategic_plan_milestones where id=milestone;
  if n<>0 then raise exception 'READONLY_MILESTONE_LEAK'; end if;
  select count(*) into n from public.strategic_plans where id in(live_a,live_b);
  if n<>2 then raise exception 'READONLY_PUBLISHED_ACCESS_REGRESSION'; end if;
  reset role;

  update public.organization_members set role='member' where organization_id=client_org and user_id=viewer;
  set local role authenticated;
  select count(*) into n from public.strategic_plans where id=draft_plan;
  if n<>0 then raise exception 'MEMBER_DRAFT_LEAK'; end if;
  select count(*) into n from public.strategic_plan_phases where id=phase;
  if n<>0 then raise exception 'MEMBER_PHASE_LEAK'; end if;
  select count(*) into n from public.strategic_plan_milestones where id=milestone;
  if n<>0 then raise exception 'MEMBER_MILESTONE_LEAK'; end if;
  reset role;

  update public.organization_members set access_scope='store',store_ids=array[store_a] where organization_id=client_org and user_id=viewer;
  set local role authenticated;
  select count(*) into n from public.strategic_plans where id=live_a;
  if n<>1 then raise exception 'SELECTED_STORE_ACCESS_REGRESSION'; end if;
  select count(*) into n from public.strategic_plans where id=live_b;
  if n<>0 then raise exception 'OTHER_STORE_LEAK'; end if;
  select count(*) into n from public.strategic_plans where id=draft_plan;
  if n<>0 then raise exception 'STORE_MEMBER_DRAFT_LEAK'; end if;
  reset role;

  insert into public.consultant_assignments(organization_id,consultant_user_id,is_active) values(client_org,consultant,true);
  perform set_config('request.jwt.claim.sub',consultant::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',consultant,'role','authenticated')::text,true);
  set local role authenticated;
  select count(*) into n from public.strategic_plans where id=draft_plan;
  if n<>1 then raise exception 'ASSIGNED_CONSULTANT_DRAFT_ACCESS_REGRESSION'; end if;
  select count(*) into n from public.strategic_plan_milestones where id=milestone;
  if n<>1 then raise exception 'ASSIGNED_CONSULTANT_MILESTONE_ACCESS_REGRESSION'; end if;
  select count(*) into n from public.consultant_client_review_events where id=review;
  if n<>1 then raise exception 'OWN_STORE_REVIEW_ACCESS_REGRESSION'; end if;
  select count(*) into n from public.consultant_client_review_events where id=other_review;
  if n<>0 then raise exception 'OTHER_AUTHOR_REVIEW_LEAK'; end if;
  reset role;
  raise exception using errcode='ZX001', message='ROLLBACK_TEST_FIXTURES';
  exception when sqlstate 'ZX001' then null;
  end;
end;
$test$;
