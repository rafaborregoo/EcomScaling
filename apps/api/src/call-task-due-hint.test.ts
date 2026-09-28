import assert from "node:assert/strict";
import test from "node:test";
import { explicitCallTaskDueAt } from "./call-task-due-hint.js";

test("solo convierte fechas ISO completas y válidas", () => {
  assert.equal(
    explicitCallTaskDueAt("2026-10-15"),
    "2026-10-15T12:00:00.000Z",
  );
  assert.equal(explicitCallTaskDueAt("2026-02-30"), null);
});

test("conserva como texto los plazos relativos o ambiguos", () => {
  assert.equal(explicitCallTaskDueAt("para el viernes"), null);
  assert.equal(explicitCallTaskDueAt("antes de la próxima llamada"), null);
  assert.equal(explicitCallTaskDueAt(null), null);
});
