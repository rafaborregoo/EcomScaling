import assert from "node:assert/strict";
import test from "node:test";
import { milestonesInMonth } from "./monthly-route-model";

test("reparte los hitos en la ventana mensual del Camino", () => {
  const milestones = [
    { name: "Bases", date: "2026-10-16" },
    { name: "Black Friday preparado", date: "2026-11-13" },
    { name: "Navidad lista", date: "2026-12-10" },
    { name: "Sin fecha", date: null },
  ];
  assert.deepEqual(milestonesInMonth("2026-10-06", 1, milestones).map((m) => m.name), ["Bases"]);
  assert.deepEqual(milestonesInMonth("2026-10-06", 2, milestones).map((m) => m.name), ["Black Friday preparado"]);
  assert.deepEqual(milestonesInMonth("2026-10-06", 3, milestones).map((m) => m.name), ["Navidad lista"]);
});

test("el mes empieza en el calendario, incluso si el Camino arranca a mitad de mes", () => {
  assert.deepEqual(milestonesInMonth("2026-10-31", 1, [{ name: "Octubre", date: "2026-10-07" }, { name: "Noviembre", date: "2026-11-01" }]).map((m) => m.name), ["Octubre"]);
  assert.deepEqual(milestonesInMonth("2026-10-31", 2, [{ name: "Noviembre", date: "2026-11-01" }]).map((m) => m.name), ["Noviembre"]);
});
