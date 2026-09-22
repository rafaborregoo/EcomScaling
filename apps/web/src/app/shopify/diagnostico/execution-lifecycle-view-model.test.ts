import assert from "node:assert/strict";
import test from "node:test";
import { executionLifecycleViewModel } from "./execution-lifecycle-view-model.js";

test("una incoherencia de lifecycle se muestra como peligro y se separa arriba", () => {
  const model = executionLifecycleViewModel([
    { intervention_id: "int-1", state: "CLOSED", inconsistencies: ["CLOSED con 2 acciones activas."] },
    { intervention_id: "int-2", state: "RUNNING" },
  ]);
  assert.equal(model.total, 2);
  assert.equal(model.inconsistent.length, 1);
  assert.equal(model.inconsistent[0].tone, "danger");
});

test("lo que espera a una persona se separa de lo que avanza solo", () => {
  const model = executionLifecycleViewModel([
    { intervention_id: "int-1", state: "WAITING_APPROVAL" },
    { intervention_id: "int-2", state: "BLOCKED" },
    { intervention_id: "int-3", state: "RUNNING" },
  ]);
  assert.deepEqual(
    model.waitingOnHuman.map((row) => row.interventionId),
    ["int-1", "int-2"],
  );
});

test("solo se marca como escribiendo lo que el backend autorizo", () => {
  const model = executionLifecycleViewModel([
    { intervention_id: "int-1", state: "RUNNING", material_write_allowed: true },
    { intervention_id: "int-2", state: "RUNNING" },
  ]);
  assert.deepEqual(model.writing.map((row) => row.interventionId), ["int-1"]);
});

test("sin datos no inventa filas", () => {
  assert.equal(executionLifecycleViewModel(null).total, 0);
  assert.equal(executionLifecycleViewModel([]).total, 0);
});

test("un estado sin explicacion lo dice, no lo deja en blanco", () => {
  const model = executionLifecycleViewModel([{ intervention_id: "int-1", state: "RUNNING" }]);
  assert.match(model.rows[0].why, /Sin explicacion/);
});
