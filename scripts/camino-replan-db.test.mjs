// Run after: npm install --prefix tmp/camino-db-test --no-save --package-lock=false @electric-sql/pglite
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { PGlite } = require('../tmp/camino-db-test/node_modules/@electric-sql/pglite');

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const org = uuid(1), actor = uuid(2), store = uuid(3), plan = uuid(4), phase = uuid(5), openMs = uuid(6), doneMs = uuid(7);
const keptTask = uuid(10), retiredTask = uuid(11), doneTask = uuid(12), output = uuid(20), objective = uuid(30), note = uuid(31);

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create type plan_status as enum('draft','active','completed','archived');
    create type plan_phase_status as enum('locked','pending','active','completed');
    create type milestone_status as enum('locked','pending','in_progress','completed','skipped');
    create type task_priority as enum('low','medium','high','urgent');
    create type task_source as enum('strategic_plan','manual');
    create type task_status as enum('pending','in_progress','completed','ignored','cancelled');
    create table strategic_plans(id uuid primary key default gen_random_uuid(),organization_id uuid,store_id uuid,name text,description text,goal jsonb,horizon_months int,currency_code text,display_fx jsonb,status plan_status default 'draft',version int,starts_on date,approved_by uuid,approved_at timestamptz,created_by uuid);
    create table strategic_plan_phases(id uuid primary key default gen_random_uuid(),organization_id uuid,plan_id uuid,name text,description text,rationale text,evidence jsonb,position int,status plan_phase_status default 'pending',activated_at timestamptz,activated_by uuid,created_by uuid);
    create table strategic_plan_milestones(id uuid primary key default gen_random_uuid(),organization_id uuid,phase_id uuid,name text,description text,success_criteria text,rationale text,target_date date,deadline_date date,measurement_date date,position int,status milestone_status default 'pending',created_by uuid);
    create table tasks(id uuid primary key default gen_random_uuid(),organization_id uuid,store_id uuid,source task_source,priority task_priority,categories text[],title text,description text,status task_status default 'pending',due_at timestamptz,created_by uuid,assigned_to uuid,ignored_at timestamptz,ignored_reason text);
    create table milestone_task_links(id uuid primary key default gen_random_uuid(),organization_id uuid,milestone_id uuid,task_id uuid,position int,owner_role text,kind text,track text,cadence text,effort_hours numeric,definition_of_done text,rationale text,evidence jsonb, unique(milestone_id,task_id));
    create table organization_metric_targets(id uuid primary key default gen_random_uuid(),organization_id uuid,store_id uuid,milestone_id uuid,metric_key text,target_value numeric,period text,valid_from date,created_by uuid);
    create table campaign_calendar_items(id uuid primary key default gen_random_uuid(),organization_id uuid,milestone_id uuid);
    create table meetings(id uuid primary key default gen_random_uuid(),organization_id uuid,milestone_id uuid);
    create table milestone_internal_notes(id uuid primary key default gen_random_uuid(),organization_id uuid,milestone_id uuid,body text);
    create table agent_outputs(id uuid primary key,organization_id uuid,status text,published_at timestamptz);
    create table audit_logs(id uuid primary key default gen_random_uuid(),organization_id uuid,actor_user_id uuid,action text,entity_type text,entity_id uuid,new_data jsonb);
    insert into strategic_plans(id,organization_id,store_id,name,goal,currency_code,display_fx,status,version,starts_on) values('${plan}','${org}','${store}','V1','{"target":75000}','EUR','{"to":"USD","rate":1.1}','active',1,'2026-10-15');
    insert into strategic_plan_phases(id,organization_id,plan_id,name,position,status) values('${phase}','${org}','${plan}','F',1,'active');
    insert into strategic_plan_milestones(id,organization_id,phase_id,name,position,status,target_date) values('${doneMs}','${org}','${phase}','Hecho',1,'completed','2026-10-20'),('${openMs}','${org}','${phase}','Abierto',2,'pending','2026-11-20');
    insert into tasks(id,organization_id,store_id,source,priority,title,status,assigned_to) values('${keptTask}','${org}','${store}','strategic_plan','medium','Conservar','pending','${actor}'),('${retiredTask}','${org}','${store}','strategic_plan','medium','Retirar','pending',null),('${doneTask}','${org}','${store}','strategic_plan','medium','Hecha','completed',null);
    insert into milestone_task_links(organization_id,milestone_id,task_id,position) values('${org}','${openMs}','${keptTask}',1),('${org}','${openMs}','${retiredTask}',2),('${org}','${doneMs}','${doneTask}',1);
    insert into organization_metric_targets(id,organization_id,milestone_id,metric_key,target_value) values('${objective}','${org}','${openMs}','net_profit',100);
    insert into milestone_internal_notes(id,organization_id,milestone_id,body) values('${note}','${org}','${openMs}','Nota');
    insert into agent_outputs values('${output}','${org}','pending_approval',null);
  `);
  const sql = readFileSync(new URL('../supabase/migrations/20270118100000_camino_replanificacion.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // Debe ser idempotente.
  return db;
}

const tree = (tasks) => ({
  name: 'V2',
  goal: { target: 75000 },
  horizon_months: 6,
  currency_code: 'EUR',
  phases: [{ name: 'Nueva', evidence: [], milestones: [{ name: 'Abierto', target_date: '2026-11-25', source_milestone_id: openMs, tasks }] }],
});
const kept = { title: 'Conservar', priority: 'high', due_at: '2026-11-22', source_task_id: keptTask, owner: 'shared', evidence: [] };
const fresh = { title: 'Nueva', priority: 'medium', due_at: '2026-11-23', owner: 'client', assigned_to: null, category: 'general', evidence: [] };
const retire = [{ task_id: retiredTask, reason: 'Ya no aplica' }];
const fingerprint = async (db) => (await db.query(`select public.camino_plan_fingerprint('${plan}') as value`)).rows[0].value;
const apply = (db, print, plan_tree, retiring = retire) => db.query(
  `select public.camino_apply_replan($1,$2,$3,$4,$5,$6,$7,$8,$9) as result`,
  [org, actor, plan, print, output, JSON.stringify(plan_tree), JSON.stringify(retiring), JSON.stringify({ from_version: 1 }), '2026-11-05'],
);
const planState = async (db) => (await db.query(`select status::text as status, count(*) over () as plans from strategic_plans where id='${plan}'`)).rows[0];

test('T17/T18: nueva versión activa, misma tarea, historial intacto', async () => {
  const db = await setup();
  try {
    const { rows } = await apply(db, await fingerprint(db), tree([kept, fresh]));
    const result = rows[0].result;
    assert.equal(result.version, 2);
    assert.equal(result.status, 'active');
    assert.equal(result.moved, 1);
    assert.equal(result.created, 1);
    assert.equal(result.retired, 1);

    const plans = (await db.query(`select id, status::text as status, starts_on::text as starts_on, replaces_plan_id, display_fx from strategic_plans order by version`)).rows;
    assert.deepEqual(plans.map((row) => row.status), ['archived', 'active']);
    assert.equal(plans[1].replaces_plan_id, plan);
    assert.equal(plans[1].starts_on, '2026-11-05');
    assert.deepEqual(plans[1].display_fx, { to: 'USD', rate: 1.1 });

    const task = (await db.query(`select status::text as status, title, priority::text as priority, assigned_to from tasks where id='${keptTask}'`)).rows[0];
    assert.equal(task.status, 'pending');
    assert.equal(task.priority, 'high');
    assert.equal(task.assigned_to, actor, 'una tarea conservada mantiene su responsable');
    const link = (await db.query(`select m.name, f.plan_id from milestone_task_links l join strategic_plan_milestones m on m.id=l.milestone_id join strategic_plan_phases f on f.id=m.phase_id where l.task_id='${keptTask}'`)).rows;
    assert.equal(link.length, 1);
    assert.equal(link[0].plan_id, result.plan_id);

    const retired = (await db.query(`select status::text as status, ignored_reason from tasks where id='${retiredTask}'`)).rows[0];
    assert.deepEqual(retired, { status: 'ignored', ignored_reason: 'Ya no aplica' });

    const done = (await db.query(`select t.status::text as status, f.plan_id from tasks t join milestone_task_links l on l.task_id=t.id join strategic_plan_milestones m on m.id=l.milestone_id join strategic_plan_phases f on f.id=m.phase_id where t.id='${doneTask}'`)).rows[0];
    assert.equal(done.status, 'completed');
    assert.equal(done.plan_id, plan, 'lo hecho se queda en su versión');

    const moved = (await db.query(`select m.name, f.plan_id from organization_metric_targets o join strategic_plan_milestones m on m.id=o.milestone_id join strategic_plan_phases f on f.id=m.phase_id where o.id='${objective}'`)).rows[0];
    assert.equal(moved.plan_id, result.plan_id, 'el objetivo sigue a su hito');
    const phaseStatus = (await db.query(`select status::text as status, activated_by from strategic_plan_phases where plan_id='${result.plan_id}'`)).rows[0];
    assert.equal(phaseStatus.status, 'active');
    assert.equal((await db.query(`select status from agent_outputs where id='${output}'`)).rows[0].status, 'published');
    assert.equal((await db.query(`select count(*)::int as n from audit_logs where action='strategic_plan.replan'`)).rows[0].n, 1);
  } finally { await db.close(); }
});

test('T15: si el Camino cambia mientras se revisa, no se aplica nada', async () => {
  const db = await setup();
  try {
    const before = await fingerprint(db);
    await db.exec(`update tasks set status='completed' where id='${keptTask}'`);
    await assert.rejects(apply(db, before, tree([fresh])), /camino_replan_stale/);
    assert.equal((await planState(db)).status, 'active');
  } finally { await db.close(); }
});

test('T16: un fallo a mitad no deja nada aplicado', async () => {
  const db = await setup();
  try {
    const print = await fingerprint(db);
    await assert.rejects(db.transaction(async (tx) => {
      await tx.query(`select public.camino_apply_replan($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [org, actor, plan, print, output, JSON.stringify(tree([{ ...kept, source_task_id: doneTask }])), JSON.stringify(retire), '{}', '2026-11-05']);
    }), /replan_task_unavailable/);
    assert.equal((await planState(db)).status, 'active');
    assert.equal((await db.query(`select count(*)::int as n from strategic_plans`)).rows[0].n, 1);
    assert.equal((await db.query(`select status::text as status from tasks where id='${retiredTask}'`)).rows[0].status, 'pending');
    assert.equal((await db.query(`select status from agent_outputs where id='${output}'`)).rows[0].status, 'pending_approval');
  } finally { await db.close(); }
});

test('una tarea abierta sin decidir impide aplicar', async () => {
  const db = await setup();
  try {
    await assert.rejects(apply(db, await fingerprint(db), tree([kept]), []), /replan_open_tasks_unreconciled/);
    assert.equal((await planState(db)).status, 'active');
  } finally { await db.close(); }
});

test('T14/T20: una propuesta aplicada no se aplica dos veces', async () => {
  const db = await setup();
  try {
    const print = await fingerprint(db);
    await apply(db, print, tree([kept, fresh]));
    await assert.rejects(apply(db, print, tree([kept, fresh])), /camino_replan_plan_closed/);
    assert.equal((await db.query(`select count(*)::int as n from strategic_plans`)).rows[0].n, 2);
  } finally { await db.close(); }
});

test('un borrador se replanifica sin activarse', async () => {
  const db = await setup();
  try {
    await db.exec(`update strategic_plans set status='draft' where id='${plan}'`);
    const { rows } = await apply(db, await fingerprint(db), tree([kept, fresh]));
    assert.equal(rows[0].result.status, 'draft');
    assert.equal(rows[0].result.activated_at, null);
  } finally { await db.close(); }
});
