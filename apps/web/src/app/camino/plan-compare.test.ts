import assert from "node:assert/strict";
import test from "node:test";
import { comparePlans, shapeOfPlan, shapeOfProposal } from "./plan-compare";

test("separa hitos que se mantienen, nuevos y retirados sin distinguir mayusculas", () => {
  const current = shapeOfPlan([
    { strategic_plan_milestones: [{ name: "Medir base", milestone_task_links: [{}, {}] }, { name: "Lanzar flujo", milestone_task_links: [{}] }] },
  ]);
  const proposed = shapeOfProposal([
    { milestones: [{ name: "medir  base", tasks: [{}] }] },
    { milestones: [{ name: "Revisar margen", tasks: [{}, {}] }] },
  ]);
  const result = comparePlans(current, proposed);
  assert.deepEqual(result.kept, ["medir  base"]);
  assert.deepEqual(result.added, ["Revisar margen"]);
  assert.deepEqual(result.removed, ["Lanzar flujo"]);
  assert.equal(result.current.tasks, 3);
  assert.equal(result.proposed.tasks, 3);
  assert.equal(result.proposed.phases, 2);
});
