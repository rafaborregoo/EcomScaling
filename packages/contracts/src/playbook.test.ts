import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePlaybookFramework,
  fingerprintPlaybookInput,
  type PlaybookFrameworkInputLike,
} from "./playbook.js";

const baseContext = {
  context_id: "ctx-1",
  decision_cycle_id: "cycle-1",
  business_id: "org-1",
  priority_ref: "priority-1",
  objective_ref: "objective-1",
  problem_refs: ["problem-1"],
  diagnosis_refs: ["diagnosis-1"],
  evidence_refs: ["evidence-1"],
  facts: {
    "tracking.reliable": "TRUE",
    "inventory.sufficient": "TRUE",
  } as const,
  source_versions: ["p12.v1", "d12.v1"],
  as_of: "2026-09-17T10:00:00.000Z",
};

const baseTemplate = {
  template_id: "PB-001",
  template_version: "1.0.0",
  schema_version: "p5.0.v1",
  lifecycle: "ACTIVE" as const,
  name: "Validation intervention",
  purpose: "Validate the diagnosed problem with a bounded intervention",
  problem_refs: ["problem-1"],
  intent: "isolate-and-validate",
  intervention_type: "VALIDATION",
  activation_signals: ["diagnosis-1"],
  preconditions: [
    {
      condition_id: "pre-tracking",
      condition_type: "HARD_PRECONDITION" as const,
      fact_ref: "tracking.reliable",
      expected: "TRUE" as const,
      unknown_policy: "REQUIRE_VALIDATION" as const,
      reason_code: "PRECONDITION.TRACKING_REQUIRED",
    },
  ],
  contraindications: [
    {
      condition_id: "contra-stock",
      condition_type: "CONTEXT_CONDITION" as const,
      fact_ref: "inventory.sufficient",
      expected: "FALSE" as const,
      unknown_policy: "REQUIRE_VALIDATION" as const,
      reason_code: "CONTRAINDICATION.STOCK",
    },
  ],
  steps: [
    {
      step_id: "PB-001-S01",
      label: "Define the smallest validation intervention",
      stage: "ISOLATE" as const,
      adaptation_policy: "LOCKED" as const,
    },
    {
      step_id: "PB-001-S02",
      label: "Observe the declared validation metrics",
      stage: "VALIDATE" as const,
      adaptation_policy: "PARAMETERIZABLE" as const,
    },
  ],
  expected_effects: ["REDUCE_DIAGNOSTIC_UNCERTAINTY"],
  validation_requirements: ["validation metric is observable"],
  success_criteria: ["problem response is compatible with the hypothesis"],
  failure_criteria: ["expected effect does not materialize"],
  stop_conditions: ["downside exceeds declared limit"],
  reassessment_conditions: ["diagnosis is contradicted"],
  resource_requirements: ["owner", "analytics"],
  dependencies: ["priority-1"],
  intervention_risks: ["limited exposure"],
  adaptation_policy: {
    default: "LOCKED" as const,
    allow_new_steps: false,
  },
  source_refs: ["catalog:PB-001"],
};

function input(overrides: Partial<PlaybookFrameworkInputLike> = {}): PlaybookFrameworkInputLike {
  return {
    context: baseContext,
    templates: [baseTemplate],
    evaluated_at: "2026-09-17T10:00:00.000Z",
    ...overrides,
  };
}

test("5.00 selecciona una instancia solo cuando contexto y condiciones pasan", () => {
  const result = evaluatePlaybookFramework(input());

  assert.equal(result.disposition, "READY_FOR_RECOMMENDATION");
  assert.equal(result.selected_instance?.playbook_id, "PB-001");
  assert.equal(result.selected_instance?.playbook_version, "1.0.0");
  assert.deepEqual(result.selected_instance?.resolved_steps.map((step) => step.step_id), [
    "PB-001-S01",
    "PB-001-S02",
  ]);
  assert.deepEqual(result.selected_instance?.adaptations, []);
  assert.equal(result.selected_instance?.priority_ref, "priority-1");
});

test("5.00 no convierte UNKNOWN de una precondición dura en TRUE", () => {
  const result = evaluatePlaybookFramework(input({
    context: { ...baseContext, facts: { "inventory.sufficient": "TRUE" } },
  }));

  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.equal(result.selected_instance, null);
  assert.equal(result.candidate_evaluations[0]?.applicability, "REQUIRES_VALIDATION");
  assert.ok(result.unresolved_unknowns.includes("tracking.reliable"));
});

test("5.00 una contraindicación positiva bloquea la selección", () => {
  const result = evaluatePlaybookFramework(input({
    context: {
      ...baseContext,
      facts: { "tracking.reliable": "TRUE", "inventory.sufficient": "FALSE" },
    },
  }));

  assert.equal(result.disposition, "BLOCKED");
  assert.equal(result.selected_instance, null);
  assert.equal(result.candidate_evaluations[0]?.applicability, "CONTRAINDICATED");
});

test("5.00 no inventa un playbook cuando el catálogo está vacío", () => {
  const result = evaluatePlaybookFramework(input({ templates: [] }));

  assert.equal(result.disposition, "NO_APPLICABLE_PLAYBOOK");
  assert.equal(result.selected_instance, null);
  assert.deepEqual(result.candidate_evaluations, []);
  assert.ok(result.reason_codes.includes("CATALOG.EMPTY"));
});

test("5.00 no selecciona templates que no están activos", () => {
  const result = evaluatePlaybookFramework(input({
    templates: [{ ...baseTemplate, lifecycle: "DEPRECATED" as const }],
  }));

  assert.equal(result.disposition, "NO_APPLICABLE_PLAYBOOK");
  assert.equal(result.candidate_evaluations[0]?.applicability, "NOT_APPLICABLE");
});

test("5.00 la huella ignora el timestamp de evaluación", () => {
  const first = fingerprintPlaybookInput(input({ evaluated_at: "2026-09-17T10:00:00.000Z" }));
  const second = fingerprintPlaybookInput(input({ evaluated_at: "2026-09-17T11:00:00.000Z" }));

  assert.equal(first, second);
});
