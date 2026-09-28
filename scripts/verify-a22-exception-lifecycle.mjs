import pg from "pg";
import { randomUUID } from "node:crypto";

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query("begin");
  const selected = await client.query(`
    select id, organization_id, store_id
    from public.shopify_fulfillments
    limit 1
  `);
  let f = selected.rows[0] ?? null;
  if (!f) {
    const store = await client.query(`select id, organization_id from public.shopify_stores limit 1`);
    if (!store.rowCount) {
      console.log(JSON.stringify({ verified: false, reason: "no_store_fixture_in_test" }));
    } else {
      const order = await client.query(`insert into public.shopify_order_facts (organization_id,store_id,external_order_id,external_created_at) values ($1,$2,$3,now()) returning id`, [store.rows[0].organization_id, store.rows[0].id, `a22-test-order-${randomUUID()}`]);
      const fulfillment = await client.query(`insert into public.shopify_fulfillments (organization_id,store_id,order_id,external_fulfillment_id,external_created_at,external_updated_at,estimated_delivery_at) values ($1,$2,$3,$4,now(),now(),now()-interval '2 hours') returning id,organization_id,store_id`, [store.rows[0].organization_id, store.rows[0].id, order.rows[0].id, `a22-test-fulfillment-${randomUUID()}`]);
      f = fulfillment.rows[0];
    }
  }
  if (f) {
    const eventId = `a22-lifecycle-check-${randomUUID()}`;
    await client.query(`update public.shopify_fulfillments set delivered_at = null, estimated_delivery_at = now() - interval '2 hours' where id=$1`, [f.id]);
    await client.query(`select public.refresh_shopify_delivery_exception($1,$2,$3)`, [f.organization_id, f.store_id, f.id]);
    await client.query(`select public.refresh_shopify_delivery_exception($1,$2,$3)`, [f.organization_id, f.store_id, f.id]);
    const eta = await client.query(`select count(*)::int as n from public.shopify_delivery_exceptions where fulfillment_id=$1 and exception_type='eta_overdue' and status='open'`, [f.id]);

    await client.query(`update public.shopify_fulfillments set estimated_delivery_at = null where id=$1`, [f.id]);
    await client.query(`insert into public.shopify_fulfillment_event_sync_state (fulfillment_id, organization_id, store_id, status, last_external_updated_at) values ($1,$2,$3,'complete',now()) on conflict (fulfillment_id) do update set status='complete'`, [f.id, f.organization_id, f.store_id]);
    await client.query(`insert into public.shopify_fulfillment_events (organization_id,store_id,fulfillment_id,external_event_id,status,happened_at,reason_code,reason_confidence) values ($1,$2,$3,$4,'DELAYED',now(),'carrier_delay',0.99)`, [f.organization_id, f.store_id, f.id, eventId]);
    await client.query(`select public.refresh_shopify_delivery_exception($1,$2,$3)`, [f.organization_id, f.store_id, f.id]);
    await client.query(`select public.refresh_shopify_delivery_exception($1,$2,$3)`, [f.organization_id, f.store_id, f.id]);
    const opened = await client.query(`select count(*)::int as n from public.shopify_delivery_exceptions where fulfillment_id=$1 and exception_type='carrier_delay' and status='open'`, [f.id]);
    await client.query(`update public.shopify_fulfillment_event_sync_state set status='partial' where fulfillment_id=$1`, [f.id]);
    await client.query(`select public.refresh_shopify_delivery_exception($1,$2,$3)`, [f.organization_id, f.store_id, f.id]);
    const preserved = await client.query(`select count(*)::int as n from public.shopify_delivery_exceptions where fulfillment_id=$1 and exception_type='carrier_delay' and status='open'`, [f.id]);
    await client.query(`update public.shopify_fulfillments set delivered_at=now() where id=$1`, [f.id]);
    await client.query(`update public.shopify_fulfillment_event_sync_state set status='failed' where fulfillment_id=$1`, [f.id]);
    await client.query(`select public.refresh_shopify_delivery_exception($1,$2,$3)`, [f.organization_id, f.store_id, f.id]);
    const resolved = await client.query(`select count(*)::int as n from public.shopify_delivery_exceptions where fulfillment_id=$1 and exception_type='carrier_delay' and status='resolved'`, [f.id]);
    console.log(JSON.stringify({ verified: true, eta_deduped: eta.rows[0].n === 1, event_deduped: opened.rows[0].n === 1, partial_sync_preserves_open: preserved.rows[0].n === 1, confirmed_delivery_resolves_without_events_scope: resolved.rows[0].n === 1 }));
  }
} finally {
  await client.query("rollback");
  await client.end();
}
