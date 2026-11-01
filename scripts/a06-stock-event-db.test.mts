import assert from "node:assert/strict";
import pg from "pg";
const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString || connectionString.includes("cthjwpeygpzwdmjkxeqa"))
  throw new Error("Development database required");
const db = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
await db.connect();
const passed: string[] = [];
try {
  await db.query("begin");
  const {
    rows: [fixture],
  } =
    await db.query(`select s.id, s.organization_id, p.store_id, s.available_quantity
    from public.shopify_inventory_current_state s
    join public.shopify_inventory_items i on i.id=s.inventory_item_id and i.tracked
    join public.shopify_variants v on v.id=i.variant_id and v.is_active
    join public.shopify_products p on p.id=v.product_id and p.status='ACTIVE'
    join public.shopify_stores st on st.id=p.store_id and st.is_active limit 1`);
  assert.ok(fixture, "A synced development inventory fixture is required");
  await db.query(
    `insert into public.a06_stock_event_settings(store_id, organization_id, mode) values ($1,$2,'shadow')
    on conflict(store_id) do update set mode='shadow'`,
    [fixture.store_id, fixture.organization_id],
  );
  await db.query(
    `update public.shopify_inventory_current_state set available_quantity=30, updated_at=now() where id=$1`,
    [fixture.id],
  );
  await db.query(`delete from public.a06_stock_event_queue where store_id=$1`, [
    fixture.store_id,
  ]);
  await db.query(
    `update public.shopify_inventory_current_state set available_quantity=20, updated_at=now() where id=$1`,
    [fixture.id],
  );
  await db.query(
    `update public.shopify_inventory_current_state set available_quantity=10, updated_at=now() where id=$1`,
    [fixture.id],
  );
  const {
    rows: [queued],
  } = await db.query(
    `select * from public.a06_stock_event_queue where store_id=$1`,
    [fixture.store_id],
  );
  assert.equal(Number(queued.revision), 2);
  assert.equal(queued.changes[fixture.id].previous_quantity, 30);
  assert.equal(queued.changes[fixture.id].available_quantity, 10);
  passed.push("Agrupa 30→20→10 y conserva la cantidad inicial");
  await db.query(
    `update public.a06_stock_event_queue set due_at=now()-interval '1 second' where store_id=$1`,
    [fixture.store_id],
  );
  const {
    rows: [claimed],
  } = await db.query(
    `select * from public.claim_a06_stock_events(20) where store_id=$1`,
    [fixture.store_id],
  );
  assert.ok(claimed?.lease_token);
  const { rows: repeated } = await db.query(
    `select * from public.claim_a06_stock_events(20) where store_id=$1`,
    [fixture.store_id],
  );
  assert.equal(repeated.length, 0);
  passed.push("Una reserva activa impide una segunda ejecución");
  await db.query(
    `update public.shopify_inventory_current_state set available_quantity=3, updated_at=now() where id=$1`,
    [fixture.id],
  );
  const finish = await db.query(
    `select public.finish_a06_stock_event($1,$2,$3,null,'test-signal',true) as done`,
    [fixture.store_id, claimed.lease_token, claimed.revision],
  );
  assert.equal(finish.rows[0].done, true);
  const {
    rows: [after],
  } = await db.query(
    `select * from public.a06_stock_event_queue where store_id=$1`,
    [fixture.store_id],
  );
  assert.equal(Number(after.processed_revision), 2);
  assert.equal(Number(after.revision), 3);
  assert.equal(after.changes[fixture.id].available_quantity, 3);
  assert.ok(after.due_at);
  passed.push(
    "Un cambio durante el análisis queda pendiente y no se borra al terminar",
  );
  const staleFinish = await db.query(
    `select public.finish_a06_stock_event($1,$2,$3) as done`,
    [fixture.store_id, claimed.lease_token, 3],
  );
  assert.equal(staleFinish.rows[0].done, false);
  passed.push("Una reserva anterior no puede confirmar cambios nuevos");
  await db.query(
    `update public.a06_stock_event_settings set mode='off' where store_id=$1`,
    [fixture.store_id],
  );
  await db.query(
    `update public.shopify_inventory_current_state set available_quantity=2, updated_at=now() where id=$1`,
    [fixture.id],
  );
  const {
    rows: [off],
  } = await db.query(
    `select revision from public.a06_stock_event_queue where store_id=$1`,
    [fixture.store_id],
  );
  assert.equal(Number(off.revision), 3);
  passed.push("Una tienda desactivada no genera eventos del piloto");
  await db.query("savepoint scope_test");
  await assert.rejects(
    db.query(
      `update public.a06_stock_event_settings set organization_id=gen_random_uuid() where store_id=$1`,
      [fixture.store_id],
    ),
    /a06_event_store_scope_mismatch/,
  );
  await db.query("rollback to savepoint scope_test");
  passed.push("La configuración no admite mezclar tienda y organización");
  await db.query("savepoint role_test");
  await db.query("set local role authenticated");
  await assert.rejects(
    db.query("select * from public.a06_stock_event_settings"),
    /permission denied/,
  );
  await db.query("rollback to savepoint role_test");
  passed.push("Los clientes no acceden a la configuración privilegiada");
  const { rows: acl } =
    await db.query(`select has_function_privilege('anon','public.claim_a06_stock_events(integer,uuid)','execute') as anon,
    has_function_privilege('authenticated','public.claim_a06_stock_events(integer,uuid)','execute') as client,
    has_function_privilege('service_role','public.claim_a06_stock_events(integer,uuid)','execute') as backend`);
  assert.deepEqual(acl[0], { anon: false, client: false, backend: true });
  passed.push("Solo backend puede reservar trabajos");
  console.log(
    JSON.stringify(
      { passed: passed.length, checks: passed, fixture_changes: "rolled_back" },
      null,
      2,
    ),
  );
} finally {
  await db.query("rollback");
  await db.end();
}
