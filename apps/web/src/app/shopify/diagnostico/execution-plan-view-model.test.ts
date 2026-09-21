import { test } from "node:test";
import assert from "node:assert/strict";
import { executionPlanTone, executionPlanViewModel } from "./execution-plan-view-model";
test("F8.03 pinta plan y conserva el estado de seguridad", () => { const model = executionPlanViewModel({ plan_status: "READY_WITH_APPROVAL", ordered_action_ids: ["action-1", "action-2"], critical_path: ["action-1", "action-2"], blockers: [] }); assert.equal(model.actions.length, 2); assert.equal(executionPlanTone(model.status), "warn"); });
