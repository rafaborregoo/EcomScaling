import { test } from "node:test";
import assert from "node:assert/strict";
import { actionEnvelopeViewModel } from "./action-envelope-view-model";
test("muestra la zona, límites restantes y necesidad de expansión", () => { const model = actionEnvelopeViewModel({ envelope_zone: "OUTSIDE", result: { violations: ["a1:scope_outside"], remaining_capacity: { actions: 0 }, scope_expansion_required: true } }); assert.equal(model.zone, "OUTSIDE"); assert.equal(model.expansion, true); assert.deepEqual(model.violations, ["a1:scope_outside"]); });
