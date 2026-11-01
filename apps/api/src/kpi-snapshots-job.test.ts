import assert from "node:assert/strict";
import test from "node:test";
import { lastClosedWeek } from "./kpi-snapshots-job.js";

test("la semana cerrada es la anterior, de lunes a domingo", () => {
  // Miércoles 21-oct-2026 -> semana 12 a 18 oct.
  assert.deepEqual(lastClosedWeek(new Date("2026-10-21T10:00:00Z")), { start: "2026-10-12", end: "2026-10-18" });
  // Lunes: cierra la semana que acaba de terminar.
  assert.deepEqual(lastClosedWeek(new Date("2026-10-19T07:00:00Z")), { start: "2026-10-12", end: "2026-10-18" });
  // Domingo: la semana en curso aún no está cerrada.
  assert.deepEqual(lastClosedWeek(new Date("2026-10-18T23:00:00Z")), { start: "2026-10-05", end: "2026-10-11" });
});
