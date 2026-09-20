import assert from "node:assert/strict";
import test from "node:test";
import { recommendationCommunicationViewModel } from "./recommendation-communication-view-model";
test("presenta la decisión antes de la explicación y conserva la incertidumbre", () => { const model = recommendationCommunicationViewModel({ disposition: "COMMUNICATION_AVAILABLE", scope: "checkout", primary_recommendation: "Fix checkout", result: { reason: "Bottleneck", why_now: "Active", main_uncertainty: "scope", fact_evidence: ["Observed"] } }); assert.equal(model.recommendation, "Fix checkout"); assert.equal(model.mainUncertainty, "scope"); assert.deepEqual(model.factEvidence, ["Observed"]); });
test("sin evaluación no inventa recomendación", () => { const model = recommendationCommunicationViewModel(null); assert.equal(model.recommendation, "No declarado"); assert.equal(model.disposition, "SIN_EVALUACION"); });
