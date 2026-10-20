import assert from "node:assert/strict";
import test from "node:test";
import { describeObjectiveChange } from "./camino-objective-changes.js";
import { withGoalTarget } from "./strategic-plans.js";

test("cambiar la meta mueve solo el objetivo mensual que la llevaba", () => {
  const goal = {
    target: 30000,
    monthly_targets: [
      { month: 1, target_value: 20000 },
      { month: 2, target_value: 30000 },
      { month: 3, target_value: 25000 },
    ],
  };
  const updated = withGoalTarget(goal, 40000);
  assert.equal(updated.target, 40000);
  assert.deepEqual(
    (updated.monthly_targets as Array<{ target_value: number }>).map((m) => m.target_value),
    [20000, 40000, 25000],
  );
});

test("sin mes que lleve la meta cambia el último; sin meses solo la meta", () => {
  const updated = withGoalTarget({ target: null, monthly_targets: [{ month: 1, target_value: 10 }, { month: 2, target_value: 12 }] }, 15);
  assert.deepEqual((updated.monthly_targets as Array<{ target_value: number }>).map((m) => m.target_value), [10, 15]);
  assert.deepEqual(withGoalTarget({ target: 5 }, 8), { target: 8 });
});

test("el aviso dice qué cambió en lenguaje del cliente", () => {
  assert.equal(
    describeObjectiveChange({ action: "updated", metricLabel: "Margen neto", unit: "pct", period: "monthly", previousValue: 20, newValue: 25 }),
    "«Margen neto»: 20 % → 25 % al mes",
  );
  assert.equal(
    describeObjectiveChange({ action: "removed", metricLabel: "Pedidos", unit: "count", period: "monthly", previousValue: 300, newValue: null }),
    "«Pedidos» (era 300 al mes)",
  );
});
