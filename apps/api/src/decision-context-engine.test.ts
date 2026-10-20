import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionContext } from "@e-nora/contracts";
import { caminoObjectives, fallbackInput, withCaminoObjectives } from "./decision-context-engine.js";

const NOW = "2026-10-19T10:00:00.000Z";
const storePlan = {
  id: "plan-store",
  name: "Camino tienda",
  store_id: "store-1",
  horizon_months: 6,
  goal: { metric_key: "net_profit", metric_label: "Beneficio neto", unit: "money", currency_code: "EUR", target: 6000, target_date: "2027-04-01", rationale: "Recuperar margen" },
};

test("la meta del Camino es el objetivo principal del contexto de decisión", () => {
  const input = withCaminoObjectives(fallbackInput("org-1", NOW, [], null, []), caminoObjectives([storePlan]));
  const result = buildDecisionContext(input);
  assert.equal(result.primary_objective?.objective_id, "strategic_plan:plan-store");
  assert.equal(result.primary_objective?.kind, "GOAL");
  assert.match(result.primary_objective?.statement ?? "", /Beneficio neto: llegar a 6000 EUR para el 2027-04-01/);
  assert.equal(result.time_horizon, "2027-04-01");
  assert.ok(!result.reason_codes.includes("OBJECTIVE.MISSING_REQUIRED"));
  assert.ok(!result.unresolved_unknowns.includes("objective_context"));
});

test("manda el Camino de la organización; los de tienda y lo declarado a mano quedan secundarios", () => {
  const orgPlan = { ...storePlan, id: "plan-org", store_id: null, goal: { metric_label: "Ingresos", target: null } };
  const declared = {
    ...fallbackInput("org-1", NOW, [], null, []),
    primary_objective: { objective_id: "declared-1", kind: "GOAL" as const, statement: "Crecer", source: "DECLARED" as const },
  };
  const input = withCaminoObjectives(declared, caminoObjectives([storePlan, orgPlan]));
  assert.equal(input.primary_objective?.objective_id, "strategic_plan:plan-org");
  assert.deepEqual(input.secondary_objectives?.map((o) => o.objective_id), ["strategic_plan:plan-store", "declared-1"]);
});

test("sin Camino con meta no se inventa objetivo", () => {
  const input = withCaminoObjectives(fallbackInput("org-1", NOW, [], null, []), caminoObjectives([{ ...storePlan, goal: null }]));
  assert.equal(buildDecisionContext(input).primary_objective, null);
});
