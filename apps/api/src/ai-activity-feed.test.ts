/**
 * Feed de actividad compartido (migracion 20261113100000): los triggers
 * alimentan `activity_events` y `recent_activity_feed` es lo que ven todos
 * los agentes. Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY
 * y la migracion aplicada. Ejecutar con `npm run test:remote -w @e-nora/api`.
 */
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@e-nora/config";

const env = loadApiEnv(process.env);
const admin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const RUN_TAG = `${Date.now()}`;
let orgId = "";

async function feed() {
  const { data, error } = await admin.rpc("recent_activity_feed", {
    target_organization_id: orgId,
  });
  assert.equal(error, null);
  return (data ?? []) as Array<{ event_type: string; summary: string }>;
}

before(async () => {
  const { data: org, error } = await admin
    .from("organizations")
    .insert({
      display_name: `Feed Test ${RUN_TAG}`,
      slug: `feed-test-${RUN_TAG}`,
      status: "active",
    })
    .select("id")
    .single();
  if (error || !org) throw new Error(`org de prueba: ${error?.message}`);
  orgId = org.id;
});

after(async () => {
  await admin.from("organizations").delete().eq("id", orgId);
});

test("una tarea completada aparece una sola vez en el feed", async () => {
  const { data: task } = await admin
    .from("tasks")
    .insert({
      organization_id: orgId,
      title: "Revisar margen bruto",
      source: "manual",
      status: "pending",
    })
    .select("id")
    .single();
  assert.deepEqual(await feed(), [], "una tarea abierta no es actividad");

  await admin
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", task!.id);
  await admin
    .from("tasks")
    .update({ title: "Revisar margen bruto (editada)" })
    .eq("id", task!.id);

  const rows = await feed();
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.event_type, "tasks.completed");
  assert.match(rows[0]!.summary, /Revisar margen bruto/);
});

test("corregir un cambio de contexto no deja la version vieja", async () => {
  const { data: event } = await admin
    .from("context_change_events")
    .insert({
      organization_id: orgId,
      event_type: "promotion",
      description: "Rebajas de otono 20%",
      occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  await admin
    .from("context_change_events")
    .update({ event_type: "price_change" })
    .eq("id", event!.id);

  const types = (await feed()).map((row) => row.event_type);
  assert.ok(types.includes("context.price_change"));
  assert.ok(!types.includes("context.promotion"));

  await admin.from("context_change_events").delete().eq("id", event!.id);
  assert.ok(
    !(await feed()).some((row) => row.event_type.startsWith("context.")),
  );
});
