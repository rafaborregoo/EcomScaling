import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { connectionNeedsReconnect, RECONNECT_ERROR_PATTERN } from "./connection-reconnect.js";

test("solo el permiso caído pide reconectar; un fallo de sync no", () => {
  const needs = (status: string, last_error_message: string | null) =>
    connectionNeedsReconnect({ status, last_error_message });

  assert.equal(needs("revoked", null), true);
  assert.equal(needs("error", "meta_reauth_required: el token de Meta ha caducado."), true);
  assert.equal(needs("error", "meta_token_expired_reauth_required"), true);
  assert.equal(needs("error", "shopify_reauth_required: Shopify rechazó el permiso guardado. Reconecta la tienda."), true);
  assert.equal(needs("error", "klaviyo_token_refresh_failed_400: invalid_grant"), true);

  assert.equal(needs("error", "meta_sync_partial_failure"), false);
  assert.equal(needs("error", "klaviyo_rate_limited"), false);
  assert.equal(needs("error", "shopify_token_refresh_failed_503"), false);
  assert.equal(needs("connected", "meta_reauth_required"), false);
});

test("el trigger de avisos usa el mismo patrón", () => {
  // La última versión del trigger (ADR-0028 lo pasó al outbox del motor).
  const sql = readFileSync(
    new URL("../../../supabase/migrations/20270102090000_avisos_integracion_por_el_motor.sql", import.meta.url),
    "utf8",
  );
  assert.ok(sql.includes(`'${RECONNECT_ERROR_PATTERN}'`), "copia el patrón tal cual en la migración");
});
