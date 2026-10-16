import assert from "node:assert/strict";
import test from "node:test";
import { inviteCodeState, sanitizeClientDefaults } from "./consultora-settings.js";

test("ajustes de partida: números válidos y permisos conocidos, lo demás fuera", () => {
  assert.deepEqual(
    sanitizeClientDefaults({ payment_fee_pct: "2.9", payment_fee_fixed: 0.3, default_shipping_cost: "", consultant_permissions: { marketing_publish: true, raro: true } }),
    { payment_fee_pct: 2.9, payment_fee_fixed: 0.3, consultant_permissions: { marketing_publish: true } },
  );
  assert.equal(sanitizeClientDefaults({ payment_fee_pct: 140 }), null);
  assert.equal(sanitizeClientDefaults({ payment_fee_fixed: -1 }), null);
  assert.equal(sanitizeClientDefaults("x"), null);
});

test("un código pendiente que ya pasó su fecha se ve caducado", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  assert.equal(inviteCodeState({ status: "pending", expires_at: "2026-10-11T00:00:00Z" }, now), "expired");
  assert.equal(inviteCodeState({ status: "pending", expires_at: "2026-10-20T00:00:00Z" }, now), "pending");
  assert.equal(inviteCodeState({ status: "redeemed", expires_at: "2026-10-11T00:00:00Z" }, now), "redeemed");
});
