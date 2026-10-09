import assert from "node:assert/strict";
import test from "node:test";
import { assessMilestoneCompletion } from "./camino-milestone-readiness.js";

test("el hito exige tareas terminadas y evidencia concreta", () => {
  const links = [{ task_id: "1", tasks: { title: "Validar stock", status: "pending" } }];
  assert.deepEqual(assessMilestoneCompletion(links, "Se ha validado el stock con el inventario de hoy." ).unfinished, ["Validar stock"]);
  assert.equal(assessMilestoneCompletion([{ task_id: "1", tasks: { title: "Validar stock", status: "completed" } }], "Listo").ready, false);
  assert.equal(assessMilestoneCompletion([{ task_id: "1", tasks: { title: "Validar stock", status: "completed" } }], "Stock comprobado en Shopify el 7 de octubre.").ready, true);
});
