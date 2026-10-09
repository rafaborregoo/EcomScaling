import assert from "node:assert/strict";
import { test } from "node:test";
import { occurrenceTitle, recurrenceDates } from "./camino-recurrence.js";

test("una rutina semanal se repite hasta la fecha del hito, con la propia como primera", () => {
  assert.deepEqual(recurrenceDates("2026-10-12", "semanal", "2026-11-02"), ["2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02"]);
});

test("una vez, sin cadencia o sin fecha de hito no se expande", () => {
  assert.deepEqual(recurrenceDates("2026-10-12", "una_vez", "2026-11-30"), ["2026-10-12"]);
  assert.deepEqual(recurrenceDates("2026-10-12", null, "2026-11-30"), ["2026-10-12"]);
  assert.deepEqual(recurrenceDates("2026-10-12", "semanal", null), ["2026-10-12"]);
  assert.deepEqual(recurrenceDates(null, "semanal", "2026-11-30"), []);
});

test("llega hasta el hito aunque sean muchas semanas, con un tope de defensa", () => {
  assert.equal(recurrenceDates("2026-10-05", "semanal", "2027-01-04").length, 14);
  assert.equal(recurrenceDates("2026-01-05", "semanal", "2029-12-31").length, 60);
});

test("el titulo numera solo si hay varias", () => {
  assert.equal(occurrenceTitle("Revisar ROAS", 1, 4), "Revisar ROAS (2/4)");
  assert.equal(occurrenceTitle("Revisar ROAS", 0, 1), "Revisar ROAS");
});
