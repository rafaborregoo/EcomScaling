import assert from "node:assert/strict";
import test from "node:test";
import { summarizeCaminoOperations } from "./camino-operating-summary";

test("prioriza los vencimientos próximos y cuenta la carga recurrente sin inventar capacidad", () => {
  const summary = summarizeCaminoOperations([{ milestones: [{
    name: "Campaña lista",
    target_offset_days: 20,
    tasks: [
      { title: "Revisar inversión", target_offset_days: 2, priority: "high", owner: "consultant", effort_hours: 1, cadence: "semanal" },
      { title: "Confirmar stock", target_offset_days: 2, priority: "urgent", owner: "client", effort_hours: 2 },
      { title: "Preparar creatividad", target_offset_days: 10, priority: "medium", effort_hours: null },
      { title: "Cerrar campaña", target_offset_days: 19, priority: "high", effort_hours: 3 },
    ],
  }] }], 14);
  assert.deepEqual(summary.next.map((task) => task.title), ["Confirmar stock", "Revisar inversión", "Preparar creatividad"]);
  assert.equal(summary.scheduledOccurrences, 4);
  assert.equal(summary.estimatedHours, 4);
  assert.equal(summary.withoutEstimate, 1);
  assert.equal(summary.capacityKnown, false);
});
