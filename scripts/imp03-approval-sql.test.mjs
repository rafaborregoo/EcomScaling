import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { execFile, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const container='supabase_db_E-NORA';
const database=`enora_imp03_test_${randomBytes(6).toString('hex')}`;
let created=false;
const id=(n)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const org=id(1), foreignOrg=id(2), store=id(3), otherStore=id(4), actor=id(5), consultant=id(6), staff=id(7), run=id(8), output=id(9), version=id(10), definition=id(11), token=id(12), secondToken=id(13);
const body={proposed_writes:[{kind:'task',title:'Verificar medición'},{kind:'task',title:'Completar costes'}],sources:[{reference:'synthetic-source'}]};
const json=(value)=>`'${JSON.stringify(value).replaceAll("'","''")}'::jsonb`;
const runSql=(db,sql)=>{
  if(db!==database&&db!=='postgres')throw Error('Unexpected database');
  return execFileSync('docker',['exec','-i',container,'psql','-X','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-Atq'],{input:sql,encoding:'utf8',maxBuffer:4*1024*1024});
};
const seed=`insert into public.organizations(id) values('${org}'),('${foreignOrg}');
insert into public.profiles(id) values('${actor}');
insert into public.profiles(id,is_consultant) values('${consultant}',true);
insert into public.profiles(id,is_platform_staff) values('${staff}',true);
insert into public.organization_members(organization_id,user_id,role) values('${org}','${actor}','owner');
insert into public.consultant_assignments values('${org}','${consultant}',true);
insert into public.shopify_stores(id,organization_id) values('${store}','${org}'),('${otherStore}','${org}');
insert into public.agent_definitions values('${definition}','a14_operativa_meta');
insert into public.agent_versions values('${version}','${definition}');
insert into public.agent_runs values('${run}','${org}','${store}','${version}','synthetic diagnostic');
insert into public.agent_outputs(id,organization_id,run_id,status,output) values('${output}','${org}','${run}','pending_approval',${json(body)});`;
const claim=(opts={})=>`public.claim_agent_output_decision_checked('${output}','${opts.org??org}','${opts.token??token}','${opts.decision??'approved'}',${json(opts.edits??[])},${opts.expected??`(select output from public.agent_outputs where id='${output}')`},'${opts.actor??actor}')`;
const valid=(tok=token)=>`to_jsonb(public.validate_agent_output_decision_claim('${output}','${org}','${tok}'))`;
const finish=(tok=token)=>`public.finalize_agent_output_decision('${output}','${org}','${tok}','${actor}','[]'::jsonb,null,null,0)`;
const check=(sql)=>JSON.parse(runSql(database,`begin; ${seed} ${sql} rollback;`).trim());
before(()=>{
  if(process.env.RUN_LOCAL_APPROVAL_SQL_TESTS!=='1')throw Error('Set RUN_LOCAL_APPROVAL_SQL_TESTS=1 for isolated local SQL tests.');
  const endpoint=execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
  assert.match(endpoint,/^(npipe:\/\/|unix:\/\/)/);
  assert.match(database,/^enora_imp03_test_[0-9a-f]{12}$/);
  runSql('postgres',`create database "${database}" template template0;`);created=true;
  runSql(database,readFileSync('scripts/fixtures/imp03-approval-schema.sql','utf8'));
  const a18=readFileSync('supabase/migrations/20261115795000_a18_versioned_replanning.sql','utf8');
  runSql(database,a18.slice(0,a18.indexOf('$$;')+3));
  const migration=readFileSync('supabase/migrations/20270115130000_imp03_approval_integrity.sql','utf8');
  runSql(database,migration);runSql(database,migration);
});
after(()=>{if(created){assert.match(database,/^enora_imp03_test_[0-9a-f]{12}$/);runSql('postgres',`drop database "${database}";`);}});

test('owner, assigned consultant and platform staff can claim this exact scope',()=>{
  for(const who of [actor,consultant,staff])assert.equal(check(`select ${claim({actor:who})};`).claimed,true);
});
test('foreign organization, wrong store, inactive member/profile and revoked assignment are rejected',()=>{
  assert.equal(check(`select ${claim({org:foreignOrg})};`).claimed,false);
  for(const change of [
    `update public.organization_members set access_scope='store',store_ids=array['${otherStore}'::uuid];`,
    `update public.organization_members set is_active=false;`,
    `update public.profiles set is_active=false where id='${actor}';`,
    `update public.organization_members set role='member';`,
    `update public.shopify_stores set organization_id='${foreignOrg}' where id='${store}';`,
  ])assert.equal(check(`${change} select ${claim()};`).reason,'actor_not_authorized');
  assert.equal(check(`update public.consultant_assignments set is_active=false; select ${claim({actor:consultant})};`).reason,'actor_not_authorized');
});
test('a store-limited owner cannot approve an aggregate output',()=>{
  assert.equal(check(`update public.organization_members set access_scope='store',store_ids=array['${store}'::uuid]; update public.agent_runs set store_id=null; select ${claim()};`).claimed,false);
});
test('internal knowledge and consultant panel stay inaccessible to the client',()=>{
  for(const change of [`update public.agent_definitions set code='a08_gestor_conocimiento';`,`update public.agent_runs set objective='[dashboard_scope=panel]';`]){
    assert.equal(check(`${change} select ${claim()};`).reason,'actor_not_authorized');
    assert.equal(check(`${change} select ${claim({actor:consultant,decision:'rejected'})};`).claimed,true);
  }
  assert.equal(check(`update public.agent_definitions set code='a08_gestor_conocimiento'; select ${claim({actor:consultant})};`).reason,'knowledge_audit_is_read_only');
});
test('a changed server snapshot cannot be claimed and a live claim cannot be taken twice',()=>{
  assert.equal(check(`select ${claim({expected:json({...body,sources:[]})})};`).reason,'source_changed');
  assert.equal(check(`do $$begin perform ${claim()}; end$$; select ${claim({token:secondToken})};`).reason,'decision_in_progress');
});
test('resuming preserves approved edits and refuses changed edits, actor or decision',()=>{
  const first=claim({edits:[{index:0,title:'Título aprobado'}]});
  const release=`do $$begin perform ${first}; end$$; delete from public.agent_output_decision_claims;`;
  assert.deepEqual(check(`${release} select ${claim({token:secondToken})};`).context.edits,[{index:0,title:'Título aprobado'}]);
  assert.equal(check(`${release} select ${claim({edits:[{index:0,title:'Otro título'}]})};`).reason,'decision_payload_changed');
  assert.equal(check(`${release} select ${claim({actor:consultant})};`).reason,'decision_conflict');
  assert.equal(check(`${release} select ${claim({decision:'rejected'})};`).reason,'decision_conflict');
});
test('store and agent version changes invalidate the claim',()=>{
  for(const change of [
    `update public.agent_runs set store_id='${otherStore}';`,
    `insert into public.agent_versions values('${id(14)}','${definition}'); update public.agent_runs set agent_version_id='${id(14)}';`,
  ])assert.equal(check(`do $$begin perform ${claim()}; end$$; ${change} select ${valid()};`),false);
});
test('source, frozen edits and decision context cannot be rewritten after a decision starts',()=>{
  for(const change of [
    `update public.agent_outputs set output=jsonb_set(output,'{sources}','[]'::jsonb);`,
    `update public.agent_outputs set output=jsonb_set(output,'{proposal_edits}','[{"index":0,"skip":true}]'::jsonb);`,
    `update public.agent_outputs set decision_context=null;`,
  ]){
    assert.equal(check(`do $$begin perform ${claim()}; begin ${change} raise exception 'source mutation accepted'; exception when insufficient_privilege then null; end; end$$;
      select ${valid()};`),true);
  }
});
test('revocation and expiry block both progress and final receipts',()=>{
  for(const change of [`update public.profiles set is_active=false where id='${actor}';`,`update public.agent_output_decision_claims set started_at=now()-interval '31 minutes';`]){
    assert.equal(check(`do $$begin perform ${claim()}; end$$; ${change} select ${valid()};`),false);
    assert.equal(check(`do $$begin perform ${claim()}; end$$; ${change} select ${finish()};`).ok,false);
  }
  assert.equal(check(`do $$begin perform ${claim()}; end$$; select ${valid(secondToken)};`),false);
});
test('partial progress does not authorize execution and can resume without changing its source hash',()=>{
  const result=check(`do $$begin perform ${claim()}; perform public.record_agent_output_decision_progress('${output}','${org}','${token}','[{"index":0,"status":"created"}]'); end$$;
    delete from public.agent_output_decision_claims; select ${claim({token:secondToken})};`);
  assert.equal(result.claimed,true);assert.equal(result.output.proposal_decisions[0].status,'created');
});
test('dismissals merge atomically, preserve edits and cannot modify an initiated decision',()=>{
  const dismiss=(index)=>`public.dismiss_agent_output_proposal('${output}','${org}',${index},'${actor}')`;
  assert.equal(check(`do $$begin perform ${dismiss(0)}; end$$; select ${dismiss(1)};`).all_dismissed,true);
  assert.equal(check(`select ${dismiss(5)};`).reason,'invalid_proposal_index');
  assert.equal(check(`do $$begin perform ${claim()}; end$$; select ${dismiss(0)};`).reason,'decision_in_progress');
  assert.equal(check(`do $$begin perform ${dismiss(0)}; end$$; select ${claim()};`).context.edits[0].skip,true);
  assert.equal(check(`do $$begin perform ${dismiss(0)}; end$$; select ${claim({edits:[{index:0,skip:false}]})};`).context.edits[0].skip,true);
});
test('receipt and output are confirmed together with a scoped source hash and repeat finalization creates no duplicate',()=>{
  const result=check(`do $$begin perform ${claim()}; perform ${finish()}; end$$;
    select jsonb_build_object('status',o.status,'receipt',a.id,'source_hash',a.decision_context->>'source_hash','claims',(select count(*) from public.agent_output_decision_claims),'repeat',${finish()})
    from public.agent_outputs o join public.agent_approvals a on a.output_id=o.id;`);
  assert.equal(result.status,'approved');assert.match(result.source_hash,/^[a-f0-9]{64}$/);assert.ok(result.receipt);assert.equal(result.claims,0);assert.equal(result.repeat.ok,false);
});
test('RPCs are invoker-only with pinned search paths and no public execution grants',()=>{
  const result=check(`select jsonb_agg(jsonb_build_object('name',p.proname,'definer',p.prosecdef,'config',p.proconfig,'anon',has_function_privilege('anon',p.oid,'EXECUTE'),'authenticated',has_function_privilege('authenticated',p.oid,'EXECUTE'),'service',has_function_privilege('service_role',p.oid,'EXECUTE')))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('claim_agent_output_decision_checked','validate_agent_output_decision_claim','dismiss_agent_output_proposal','finalize_agent_output_decision','record_agent_output_decision_progress','materialize_agent_output_note_checked','apply_a18_initiative_decision_checked');`);
  assert.equal(result.length,7);for(const row of result){assert.equal(row.definer,false);assert.ok(row.config.some(x=>x.startsWith('search_path=')));assert.equal(row.anon,false);assert.equal(row.authenticated,false);assert.equal(row.service,true);}
  assert.equal(check(`select to_jsonb(has_function_privilege('service_role','public.claim_agent_output_decision(uuid,uuid,uuid,text,jsonb)','EXECUTE'));`),false);
});

test('task insert consumes a current lease token and never persists it',()=>{
  const result=check(`do $$begin perform ${claim()}; end$$;
    insert into public.tasks(organization_id,store_id,agent_output_id,agent_proposal_index,metadata) values('${org}','${store}','${output}',0,jsonb_build_object('ai_decision_token','${token}','ai_rationale','synthetic'));
    select metadata from public.tasks;`);
  assert.deepEqual(result,{ai_rationale:'synthetic'});
});
test('expired/replaced tokens, revoked authority and foreign task scope cannot materialize work',()=>{
  for(const [change,writeStore,writeOrg,writeToken] of [
    [`update public.agent_output_decision_claims set started_at=now()-interval '31 minutes';`,store,org,token],
    [`update public.agent_output_decision_claims set token='${secondToken}';`,store,org,token],
    [`update public.profiles set is_active=false where id='${actor}';`,store,org,token],
    ['',otherStore,org,token],['',store,foreignOrg,token],['',store,org,secondToken],
  ]){
    const result=check(`do $$begin perform ${claim()}; end$$; ${change}
      do $$begin begin insert into public.tasks(organization_id,store_id,agent_output_id,agent_proposal_index,metadata) values('${writeOrg}','${writeStore}','${output}',0,jsonb_build_object('ai_decision_token','${writeToken}'));
      raise exception 'invalid task was accepted'; exception when insufficient_privilege then null; end; end$$;
      select to_jsonb(count(*)) from public.tasks;`);
    assert.equal(result,0);
  }
});
test('notes require a live approved lease and retries recover one note',()=>{
  const materialize=`public.materialize_agent_output_note_checked('${output}','${org}','${token}','${actor}',0,'Synthetic approved note')`;
  const prepare=`update public.agent_outputs set output=jsonb_set(output,'{proposed_writes,0,kind}','"note"'::jsonb);`;
  const result=check(`${prepare} do $$begin perform ${claim()}; perform ${materialize}; perform ${materialize}; end$$; select to_jsonb(count(*)) from public.agent_output_notes;`);
  assert.equal(result,1);
  const denied=check(`${prepare} do $$begin perform ${claim({decision:'rejected'})}; begin perform ${materialize}; raise exception 'rejected note accepted'; exception when insufficient_privilege then null; end; end$$;
    select to_jsonb(count(*)) from public.agent_output_notes;`);
  assert.equal(denied,0);
});

test('A18 retirement/replacement require the current source-bound lease and are idempotent',()=>{
  const previous=id(18);
  for(const action of ['replace','retire']){
    const source={...body,proposed_writes:[{kind:'task',title:'Nueva iniciativa',initiative_change:{action,previous_task_id:previous}}]};
    const prepare=`update public.agent_outputs set output=${json(source)}; update public.agent_definitions set code='a18_plan_mensual';
      insert into public.tasks(id,organization_id,store_id,source,status,metadata) values('${previous}','${org}','${store}','ai_consultant','pending','{"ai_monthly_initiative":{"version":1,"lifecycle_status":"active"}}');`;
    const replacement=json({title:'Nueva iniciativa',description:'Entregable',priority:'high',metadata:{ai_monthly_initiative:{version:2}},categories:[]});
    const apply=(tok=token)=>`public.apply_a18_initiative_decision_checked('${output}','${org}','${tok}',0,'${store}','${previous}','${action}','${actor}',${replacement})`;
    const result=check(`${prepare} do $$begin perform ${claim()}; perform ${apply()}; perform ${apply()}; end$$;
      select jsonb_build_object('count',(select count(*) from public.tasks),'status',t.status,'receipt',t.metadata->'ai_decision_receipt') from public.tasks t where id='${previous}';`);
    assert.equal(result.count,action==='replace'?2:1);assert.equal(result.status,'cancelled');assert.equal(result.receipt.output_id,output);
    assert.equal(check(`${prepare} do $$begin perform ${claim()}; begin perform ${apply(secondToken)}; raise exception 'stale A18 accepted'; exception when insufficient_privilege then null; end; end$$;
      select to_jsonb(status) from public.tasks where id='${previous}';`),'pending');
  }
});

test('two concurrent PostgreSQL sessions cannot claim the same decision twice',async()=>{
  runSql(database,seed);
  const invoke=(tok)=>new Promise((resolve,reject)=>{
    execFile('docker',['exec',container,'psql','-X','-U','postgres','-d',database,'-v','ON_ERROR_STOP=1','-Atq','-c',`select ${claim({token:tok,expected:json(body)})};`],
      {encoding:'utf8'},(error,stdout)=>error?reject(error):resolve(JSON.parse(stdout.trim())));
  });
  try{
    const results=await Promise.all([invoke(token),invoke(secondToken)]);
    assert.equal(results.filter(r=>r.claimed===true).length,1);
    assert.equal(results.filter(r=>r.claimed===false).length,1);
  }finally{
    runSql(database,'truncate public.tasks,public.agent_output_notes,public.agent_approvals,public.agent_output_decision_claims,public.agent_outputs,public.agent_runs,public.agent_versions,public.agent_definitions,public.shopify_stores,public.consultant_assignments,public.organization_members,public.profiles,public.organizations;');
  }
});
test('service role can run the checked path without SECURITY DEFINER or anonymous grants',()=>{
  assert.equal(check(`set local role service_role; select ${claim()};`).claimed,true);
  assert.equal(check(`set local role service_role; do $$begin perform ${claim()}; end$$;
    insert into public.tasks(organization_id,store_id,agent_output_id,agent_proposal_index,metadata) values('${org}','${store}','${output}',0,jsonb_build_object('ai_decision_token','${token}'));
    select ${finish()};`).ok,true);
});
test('an aggregate source never permits a task in another organization store',()=>{
  assert.equal(check(`update public.agent_runs set store_id=null; update public.shopify_stores set organization_id='${foreignOrg}' where id='${otherStore}';
    do $$begin perform ${claim()}; begin
      insert into public.tasks(organization_id,store_id,agent_output_id,agent_proposal_index,metadata) values('${org}','${otherStore}','${output}',0,jsonb_build_object('ai_decision_token','${token}'));
      raise exception 'foreign store accepted'; exception when insufficient_privilege then null; end; end$$;
    select to_jsonb(count(*)) from public.tasks;`),0);
});
test('task and note executors cannot materialize a different proposal kind or index',()=>{
  assert.equal(check(`do $$begin perform ${claim()}; begin
    perform public.materialize_agent_output_note_checked('${output}','${org}','${token}','${actor}',0,'Unproposed note');
    raise exception 'wrong note kind accepted'; exception when insufficient_privilege then null; end;
    begin insert into public.tasks(organization_id,store_id,agent_output_id,agent_proposal_index,metadata) values('${org}','${store}','${output}',999,jsonb_build_object('ai_decision_token','${token}'));
    raise exception 'unknown task index accepted'; exception when insufficient_privilege then null; end; end$$;
    select to_jsonb(count(*)) from public.tasks;`),0);
});
