import assert from "node:assert/strict";
import test from "node:test";
import { scheduledDeletionLabel } from "./scheduled-deletion.js";

const NOW = new Date("2026-11-04T12:00:00Z");

test("dice los días que quedan y la fecha", () => {
  assert.equal(
    scheduledDeletionLabel("2026-11-16T12:00:00Z", NOW),
    "Se borra en 12 días (16 de noviembre)",
  );
  assert.equal(
    scheduledDeletionLabel("2026-11-05T11:00:00Z", NOW),
    "Se borra en 1 día (5 de noviembre)",
  );
});

test("una fecha vencida no se anuncia como plazo", () => {
  assert.equal(scheduledDeletionLabel("2026-10-29T09:27:23Z", NOW), "Se borra esta noche");
});

test("sin fecha legible no inventa un plazo", () => {
  assert.equal(scheduledDeletionLabel(null, NOW), "Borrado pendiente");
  assert.equal(scheduledDeletionLabel("no-es-fecha", NOW), "Borrado pendiente");
});
