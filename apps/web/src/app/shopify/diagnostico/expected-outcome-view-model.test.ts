import assert from "node:assert/strict";
import test from "node:test";
import { expectedOutcomeTone, expectedOutcomeViewModel } from "./expected-outcome-view-model";

test("preserva la tesis causal y separa outcome de criterio", () => {
  const model = expectedOutcomeViewModel({
    disposition: "OUTCOME_CRITERIA_AVAILABLE",
    scope: "campaign-1",
    result: { causal_thesis: "If we improve the offer because friction is high, we expect conversion to improve.", business_outcome: ["Conversion improves"], primary_success_criterion: "Conversion improves without margin damage", guardrails: ["Margin stable"], scale_criterion: "Scale only if repeatable", execution_authorized: false },
  });
  assert.equal(model.causalThesis.startsWith("If we improve"), true);
  assert.deepEqual(model.businessOutcome, ["Conversion improves"]);
  assert.equal(model.primarySuccessCriterion, "Conversion improves without margin damage");
  assert.deepEqual(model.guardrails, ["Margin stable"]);
  assert.equal(model.executionAuthorized, false);
  assert.equal(expectedOutcomeTone(model.disposition), "success");
});

test("un contexto incompleto queda visible como validación", () => {
  const model = expectedOutcomeViewModel({ disposition: "VALIDATION_REQUIRED", unresolved_unknowns: ["current_baseline"], result: { causal_thesis: "No construir una expectativa todavía." } });
  assert.equal(model.disposition, "VALIDATION_REQUIRED");
  assert.deepEqual(model.unknowns, ["current_baseline"]);
  assert.equal(expectedOutcomeTone(model.disposition), "warn");
});
