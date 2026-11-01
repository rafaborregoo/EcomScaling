import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

const testRef = 'kopcblejsxpkxoykldyh';
const url = process.env.SUPABASE_DB_URL ?? '';
if (!url.includes(testRef) || !process.env.SUPABASE_URL?.includes(testRef) || url.includes('cthjwpeygpzwdmjkxeqa')) throw Error('A26 fixtures require TEST.');
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const users = [], clients = [];
const tag = randomUUID();
const ids = Object.fromEntries(['org','otherOrg','shop','otherShop','connection','otherConnection','store','otherStore','account','otherAccount','campaign','otherCampaign','run','output','review','draft'].map((name) => [name, randomUUID()]));
let selected;

after(async () => {
  try { await db.query('rollback'); } finally { await db.end().catch(() => {}); }
  for (const id of users) assert.ifError((await admin.auth.admin.deleteUser(id)).error);
});
before(async () => {
  for (let i = 0; i < 2; i++) {
    const email = `a26-test-${tag}-${i}@ecomscaling.test`, password = `A26-${randomUUID()}-9!`;
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert.ifError(created.error); users.push(created.data.user.id);
    const client = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } });
    assert.ifError((await client.auth.signInWithPassword({ email, password })).error); clients.push(client);
  }
  await db.connect(); await db.query('begin');
  await db.query("insert into public.organizations(id,display_name,slug) values($1,'A26 fixture',$3),($2,'A26 other fixture',$4)", [ids.org,ids.otherOrg,`a26-${tag}`,`a26-other-${tag}`]);
  await db.query("insert into public.integration_connections(id,organization_id,provider,status) values($1,$2,'shopify','connected'),($3,$4,'shopify','connected'),($5,$2,'klaviyo','connected'),($6,$4,'klaviyo','connected')", [ids.shop,ids.org,ids.otherShop,ids.otherOrg,ids.connection,ids.otherConnection]);
  await db.query("insert into public.shopify_stores(id,organization_id,connection_id,external_shop_id,myshopify_domain,shop_name) values($1,$2,$3,$4,$5,'A26'),($6,$7,$8,$9,$10,'A26 other')", [ids.store,ids.org,ids.shop,tag,`a26-${tag}.myshopify.com`,ids.otherStore,ids.otherOrg,ids.otherShop,`other-${tag}`,`a26-other-${tag}.myshopify.com`]);
  await db.query("insert into public.klaviyo_accounts(id,organization_id,connection_id,external_account_id,store_id,last_synced_at) values($1,$2,$3,$4,$5,now()),($6,$7,$8,$9,$10,now())", [ids.account,ids.org,ids.connection,tag,ids.store,ids.otherAccount,ids.otherOrg,ids.otherConnection,`other-${tag}`,ids.otherStore]);
  await db.query("insert into public.klaviyo_campaigns(id,organization_id,account_id,external_campaign_id,name,status) values($1,$2,$3,$4,'A26','sent'),($5,$6,$7,$8,'Other','sent')", [ids.campaign,ids.org,ids.account,tag,ids.otherCampaign,ids.otherOrg,ids.otherAccount,`other-${tag}`]);
  await db.query("insert into public.klaviyo_templates(organization_id,account_id,external_template_id,html_content) values($1,$2,'REUSED','<p>First tenant</p>'),($3,$4,'REUSED','<p>Other tenant secret</p>')", [ids.org,ids.account,ids.otherOrg,ids.otherAccount]);
  await db.query("insert into public.klaviyo_campaign_messages(organization_id,campaign_id,external_message_id,external_template_id,subject,channel,status) select $1,$2,$3||n::text,'REUSED','Observed subject','email','sent' from generate_series(1,201) n", [ids.org,ids.campaign,tag]);
  await db.query("insert into public.klaviyo_campaign_messages(organization_id,campaign_id,external_message_id,external_template_id,subject,channel,status) values($1,$2,$3,'REUSED','Other subject','email','sent')", [ids.otherOrg,ids.otherCampaign,tag]);
  await db.query("insert into public.agent_runs(id,organization_id,agent_version_id,trigger_type,objective,status,store_id) select $1,$2,v.id,'manual','A26 synthetic verification','succeeded',$3 from public.agent_versions v join public.agent_definitions d on d.id=v.definition_id where d.code='a26_contenido_email' and v.is_active", [ids.run,ids.org,ids.store]);
  await db.query("insert into public.agent_outputs(id,run_id,organization_id,output,status) values($1,$2,$3,'{}','pending_approval')", [ids.output,ids.run,ids.org]);
  selected = (await page()).rows[0];
  await db.query("insert into public.a26_content_reviews(id,organization_id,store_id,account_id,message_id,content_hash,source_revision,output_id,review_ref,review,evidence) values($1,$2,$3,$4,$5,$6,$7,$8,'r1',$9,$10)", [ids.review,ids.org,ids.store,ids.account,selected.message_id,'a'.repeat(64),selected.source_revision,ids.output,{ dimension: 'body', permitted_change: 'Precisar CTA', acceptance_criterion: 'Destino claro', destination: 'a11' },selected]);
});

