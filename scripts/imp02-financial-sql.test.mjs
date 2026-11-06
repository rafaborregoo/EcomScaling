import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const container = 'supabase_db_E-NORA';
const database = `enora_imp02_test_${randomBytes(6).toString('hex')}`;
let created = false;
const org = '10000000-0000-4000-8000-000000000001';
const otherOrg = '10000000-0000-4000-8000-000000000002';
const store = '20000000-0000-4000-8000-000000000001';
const otherStore = '20000000-0000-4000-8000-000000000002';
const connection = '30000000-0000-4000-8000-000000000001';
const order = '40000000-0000-4000-8000-000000000001';
const variant = '50000000-0000-4000-8000-000000000001';
const inventory = '60000000-0000-4000-8000-000000000001';
const start = '2026-10-01T00:00:00Z';
const end = '2026-10-31T23:59:59.999Z';
const args = `'${org}','${start}','${end}','${store}'`;
const run = (db, sql) => {
  if (db !== database && db !== 'postgres') throw new Error('Invalid test database target');
  return execFileSync('docker', ['exec','-i',container,'psql','-X','-U','postgres','-d',db,'-v','ON_ERROR_STOP=1','-Atq'], { input: sql, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
};
const query = (sql) => JSON.parse(run(database, `begin; ${seed} ${sql} rollback;`).trim());
const seed = `
insert into public.integration_connections values('${connection}','${org}','shopify','connected','2026-11-02T11:00:00Z',null);
insert into public.shopify_stores values('${store}','${org}','${connection}','EUR',true);
insert into public.organization_financial_settings values('${org}',0,0,0,'EUR');
insert into public.shopify_order_facts(id,organization_id,store_id,currency_code,processed_at,external_updated_at,current_total_price,total_before_returns,current_total_tax,refunds,customer_reference_hash)
 values('${order}','${org}','${store}','EUR','2026-10-15T12:00:00Z','2026-10-16T12:00:00Z',60,120,10,60,'synthetic_customer');
insert into public.shopify_order_items values('70000000-0000-4000-8000-000000000001','${org}','${order}','${variant}',1,50,'shopify_graphql_exact');
insert into public.shopify_inventory_items values('${inventory}','${org}','${store}','${variant}',99);
insert into public.product_costs values('80000000-0000-4000-8000-000000000001','${org}','${inventory}',20,'EUR','2026-01-01',null);
`;

before(() => {
  if (process.env.RUN_LOCAL_FINANCIAL_SQL_TESTS !== '1') throw new Error('Set RUN_LOCAL_FINANCIAL_SQL_TESTS=1 to run isolated local SQL fixtures.');
  const endpoint = execFileSync('docker',['context','inspect','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8'}).trim();
  if (!/^(npipe:\/\/|unix:\/\/)/.test(endpoint)) throw new Error('Only a local Docker context is permitted.');
  assert.match(database, /^enora_imp02_test_[0-9a-f]{12}$/);
  run('postgres', `create database "${database}" template template0;`);
  created = true;
  const extract = (filename, name) => {
    const source = readFileSync(filename, 'utf8');
    const offset = source.indexOf(`create function public.${name}(`);
    assert.ok(offset >= 0);
    return source.slice(offset, source.indexOf('$$;', offset) + 3);
  };
  const schema = readFileSync('scripts/fixtures/imp02-financial-schema.sql','utf8');
  const baseFinancial = 'supabase/migrations/20260929093000_panel_motor_financiero_real.sql';
  run(database, schema + extract(baseFinancial,'ads_spend_summary')
    + extract('supabase/migrations/20261116000000_shopify_order_item_net_metrics.sql','shopify_margin_summary')
    + extract(baseFinancial,'shopify_financial_summary'));
  const migration = readFileSync('supabase/migrations/20270115120000_imp02_financial_comparability.sql','utf8');
  run(database, migration);
  run(database, migration); // Reapplication must not change the contract or fail.
  run(database, `create trigger shopify_order_facts_net_sales before insert or update on public.shopify_order_facts for each row execute function private.shopify_order_facts_net_sales(); grant select on all tables in schema public to service_role;`);
});

after(() => {
  if (!created) return;
  assert.match(database, /^enora_imp02_test_[0-9a-f]{12}$/);
  run('postgres', `drop database "${database}";`);
});

test('partial refunds and remaining tax are subtracted exactly once', () => {
  const result = query(`select row_to_json(f) from public.shopify_financial_summary(${args}) f;`);
  assert.equal(result.net_sales, 60);
  assert.equal(result.net_revenue_ex_tax, 50);
  assert.equal(result.cogs, 20);
  assert.equal(result.net_profit, 30);
  assert.equal(result.breakeven_roas, 1.67);
});

test('dated costs take precedence; missing/zero/current costs retain separate coverage and affected amounts', () => {
  assert.equal(query(`select public.shopify_financial_coverage(${args});`).items_with_estimated_cost, 0);
  const zero = query(`update public.product_costs set unit_cost=0; select row_to_json(f) from public.shopify_financial_summary(${args}) f;`);
  assert.equal(zero.cogs, 0);
  assert.equal(zero.net_profit, 50);
  const estimated = query(`delete from public.product_costs; select public.shopify_financial_coverage(${args});`);
  assert.equal(estimated.items_with_estimated_cost, 1);
  assert.equal(estimated.revenue_by_currency[0].revenue_with_estimated_cost, 50);
  const missing = query(`delete from public.product_costs; update public.shopify_inventory_items set current_unit_cost=null; select public.shopify_financial_coverage(${args});`);
  assert.equal(missing.items_without_cost, 1);
  assert.equal(missing.revenue_by_currency[0].revenue_without_cost, 50);
});

test('unverified historical totals, missing lines and estimated line metrics remain explicit', () => {
  assert.equal(query(`update public.shopify_order_facts set total_before_returns=null; select public.shopify_financial_coverage(${args});`).orders_without_verified_totals, 1);
  assert.equal(query(`delete from public.shopify_order_items; select public.shopify_financial_coverage(${args});`).orders_without_lines, 1);
  assert.equal(query(`update public.shopify_order_items set net_metrics_source='shopify_rest_estimate'; select public.shopify_financial_coverage(${args});`).lines_with_estimated_metrics, 1);
  assert.equal(query(`update public.shopify_order_items set net_quantity=null; select public.shopify_financial_coverage(${args});`).lines_without_metrics, 1);
});

test('a refund newer than the complete order snapshot prevents a verified financial conclusion', () => {
  const result = query(`insert into public.shopify_refunds values(gen_random_uuid(),'${org}','${store}','${order}','2026-10-17T00:00:00Z',60); select public.shopify_financial_coverage(${args});`);
  assert.equal(result.orders_pending_refund_snapshot, 1);
  assert.equal(query(`insert into public.shopify_refunds values(gen_random_uuid(),'${org}','${store}','${order}','2026-10-15T00:00:00Z',60); select public.shopify_financial_coverage(${args});`).orders_pending_refund_snapshot, 0);
});

test('cost currency follows the applied dated cost, not another store or a future price', () => {
  const result = query(`insert into public.product_costs values(gen_random_uuid(),'${org}','${inventory}',1000,'USD','2027-01-01',null); select public.shopify_financial_coverage(${args});`);
  assert.ok(result.currencies.some((row) => row.source==='product_costs' && row.code==='EUR'));
  assert.ok(!result.currencies.some((row) => row.code==='USD'));
  assert.ok(query(`update public.product_costs set currency_code='USD'; select public.shopify_financial_coverage(${args});`).currencies.some((row) => row.code==='USD'));
});

test('spend and currency include historical deselected accounts actually charged in the window', () => {
  const result = query(`insert into public.meta_ad_accounts values('90000000-0000-4000-8000-000000000001','${org}','${store}',null,'USD',false,false); insert into public.meta_insight_rows_daily values(gen_random_uuid(),'${org}','90000000-0000-4000-8000-000000000001','2026-10-15','ad','none',10); select public.shopify_financial_coverage(${args});`);
  assert.ok(result.currencies.some((row) => row.source==='ads' && row.code==='USD'));
  assert.equal(result.ads_connections.length, 1);
});

test('fixed costs cover an inclusive final day and the monthly denominator uses the report date', () => {
  const result = query(`insert into public.fixed_expenses values(gen_random_uuid(),'${org}',true,304.4,'monthly','2026-10-31','2026-10-31','EUR'); select row_to_json(f) from public.shopify_financial_summary(${args}) f;`);
  assert.equal(result.fixed_costs, 10);
  assert.equal(result.monthly_fixed_costs, 304.4);
  assert.equal(result.net_profit, 20);
});

test('periods exclude the next UTC day and do not combine another tenant/store', () => {
  const result = query(`insert into public.shopify_stores values('${otherStore}','${otherOrg}',null,'USD',true); insert into public.shopify_order_facts(id,organization_id,store_id,processed_at,current_total_price,total_before_returns,current_total_tax,refunds) values(gen_random_uuid(),'${otherOrg}','${otherStore}','2026-10-15',100000,100000,0,0),(gen_random_uuid(),'${org}','${store}','2026-11-01T00:00:00Z',9000,9000,0,0); select row_to_json(f) from public.shopify_financial_summary(${args}) f;`);
  assert.equal(result.orders_count, 1);
  assert.equal(result.net_sales, 60);
});

test('the canonical four-order reference reconciles taxes, fees, shipping, fixed costs and Meta spend to the cent', () => {
  const result = query(`
    delete from public.shopify_order_items; delete from public.shopify_order_facts;
    update public.organization_financial_settings set payment_fee_pct=2.5,payment_fee_fixed=0.3,default_shipping_cost=5;
    update public.product_costs set unit_cost=60;
    insert into public.shopify_order_facts(id,organization_id,store_id,customer_reference_hash,currency_code,processed_at,external_updated_at,current_total_price,total_before_returns,current_total_tax,current_shipping_price)
      select md5('order'||s)::uuid,'${org}','${store}',case when s<3 then 'A' else s::text end,'EUR','2026-10-15','2026-10-16',250,250,40,10 from generate_series(1,4) s;
    insert into public.shopify_order_items select md5('item'||s)::uuid,'${org}',md5('order'||s)::uuid,'${variant}',1,200,'shopify_graphql_exact' from generate_series(1,4) s;
    insert into public.fixed_expenses values(gen_random_uuid(),'${org}',true,304.4,'monthly','2026-10-01',null,'EUR');
    insert into public.meta_ad_accounts values('90000000-0000-4000-8000-000000000001','${org}','${store}',null,'EUR',true,true);
    insert into public.meta_insight_rows_daily values(gen_random_uuid(),'${org}','90000000-0000-4000-8000-000000000001','2026-10-15','ad','none',100);
    select row_to_json(f) from public.shopify_financial_summary(${args}) f;
  `);
  assert.equal(result.net_sales,1000);
  assert.equal(result.net_revenue_ex_tax,840);
  assert.equal(result.cogs,240);
  assert.equal(result.payment_fees,26.2);
  assert.equal(result.shipping_costs,20);
  assert.equal(result.fixed_costs,310);
  assert.equal(result.ads_spend,100);
  assert.equal(result.net_profit,143.8);
  assert.equal(result.new_customers,3);
  assert.equal(result.cac_blended,33.33);
  assert.equal(result.break_even_monthly_revenue,461.71);
  assert.equal(result.mbee,35.95);
  assert.equal(result.breakeven_roas,3.45);
});

test('net line discounts are not subtracted a second time and unmapped bundle lines do not acquire invented costs', () => {
  const result = query(`update public.shopify_order_facts set total_before_returns=96,current_total_price=96,refunds=0,current_total_tax=16; update public.shopify_order_items set net_revenue=80; select row_to_json(m) from public.shopify_margin_summary(${args}) m;`);
  assert.equal(result.revenue,80);
  assert.equal(result.gross_margin,60);
  const bundle = query(`update public.shopify_order_items set variant_id=null; select public.shopify_financial_coverage(${args});`);
  assert.equal(bundle.items_without_cost,1);
  assert.equal(bundle.revenue_by_currency[0].revenue_without_cost,50);
});

test('missing monetary amounts stay null and a return/refund mismatch is explicit', () => {
  const result = query(`update public.shopify_order_items set net_revenue=null; delete from public.product_costs; update public.shopify_inventory_items set current_unit_cost=null; select public.shopify_financial_coverage(${args});`);
  assert.equal(result.revenue_by_currency[0].line_revenue,null);
  assert.equal(result.revenue_by_currency[0].revenue_without_cost,null);
  assert.equal(query(`update public.shopify_order_facts set current_total_price=0; select public.shopify_financial_coverage(${args});`).orders_with_inconsistent_totals,1);
});

test('zero denominators never generate a fictitious CAC or infinite break-even', () => {
  const result = query(`delete from public.shopify_order_items; delete from public.shopify_order_facts; select row_to_json(f) from public.shopify_financial_summary(${args}) f;`);
  assert.equal(result.orders_count,0);
  assert.equal(result.net_profit,0);
  assert.equal(result.cac_blended,null);
  assert.equal(result.breakeven_roas,null);
});

test('canonical financial reads respect caller RLS and service reads do not use another tenant cost row', () => {
  const tables = ['shopify_stores','integration_connections','shopify_order_facts','shopify_order_items','shopify_inventory_items','product_costs','organization_financial_settings','shipping_cost_rules','fixed_expenses','meta_ad_accounts','meta_insight_rows_daily','shopify_refunds'];
  const policies = tables.map((table) => `alter table public.${table} enable row level security; create policy imp02_fixture_scope on public.${table} for select to authenticated using(organization_id::text=current_setting('imp02.fixture_org',true));`).join('\n');
  const foreign = `insert into public.shopify_stores values('${otherStore}','${otherOrg}',null,'USD',true);`;
  const result = query(`${foreign} ${policies} grant select on all tables in schema public to authenticated; set local role authenticated; set local imp02.fixture_org='${org}'; select row_to_json(f) from public.shopify_financial_summary(${args}) f;`);
  assert.equal(result.orders_count,1);
  const foreignResult = query(`${foreign} ${policies} grant select on all tables in schema public to authenticated; set local role authenticated; set local imp02.fixture_org='${org}'; select row_to_json(f) from public.shopify_financial_summary('${otherOrg}','${start}','${end}','${otherStore}') f;`);
  assert.equal(foreignResult.orders_count,0);
  assert.equal(foreignResult.net_sales,0);
  const guarded = query(`insert into public.product_costs values(gen_random_uuid(),'${otherOrg}','${inventory}',99999,'USD','2026-10-01',null); insert into public.shopify_order_items values(gen_random_uuid(),'${otherOrg}','${order}','${variant}',100,10000,'shopify_graphql_exact'); select row_to_json(f) from public.shopify_financial_summary(${args}) f;`);
  assert.equal(guarded.cogs,20);
});

test('coverage is a service-only invoker and rejects a foreign store', () => {
  const acl = JSON.parse(run(database, `select json_build_object('anon',has_function_privilege('anon','public.shopify_financial_coverage(uuid,timestamptz,timestamptz,uuid)','execute'),'authenticated',has_function_privilege('authenticated','public.shopify_financial_coverage(uuid,timestamptz,timestamptz,uuid)','execute'),'service',has_function_privilege('service_role','public.shopify_financial_coverage(uuid,timestamptz,timestamptz,uuid)','execute'),'definer',(select prosecdef from pg_proc where oid='public.shopify_financial_coverage(uuid,timestamptz,timestamptz,uuid)'::regprocedure));`));
  assert.deepEqual(acl,{anon:false,authenticated:false,service:true,definer:false});
  assert.throws(() => query(`select public.shopify_financial_coverage('${org}','${start}','${end}','${otherStore}');`), /invalid_financial_coverage_scope_or_window/);
});
