import assert from "node:assert/strict";
import test from "node:test";
import { kindLabel, sentLabel } from "./email-model";

test("kindLabel", () => {
  assert.equal(kindLabel("flow"), "Flujo");
  assert.equal(kindLabel("campaign"), "Campaña");
});

test("sentLabel de un flujo usa el disparador", () => {
  assert.equal(sentLabel({ kind: "flow", send_time: null, trigger_type: "Se suscribe a la lista" }), "Se dispara: Se suscribe a la lista");
  assert.equal(sentLabel({ kind: "flow", send_time: null, trigger_type: null }), "Flujo activo");
});

test("sentLabel de una campana usa la fecha de envio", () => {
  assert.equal(sentLabel({ kind: "campaign", send_time: null, trigger_type: null }), "Sin enviar");
  assert.match(sentLabel({ kind: "campaign", send_time: "2026-09-18T10:00:00Z", trigger_type: null }), /2026/);
});