async function page(cursor = null, org = ids.org, store = ids.store) {
  return (await db.query('select public.a26_email_inventory_page($1,$2,$3,100) as value', [org,store,cursor])).rows[0].value;
}
async function task(planId = null) {
  return (await db.query('select public.materialize_a26_content_task($1,$2,$3,$4,0,$5,null,null,\'r1\',null) as value', [{ title:'A26 revision',description:'Precisar CTA',priority:'medium',metadata:{} },ids.org,ids.store,ids.output,planId])).rows[0].value;
}

test('A26 final RPCs paginate 201 emails, isolate tenants and preserve unknown tracking', async () => {
  const found = new Set(); let cursor = null;
  do {
    const data = await page(cursor); assert.equal(data.total_count, 201);
    for (const row of data.rows) { assert.equal(found.has(row.message_id), false); found.add(row.message_id); assert.equal(row.account_id, ids.account); assert.equal(row.adds_utm, null); assert.equal(row.body_chars, '<p>First tenant</p>'.length); }
    cursor = data.next_cursor;
  } while (cursor);
  assert.equal(found.size, 201);
  assert.equal((await page(null, ids.otherOrg, ids.store)).rows.length, 0);
  assert.equal((await page(null, ids.org, ids.otherStore)).rows.length, 0);
  await db.query('savepoint scope_check');
  await assert.rejects(db.query('select public.a26_email_inventory_page($1,null,null,100)',[ids.org]), /STORE_REQUIRED/);
  await db.query('rollback to scope_check');
  // Named arguments are validated against the deployed final function.
  await db.query('select * from public.klaviyo_email_variation_report(target_organization_id=>$1,target_period_start=>$2,target_period_end=>$3,target_store_id=>$4)', [ids.org,'2026-09-01','2026-09-30',ids.store]);
  const item=(await db.query('select public.a26_email_inventory_item($1,$2,$3) as value',[ids.org,ids.store,selected.message_id])).rows[0].value;
  assert.equal(item.rows[0].message_id,selected.message_id);
  assert.equal((await db.query('select public.a26_email_inventory_item($1,$2,$3) as value',[ids.otherOrg,ids.otherStore,selected.message_id])).rows[0].value.rows.length,0);
});

test('Two real JWTs cannot read private A26 evidence or execute service RPCs', async () => {
  for (const client of clients) {
    const inventory = await client.rpc('a26_email_inventory_page',{ p_organization_id:ids.org,p_store_id:ids.store });
    assert.equal(inventory.error?.code,'42501');
    const ledger = await client.from('a26_content_reviews').select('id').limit(1);
    assert.equal(ledger.error?.code,'42501');
    for(const table of ['a26_content_run_claims','a26_render_receipts','a26_content_message_samples']) assert.equal((await client.from(table).select('*').limit(1)).error?.code,'42501');
    const outcome = await client.rpc('a26_record_review_outcome',{p_organization_id:ids.org,p_store_id:ids.store,p_review_id:ids.review,p_status:'open',p_evidence:{note:'synthetic evidence'}});
    assert.equal(outcome.error?.code,'42501');
    assert.equal((await client.rpc('a26_link_revision_draft',{p_organization_id:ids.org,p_review_id:ids.review,p_draft_id:ids.draft})).error?.code,'42501');
  }
});

