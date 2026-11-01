import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

// Synthetic data stays in one rolled-back transaction. Auth users are deleted
// separately because JWTs must be issued by the real Auth endpoint.
const testRef = 'kopcblejsxpkxoykldyh';
const productionRef = 'cthjwpeygpzwdmjkxeqa';
const dbUrl = process.env.SUPABASE_DB_URL ?? '';
if (!dbUrl.includes(testRef) || dbUrl.includes(productionRef) || !process.env.SUPABASE_URL?.includes(testRef)) {
  throw new Error('A24 remote verification requires the TEST project in both database and API URLs.');
}
const db = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const users = [];
const signed = [];
const tag = randomUUID();
const ids = Object.fromEntries(['org','otherOrg','shopConnection','secondShopConnection','otherConnection','metaConnection','store','otherStore','outsideStore','account','campaign','run','output'].map((key) => [key, randomUUID()]));

after(async () => {
  try { await db.query('rollback'); } finally { await db.end().catch(() => {}); }
  for (const id of users) {
    const result = await admin.auth.admin.deleteUser(id);
    assert.ifError(result.error);
  }
});

before(async () => {
  await db.connect();
  await db.query('begin');
  await db.query("insert into public.organizations(id,display_name,slug) values($1,'A24 synthetic A',$3),($2,'A24 synthetic B',$4)", [ids.org,ids.otherOrg,`a24-test-a-${tag}`,`a24-test-b-${tag}`]);
  await db.query("insert into public.integration_connections(id,organization_id,provider,status) values($1,$2,'shopify','connected'),($3,$4,'shopify','connected'),($5,$2,'meta_ads','connected'),($6,$2,'shopify','connected')", [ids.shopConnection,ids.org,ids.otherConnection,ids.otherOrg,ids.metaConnection,ids.secondShopConnection]);
  await db.query("insert into public.shopify_stores(id,organization_id,connection_id,external_shop_id,myshopify_domain,shop_name) values($1,$2,$3,$4,$5,'A24 synthetic A'),($6,$2,$14,$7,$8,'A24 synthetic A2'),($9,$10,$11,$12,$13,'A24 synthetic B')", [ids.store,ids.org,ids.shopConnection,`a-${tag}`,`a24-a-${tag}.myshopify.com`,ids.otherStore,`a2-${tag}`,`a24-a2-${tag}.myshopify.com`,ids.outsideStore,ids.otherOrg,ids.otherConnection,`b-${tag}`,`a24-b-${tag}.myshopify.com`,ids.secondShopConnection]);
  await db.query("insert into public.meta_ad_accounts(id,organization_id,connection_id,external_ad_account_id,account_name,store_id,last_synced_at) values($1,$2,$3,$4,'A24 synthetic',$5,now()-interval '1 hour')", [ids.account,ids.org,ids.metaConnection,`act_${tag}`,ids.store]);
  await db.query("insert into public.meta_campaigns(id,organization_id,ad_account_id,external_campaign_id,name) values($1,$2,$3,$4,'A24 synthetic')",[ids.campaign,ids.org,ids.account,tag]);
  await db.query("insert into public.meta_ad_sets(organization_id,campaign_id,external_ad_set_id,name) select $1,$2,$3||n::text,'A24 synthetic '||n::text from generate_series(1,201) n",[ids.org,ids.campaign,tag]);
  await db.query("insert into public.meta_ads(organization_id,ad_set_id,external_ad_id,name) select $1,s.id,$2||s.id::text,'A24 synthetic ad' from public.meta_ad_sets s where s.campaign_id=$3 limit 3",[ids.org,tag,ids.campaign]);
  await db.query("insert into public.meta_ad_issues(organization_id,ad_id,level,error_code,error_type,error_summary) select $1,d.id,'warning',1,'synthetic','A24 synthetic fixture' from public.meta_ads d where d.organization_id=$1",[ids.org]);
  await db.query("insert into public.agent_runs(id,organization_id,agent_version_id,trigger_type,objective,status,store_id) select $1,$2,v.id,'manual','A24 synthetic verification','succeeded',$3 from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id where d.code='a24_medicion_meta' and v.is_active",[ids.run,ids.org,ids.store]);
  await db.query("insert into public.agent_outputs(id,run_id,organization_id,output) values($1,$2,$3,'{}'::jsonb)",[ids.output,ids.run,ids.org]);
  for (let i=0;i<2;i++) {
    const email=`a24-test-${tag}-${i}@ecomscaling.test`;
    const password=`A24-${randomUUID()}-9!`;
    const created=await admin.auth.admin.createUser({email,password,email_confirm:true});
    assert.ifError(created.error);
    assert.ok(created.data.user);
    users.push(created.data.user.id);
    const client=createClient(process.env.SUPABASE_URL,publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
    const login=await client.auth.signInWithPassword({email,password});
    assert.ifError(login.error);
    signed.push(client);
  }
});

const scope = () => ({ target_organization_id:ids.org,target_store_id:ids.store,period_start:'2026-10-01',period_end:'2026-10-20' });

test('A24 SQL paginates 201 identities without repeats, never broadens to another store or tenant', async () => {
  let cursor=null;
  const found=new Set();
  for (let page=0;page<4;page++) {
    const result=await db.query('select * from public.meta_measurement_event_page($1,$2,$3,$4,$5,100)',[ids.org,'2026-10-01','2026-10-20',ids.store,cursor]);
    for (const row of result.rows) {
      assert.equal(found.has(row.ad_set_id),false);
      found.add(row.ad_set_id);
      assert.equal(Number(row.eligible_ad_set_count),201);
    }
    if(result.rows.length<100)break;
    cursor=result.rows.at(-1).ad_set_id;
  }
  assert.equal(found.size,201);
  for(const [org,store] of [[ids.org,ids.otherStore],[ids.otherOrg,ids.store],[ids.org,ids.outsideStore]]) {
    const result=await db.query('select * from public.meta_measurement_event_page($1,$2,$3,$4,null,100)',[org,'2026-10-01','2026-10-20',store]);
    assert.equal(result.rowCount,0);
  }
  const first=await db.query('select * from public.meta_measurement_issue_page($1,$2,$3,$4,null,2)',[ids.org,'2026-10-01','2026-10-20',ids.store]);
  const second=await db.query('select * from public.meta_measurement_issue_page($1,$2,$3,$4,$5,2)',[ids.org,'2026-10-01','2026-10-20',ids.store,first.rows.at(-1).issue_id]);
  assert.equal(first.rowCount,2);assert.equal(second.rowCount,1);
  assert.ok(!first.rows.some((a)=>second.rows.some((b)=>a.issue_id===b.issue_id)));
});

test('Two real JWTs cannot execute service-only A24 RPCs or read private receipts', async () => {
  for(const client of signed) {
    for(const targetStore of [ids.store,ids.otherStore]) {
      const response=await client.rpc('meta_measurement_event_page',{...scope(),target_store_id:targetStore});
      assert.ok(response.error);assert.equal(response.error.code,'42501');
    }
    const receipt=await client.from('meta_pixel_sync_receipts').select('id').limit(1);
    assert.ok(receipt.error);assert.equal(receipt.error.code,'42501');
  }
});

async function assessment(status, fingerprint) {
  const result=await db.query(`select jsonb_build_object('organization_id',$1::uuid,'store_id',$2::uuid,
    'period_start','2026-10-01','period_end','2026-10-20','verdict_version','a24-measurement-v4','verdict_status',$3::text,
    'source_fingerprint',$4::text,'evaluated_at',now(),'expires_at',now()+interval '30 minutes',
    'verdict',jsonb_build_object('status',$3::text,'source_fingerprint',$4::text,'evaluated_at',now(),
      'reason_codes',jsonb_build_array('promoted_event_not_observed_or_unresolved'))) as payload`,[ids.org,ids.store,status,fingerprint]);
  const payload=result.rows[0].payload;
  const saved=await db.query('select public.meta_save_measurement_verdict($1::jsonb) as saved',[payload]);
  assert.equal(saved.rows[0].saved,true);
  const recorded=await db.query('select public.meta_record_measurement_assessment($1,$2,$3::jsonb) as result',[ids.org,ids.store,payload.verdict]);
  return recorded.rows[0].result;
}

test('A24 repair is atomic, deduplicates its task and closes only with a current assessment', async () => {
  assert.equal((await assessment('restricted','a24-failed')).status,'open');
  const task={title:'A24 synthetic repair',description:'Test-only evidence repair',priority:'medium',categories:['meta']};
  const args=[task,ids.org,ids.store,ids.output,0,null,null,null];
  const materialized=await db.query('select public.materialize_a24_measurement_task($1,$2,$3,$4,$5,$6,$7,$8) as result',args);
  assert.equal(materialized.rows[0].result.status,'materialized');
  const taskId=materialized.rows[0].result.task_id;
  const replay=await db.query('select public.materialize_a24_measurement_task($1,$2,$3,$4,$5,$6,$7,$8) as result',args);
  assert.equal(replay.rows[0].result.status,'incident_task_already_linked');
  const mismatch=await db.query('select public.materialize_a24_measurement_task($1,$2,$3,$4,$5,$6,$7,$8) as result',[task,ids.org,ids.otherStore,ids.output,0,null,null,null]);
  assert.equal(mismatch.rows[0].result.status,'output_not_pending_or_out_of_scope');
  const old=await db.query("select public.meta_record_measurement_assessment($1,$2,jsonb_build_object('status','usable_with_attribution_limits','source_fingerprint','old','evaluated_at',now()-interval '2 hours')) as result",[ids.org,ids.store]);
  assert.equal(old.rows[0].result.status,'assessment_not_current');
  assert.equal((await assessment('usable_with_attribution_limits','a24-repaired')).status,'resolved_open_incidents');
  const closed=await db.query('select status,task_id,resolved_at from public.meta_measurement_incidents where organization_id=$1',[ids.org]);
  assert.equal(closed.rows[0].status,'resolved');assert.equal(closed.rows[0].task_id,taskId);assert.ok(closed.rows[0].resolved_at);
  assert.equal((await assessment('restricted','a24-reopened')).status,'open');
  const tasks=await db.query('select count(*) from public.tasks where organization_id=$1',[ids.org]);
  assert.equal(Number(tasks.rows[0].count),1);
});

test('A24 rejects a cache writer whose evidence predates a sync', async () => {
  await db.query("update public.meta_ad_accounts set last_synced_at=now()+interval '1 second' where id=$1",[ids.account]);
  const result=await db.query(`select public.meta_save_measurement_verdict(jsonb_build_object('organization_id',$1::uuid,'store_id',$2::uuid,
    'period_start','2026-10-01','period_end','2026-10-20','verdict_version','a24-measurement-v4','verdict_status','restricted',
    'verdict',jsonb_build_object('status','restricted'),'source_fingerprint','old','evaluated_at',now(),'expires_at',now()+interval '30 minutes')) as saved`,[ids.org,ids.store]);
  assert.equal(result.rows[0].saved,false);
});
