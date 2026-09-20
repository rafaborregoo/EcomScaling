import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateMaturityRecommendation,
  evaluateMaturityRecommendationSet,
  type MaturityRecommendationInput,
} from "./maturity-recommendations.js";

const base = (over: Partial<MaturityRecommendationInput> = {}): MaturityRecommendationInput => ({
  candidate_id: "candidate:checkout@1",
  selected_intervention: "Instalar personalización avanzada",
  business_stage: "mature",
  functional_maturity: "defined",
  intervention_readiness: "READY",
  existing_capabilities: ["reliable measurement"],
  missing_capabilities: [],
  evidence: ["internal history"],
  risk: ["blast radius bounded"],
  resource_constraints: ["team capacity"],
  current_mode: "optimization",
  current_bottleneck: "marginal efficiency",
  local_reset: false,
  absorption_capacity: "ADVANCED",
  candidate_complexity: "ADVANCED",
  focus_capacity: "several parallel workstreams",
  organization_complexity: [],
  current_debt: [],
  current_recommendation: "Aplicar personalización avanzada en el segmento validado",
  deferred_recommendation: "Extender a todos los segmentos",
  not_yet_reason: "",
  capability_to_build: "",
  maturity_unlock: ["incrementality learning"],
  unresolved_unknowns: [],
  evidence_refs: ["evidence:internal-history"],
  source_refs: ["source:f7-p10"],
  ...over,
});

test("F7.10 adapta la recomendación al contexto maduro sin autorizar ejecución", () => {
  const result = evaluateMaturityRecommendation(base());

  assert.equal(result.timing_fit, "NOW");
  assert.equal(result.recommended_mode, "OPTIMIZE_ALLOCATION");
  assert.equal(result.complexity_decision, "APPROPRIATE");
  assert.equal(result.execution_authorized, false);
  assert.equal(result.deterministic, true);
});

test("F7.10 devuelve construir capability primero cuando falta un prerequisite", () => {
  const result = evaluateMaturityRecommendation(
    base({
      intervention_readiness: "NOT_READY",
      missing_capabilities: ["reliable customer identity"],
      capability_to_build: "Construir identidad de cliente fiable",
      current_recommendation: "Crear cohortes fiables",
      deferred_recommendation: "Optimizar LTV predictivo",
    }),
  );

  assert.equal(result.recommended_mode, "BUILD_CAPABILITY_FIRST");
  assert.equal(result.timing_fit, "LATER");
  assert.equal(result.current_recommendation, "Construir identidad de cliente fiable");
  assert.match(result.not_yet_reason ?? "", /reliable customer identity/);
  assert.ok(result.maturity_unlock.includes("incrementality learning"));
});

test("F7.10 trata un reset local como aprendizaje aunque el negocio sea maduro", () => {
  const result = evaluateMaturityRecommendation(
    base({ local_reset: true, current_mode: "optimization" }),
  );

  assert.equal(result.recommended_mode, "LEARN_VALIDATE");
  assert.equal(result.timing_fit, "NOW");
  assert.ok(result.rationale.includes("MATURITY.LOCAL_RESET_REQUIRES_LEARNING"));
});

test("F7.10 reduce sofisticación prematura cuando la capacidad de absorción es baja", () => {
  const result = evaluateMaturityRecommendation(
    base({
      business_stage: "validation",
      functional_maturity: "ad_hoc",
      intervention_readiness: "PARTIAL",
      absorption_capacity: "LIMITED",
      candidate_complexity: "ADVANCED",
      current_mode: "learning",
      current_recommendation: "Mejorar la medición básica",
      deferred_recommendation: "Instalar personalización avanzada",
    }),
  );

  assert.equal(result.recommended_mode, "SIMPLIFY");
  assert.equal(result.complexity_decision, "TOO_COMPLEX");
  assert.equal(result.current_recommendation, "Mejorar la medición básica");
  assert.equal(result.timing_fit, "LATER");
});

test("F7.10 no completa una recomendación con contexto desconocido", () => {
  const result = evaluateMaturityRecommendation(
    base({ intervention_readiness: "UNKNOWN", unresolved_unknowns: ["functional_maturity"] }),
  );

  assert.equal(result.timing_fit, "VALIDATION_REQUIRED");
  assert.equal(result.recommended_mode, "VALIDATE_CONTEXT");
  assert.ok(result.unresolved_unknowns.includes("intervention_readiness"));
});

test("F7.10 conserva candidatos y estado de validación en el conjunto", () => {
  const result = evaluateMaturityRecommendationSet({
    context_id: "ctx:maturity",
    business_id: "org-1",
    decision_cycle_id: "cycle-1",
    primary_priority_candidate_id: "candidate:checkout@1",
    candidates: [base(), base({ candidate_id: "candidate:ads@1", intervention_readiness: "UNKNOWN" })],
    evaluated_at: "2026-09-20T00:00:00.000Z",
  });

  assert.equal(result.disposition, "MATURITY_RECOMMENDATIONS_AVAILABLE");
  assert.equal(result.candidate_evaluations.length, 2);
  assert.equal(result.execution_authorized, false);
});