test('A26 reserves store runs and recovers expired leases; quota replay does not reserve twice', async () => {
  const claim=async (token)=>(await db.query('select public.a26_claim_content_run($1,$2,$3,\'fingerprint\') as value',[ids.org,ids.store,token])).rows[0].value;
  assert.equal(await claim(randomUUID()),'claimed'); assert.equal(await claim(randomUUID()),'busy');
  await db.query("update public.a26_content_run_claims set lease_until=now()-interval '1 second' where store_id=$1",[ids.store]);
  assert.equal(await claim(randomUUID()),'claimed');
  const quota=async (request)=>(await db.query('select public.reserve_a26_manual_refresh($1,$2,\'a26_contenido_email\',2,$3,$4) as value',[randomUUID(),ids.org,request,ids.store])).rows[0].value;
  assert.equal(await quota('same-key'),'reserved'); assert.equal(await quota('same-key'),'duplicate'); assert.equal(await quota('different-key'),'limit');
});

test('A26 sampling progress is durable and content changes reset the coverage epoch', async () => {
  await db.query('savepoint sampling');
  const digest=async ()=>(await db.query('select public.a26_content_activity_digest($1,$2) as value',[ids.org,ids.store])).rows[0].value;
  const first=await digest();
  const status=async (fingerprint)=>(await db.query('select public.a26_content_sampling_status($1,$2,$3) as value',[ids.org,ids.store,fingerprint])).rows[0].value;
  assert.equal((await status(first)).eligible_count,201); assert.equal((await status(first)).pending,true);
  await db.query('insert into public.a26_content_message_samples(organization_id,store_id,message_id,source_revision,fingerprint,run_id) values($1,$2,$3,$4,$5,$6)',[ids.org,ids.store,selected.message_id,selected.source_revision,first,ids.run]);
  assert.equal((await status(first)).sample_count,1);
  await db.query('insert into public.a26_content_message_samples(organization_id,store_id,message_id,source_revision,fingerprint,run_id) select $1,$2,id,\'fixture\',$3,$4 from public.klaviyo_campaign_messages where campaign_id=$5 on conflict(store_id,message_id) do update set fingerprint=excluded.fingerprint',[ids.org,ids.store,first,ids.run,ids.campaign]);
  assert.equal((await status(first)).pending,false);
  await db.query("update public.klaviyo_templates set html_content='<p>Changed source</p>' where account_id=$1",[ids.account]);
  const changed=await digest(); assert.notEqual(changed,first); assert.equal((await status(changed)).sample_count,0);
  await db.query('rollback to sampling');
});

test('A26 materializes a message beyond the first 5000 inventory entries', async () => {
  await db.query('savepoint large_inventory');
  await db.query("insert into public.klaviyo_campaign_messages(organization_id,campaign_id,external_message_id,external_template_id,subject,channel,status) select $1,$2,$3||'large-'||n::text,'REUSED','Observed subject','email','sent' from generate_series(1,5001) n",[ids.org,ids.campaign,tag]);
  const target=(await db.query('select id from public.klaviyo_campaign_messages where campaign_id=$1 order by id desc limit 1',[ids.campaign])).rows[0].id;
  const item=(await db.query('select public.a26_email_inventory_item($1,$2,$3) as value',[ids.org,ids.store,target])).rows[0].value.rows[0];
  await db.query('update public.a26_content_reviews set message_id=$1,source_revision=$2,evidence=$3 where id=$4',[target,item.source_revision,item,ids.review]);
  assert.equal((await task()).status,'materialized');
  await db.query('rollback to large_inventory');
});

