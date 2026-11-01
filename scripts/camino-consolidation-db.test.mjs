// Run after: npm install --prefix tmp/camino-db-test --no-save --package-lock=false @electric-sql/pglite
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { PGlite } = require('../tmp/camino-db-test/node_modules/@electric-sql/pglite');
const org = '00000000-0000-4000-8000-000000000001', actor = '00000000-0000-4000-8000-000000000002';
const plan = '00000000-0000-4000-8000-000000000003', phase = '00000000-0000-4000-8000-000000000004';
const milestone = '00000000-0000-4000-8000-000000000005', proposal = '00000000-0000-4000-8000-000000000006';
test('migración real: decisiones atómicas, autorización, verificación y cierres históricos', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema private;
      create function private.can_access_org(uuid) returns boolean language sql as 'select false';
      create table organizations(id uuid primary key); create table profiles(id uuid primary key);
      create type plan_status as enum('draft','active','completed','archived');
      create type plan_phase_status as enum('locked','pending','active','completed');
      create type milestone_status as enum('locked','pending','in_progress','completed','skipped');
      create table strategic_plans(id uuid primary key,organization_id uuid,status plan_status,goal jsonb, completed_on date);
      create table strategic_plan_phases(id uuid primary key,organization_id uuid,plan_id uuid,name text,position int,status plan_phase_status,completed_at timestamptz,activated_at timestamptz,activated_by uuid);
      create table strategic_plan_milestones(id uuid primary key,organization_id uuid,phase_id uuid,name text,description text,position int default 1,status milestone_status,target_date date,completed_at timestamptz,completed_by uuid,completion_evidence text);
      create table tasks(id uuid primary key,title text,status text,due_at timestamptz);
      create table milestone_task_links(milestone_id uuid,task_id uuid);
      create table organization_metric_targets(id uuid primary key,organization_id uuid,milestone_id uuid,metric_key text,target_value numeric,period text,valid_from date,valid_until date);
      create table agent_outputs(id uuid primary key,output jsonb);
      create table strategic_plan_weekly_reviews(id uuid primary key,plan_id uuid,status text,output_id uuid,period_end timestamptz,created_at timestamptz);
      create table strategic_plan_change_proposals(id uuid primary key,organization_id uuid,plan_id uuid,proposal jsonb);
      create table strategic_plan_change_proposal_events(id uuid primary key default gen_random_uuid(),proposal_id uuid,organization_id uuid,action text,actor_user_id uuid,actor_role text,reason text,edited_proposal jsonb,created_at timestamptz default now());
      insert into organizations values('${org}'); insert into profiles values('${actor}');
      insert into strategic_plans values('${plan}','${org}','active','{"target":15,"monthly_targets":[{"target_value":15}]}',null);
      insert into strategic_plan_phases(id,organization_id,plan_id,name,position,status) values('${phase}','${org}','${plan}','Fase',1,'active');
      insert into strategic_plan_milestones(id,organization_id,phase_id,name,status) values('${milestone}','${org}','${phase}','Hito','pending');
      insert into strategic_plan_change_proposals values('${proposal}','${org}','${plan}','{"change":"edit","target_type":"goal","structured_change":{"field":"target","before":15,"value":20}}');
    `);
    const sql = readFileSync(new URL('../supabase/migrations/20270114100000_camino_consolidation.sql', import.meta.url), 'utf8');
    await db.exec(sql);
    await db.exec(sql); // Must be idempotent.
    const decide = (expected = null) => db.query('select camino_proposal_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)', [org,plan,proposal,actor,'client','apply',null,expected,null]);
    await decide();
    assert.equal((await db.query('select goal from strategic_plans')).rows[0].goal.target, 20);
    assert.equal((await db.query('select goal from strategic_plans')).rows[0].goal.monthly_targets[0].target_value, 20);
    await assert.rejects(decide(), /stale/);
    assert.equal((await db.query('select count(*)::int as n from strategic_plan_change_proposal_events')).rows[0].n, 1);
    const second = '00000000-0000-4000-8000-000000000007';
    await db.query('insert into strategic_plan_change_proposals values($1,$2,$3,$4)',[second,org,plan,{change:'edit',target_type:'goal',structured_change:{field:'target',before:15,value:25}}]);
    await assert.rejects(db.query('select camino_proposal_decision($1,$2,$3,$4,$5,$6,$7,$8,$9)',[org,plan,second,actor,'client','apply',null,null,null]),/target_changed/);
    const close = (status, verification = null) => db.query('select camino_transition_milestone($1,$2,$3,$4,$5,$6)',[org,milestone,actor,status,'Evidencia humana comprobada en la tienda.',verification]);
    await assert.rejects(close('completed'), /verification_required/);
    await db.query('insert into organization_metric_targets(id,organization_id,milestone_id,metric_key,target_value,period,valid_from) values($1,$2,$3,$4,$5,$6,current_date)',[second,org,milestone,'net_margin_pct',20,'monthly']);
    await assert.rejects(close('completed',{kind:'metric',checks:[]}), /metric_not_met/);
    assert.equal((await db.query('select status from strategic_plan_milestones')).rows[0].status, 'pending');
    await close('completed',{kind:'exception',checks:[]});
    assert.equal((await db.query('select status from strategic_plans')).rows[0].status,'completed');
    assert.equal((await db.query('select count(*)::int as n from camino_closures')).rows[0].n,1);
    await close('in_progress');
    await close('skipped');
    assert.equal((await db.query('select count(*)::int as n from camino_closures')).rows[0].n,2);
    assert.equal((await db.query('select count(*)::int as n from camino_milestone_verifications')).rows[0].n,3);
    await db.exec('set role authenticated');
    await assert.rejects(decide(), /permission denied/);
    await db.exec('reset role');
  } finally { await db.close(); }
});
