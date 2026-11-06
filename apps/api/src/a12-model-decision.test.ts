import test from "node:test";
import assert from "node:assert/strict";
import { A12_MODEL_DECISION, A13_MODEL_DECISION, A14_MODEL_DECISION, A15_MODEL_DECISION, A19_MODEL_DECISION, getAgentModelDecision } from "@e-nora/contracts";
import { defaultAgentModel, resolveAgentModel, DESIGN_RUNS_PER_DAY } from "./agent-schedule.js";
test("A12 uses the audited platform model regardless of client or stale admin preference", () => {
  assert.equal(getAgentModelDecision("a12_analista_email"), A12_MODEL_DECISION);
  assert.equal(defaultAgentModel("a12_analista_email", "claude-opus-5"), "gpt-6.1-sol");
  assert.equal(resolveAgentModel({ agentCode: "a12_analista_email", versionModel: "claude-opus-5", clientModel: "gpt-6-luna", platformModel: "claude-haiku-5-5" }), "gpt-6.1-sol");
  assert.equal(A12_MODEL_DECISION.fallbackModel, "claude-sonnet-5-5");
  assert.equal(DESIGN_RUNS_PER_DAY.a12_analista_email!.runs, 2);
});
test("A13 fixed Sol policy and Terra model fallback match runtime selection", () => {
  assert.equal(getAgentModelDecision("a13_operativa_shopify"), A13_MODEL_DECISION);
  assert.equal(resolveAgentModel({ agentCode: "a13_operativa_shopify", versionModel: "claude-sonnet-5", clientModel: "gpt-6-luna", platformModel: "claude-opus-5" }), "gpt-6.1-sol");
  assert.equal(A13_MODEL_DECISION.fallbackModel, "gpt-6.1-terra");
});
test("A14 shares one store reading and fixes the audited diagnosis model", () => {
  assert.equal(getAgentModelDecision("a14_operativa_meta"), A14_MODEL_DECISION);
  assert.equal(resolveAgentModel({ agentCode: "a14_operativa_meta", versionModel: "claude-sonnet-5", clientModel: "gpt-6-luna", platformModel: "claude-opus-5" }), "gpt-6.1-sol");
  assert.equal(A14_MODEL_DECISION.status, "closed");
  assert.equal(A14_MODEL_DECISION.fallbackModel, "gpt-6.1-terra");
  assert.equal(DESIGN_RUNS_PER_DAY.a14_operativa_meta!.runs, 1);
});
test("A15 uses Terra with Sol fallback regardless of stale overrides", () => {
  assert.equal(getAgentModelDecision("a15_analista_imagenes"), A15_MODEL_DECISION);
  assert.equal(resolveAgentModel({ agentCode: "a15_analista_imagenes", versionModel: "claude-sonnet-5", clientModel: "gpt-6-luna", platformModel: "claude-opus-5" }), "gpt-6.1-terra");
  assert.equal(A15_MODEL_DECISION.fallbackModel, "gpt-6.1-sol");
  assert.equal(DESIGN_RUNS_PER_DAY.a15_analista_imagenes!.scheduled, false);
});

test("A19 usa Opus con Sol de respaldo y deja tiempo para un Camino entero", () => {
  assert.equal(getAgentModelDecision("a19_arquitecto_camino"), A19_MODEL_DECISION);
  assert.equal(A19_MODEL_DECISION.model, "claude-opus-5-5");
  assert.equal(A19_MODEL_DECISION.fallbackModel, "gpt-6.1-sol");
  assert.ok(A19_MODEL_DECISION.resilience.timeoutMs >= 30 * 60_000);
});
