/**
 * R-008/RB-008: bug real encontrado 2026-07-22 limpiando datos de test --
 * `purgeExpiredDeletions` (el hard-delete real tras el periodo de gracia del
 * soft-delete) fallaba en silencio para cualquier organizacion con
 * configuracion financiera (`organization_financial_settings`/
 * `fixed_expenses`/`shipping_cost_rules`/`organization_metric_targets`): el
 * trigger de auditoria de esas tablas (`private.log_financial_change`)
 * intentaba insertar en `audit_logs` referenciando una organizacion que ya
 * no existia dentro de la misma cascada de borrado, violando la FK. El
 * `DELETE` completo de la organizacion fallaba, y el error se tragaba sin
 * loguear ni contar (`if (deleteError) { continue; }`).
 *
 * Este test crea una organizacion con configuracion financiera real, la
 * marca como pendiente de purga con `scheduled_purge_at` en el pasado, y
 * confirma que `purgeExpiredDeletions` la borra de verdad (no solo que no
 * lance una excepcion).
 *
 * Requiere .env.local con SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY. Ejecutar
 * con `npm run test -w @ecomscaling/api`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { loadApiEnv } from "@ecomscaling/config";
import { purgeExpiredDeletions } from "./consultant.js";

const env = loadApiEnv(process.env);

const admin = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

const RUN_TAG = `${Date.now()}`;

test("una organizacion con configuracion financiera se purga de verdad tras el periodo de gracia", async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `Purge Test Org ${RUN_TAG}`,
      slug: `purge-test-org-${RUN_TAG}`,
      status: "pending_deletion",
      scheduled_purge_at: new Date(Date.now() - 60_000).toISOString(),
    })
    .select("id")
    .single();
  assert.equal(orgError, null);
  const orgId = org!.id;

  const { error: financialError } = await admin
    .from("organization_financial_settings")
    .insert({
      organization_id: orgId,
      currency_code: "EUR",
      payment_fee_pct: 2.5,
    });
  assert.equal(financialError, null);

  const { error: expenseError } = await admin
    .from("fixed_expenses")
    .insert({ organization_id: orgId, name: "Gasto de prueba", amount: 100 });
  assert.equal(expenseError, null);

  try {
    const result = await purgeExpiredDeletions(env);
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(
        result.data.failedOrganizationIds.includes(orgId),
        false,
        "la organizacion con configuracion financiera no deberia fallar al purgarse",
      );
    }

    const { data: stillExists } = await admin
      .from("organizations")
      .select("id")
      .eq("id", orgId)
      .maybeSingle();
    assert.equal(
      stillExists,
      null,
      "la organizacion deberia haberse borrado fisicamente",
    );
  } finally {
    // Por si el test falla antes de que purgeExpiredDeletions la borre, no
    // dejar el residuo (mismo mecanismo que el bug -- ya corregido, pero
    // este cleanup no depende de ello).
    await admin.from("organizations").delete().eq("id", orgId);
  }
});

test("una organizacion pendiente no se purga antes de scheduled_purge_at", async () => {
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      display_name: `Purge Grace Test Org ${RUN_TAG}`,
      slug: `purge-grace-test-org-${RUN_TAG}`,
      status: "pending_deletion",
      scheduled_purge_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    .select("id")
    .single();
  assert.equal(orgError, null);
  const orgId = org!.id;

  try {
    const result = await purgeExpiredDeletions(env);
    assert.equal(result.ok, true);

    const { data: stillExists, error: lookupError } = await admin
      .from("organizations")
      .select("id, status, scheduled_purge_at")
      .eq("id", orgId)
      .maybeSingle();
    assert.equal(lookupError, null);
    assert.deepEqual(stillExists, {
      id: orgId,
      status: "pending_deletion",
      scheduled_purge_at: stillExists?.scheduled_purge_at,
    });
  } finally {
    await admin.from("organizations").delete().eq("id", orgId);
  }
});