test('A26 materialization rejects stale Camino, survives unchanged syncs, and deduplicates replay', async () => {
  assert.equal((await task(randomUUID())).status,'camino_changed_since_analysis');
  const before = (await page()).rows.find((row) => row.message_id === selected.message_id).source_revision;
  await db.query('update public.klaviyo_campaign_messages set last_synced_at=now() where id=$1',[selected.message_id]);
  assert.equal((await page()).rows.find((row) => row.message_id === selected.message_id).source_revision,before);
  const first=await task(); assert.equal(first.status,'materialized'); assert.equal(first.created,true);
  const second=await task(); assert.equal(second.task_id,first.task_id); assert.equal(second.created,false);
  await db.query("update public.klaviyo_campaign_messages set subject='Changed after review' where id=$1",[selected.message_id]);
  assert.equal((await task()).status,'content_changed_since_analysis');
});

test('A26 links A11 drafts atomically, validates provenance and repairs an interrupted link', async () => {
  await db.query('savepoint draft_link');
  // The previous test deliberately invalidated this source. Restore its current revision for this case.
  const row=(await db.query('select public.a26_email_inventory_item($1,$2,$3) as value',[ids.org,ids.store,selected.message_id])).rows[0].value.rows[0];
  await db.query("update public.a26_content_reviews set status='open',source_revision=$1 where id=$2",[row.source_revision,ids.review]);
  await db.query("update public.agent_outputs set status='approved' where id=$1",[ids.output]);
  const source={review_id:ids.review,output_id:ids.output,store_id:ids.store,account_id:ids.account,message_id:selected.message_id,content_hash:'a'.repeat(64),source_revision:row.source_revision};
  const draftId=randomUUID();
  const insert=async (draft,provenance)=>db.query("insert into public.marketing_content_drafts(id,organization_id,created_by,content_type,request,version,summary,template_name,subject,purpose,audience,locale,tone,plain_text,html,confidence) values($1,$2,$3,'campaign',$4,1,'Synthetic','A26','Subject','Review','Existing','es','clear','Body','<p>Body</p>','medium')",[draft,ids.org,users[0],{a26_source:provenance}]);
  await db.query('savepoint forged_link');
  await assert.rejects(insert(randomUUID(),{...source,content_hash:'b'.repeat(64)}),/PROVENANCE_MISMATCH/);
  await db.query('rollback to forged_link');
  await insert(draftId,source);
  assert.equal((await db.query('select draft_id from public.a26_content_reviews where id=$1',[ids.review])).rows[0].draft_id,draftId);
  await db.query('update public.a26_content_reviews set draft_id=null where id=$1',[ids.review]);
  const repaired=(await db.query('select public.a26_link_revision_draft($1,$2,$3) as value',[ids.org,ids.review,draftId])).rows[0].value;
  assert.equal(repaired.draft_id,draftId);
  await db.query('rollback to draft_link');
});

test('A26 editorial closure requires the exact linked draft revision', async () => {
  const outcome = async (version) => (await db.query('select public.a26_record_review_outcome($1,$2,$3,\'verified\',$4) as value',[ids.org,ids.store,ids.review,{note:'Checked the editorial acceptance criterion',draft_version:version}])).rows[0].value;
  assert.equal((await outcome(1)).status,'draft_revision_required');
  await db.query("insert into public.marketing_content_drafts(id,organization_id,created_by,content_type,request,version,summary,template_name,subject,purpose,audience,locale,tone,plain_text,html,confidence) values($1,$2,$3,'campaign',$4,1,'Synthetic','A26','Subject','Review','Existing','es','clear','Body','<p>Body</p>','medium')",[ids.draft,ids.org,users[0],{a26_source:{content_hash:'a'.repeat(64)}}]);
  await db.query('update public.a26_content_reviews set draft_id=$1 where id=$2',[ids.draft,ids.review]);
  assert.equal((await outcome(2)).status,'draft_revision_required');
  assert.equal((await outcome(1)).status,'verified');
  const reopened=(await db.query('select public.a26_record_review_outcome($1,$2,$3,\'open\',$4) as value',[ids.org,ids.store,ids.review,{note:'New version requires another review'}])).rows[0].value;
  assert.equal(reopened.status,'open');
});
