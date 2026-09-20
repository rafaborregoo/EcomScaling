import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRecommendationPortfolio,
  type RecommendationPortfolioCandidateInput,
  type RecommendationPortfolioInput,
} from "./recommendation-portfolio.js";

const candidate = (over: Partial<RecommendationPortfolioCandidateInput> = {}): RecommendationPortfolioCandidateInput => ({
  candidate_id: "acquisition@1",
  intervention: "Reasignar adquisición al canal validado",
  desired_role: "PRIMARY",
  status: "ACTIVE_OPTION",
  horizon: "NOW",
  problem: "Economía de adquisición deteriorada",
  expected_outcome: "Proteger contribución",
  causal_mechanism: "Mejorar eficiencia del canal con evidencia",
  priority_context: "Prioridad dominante",
  entry_reason: "Ataca el bottleneck actual",
  deferral_reason: "",
  reentry_trigger: "",
  dependencies: [],
  shared_resources: ["paid_media"],
  evidence_status: "STRONG",
  individual_feasibility: "FEASIBLE_WITH_ADAPTATION",
  individual_risk: "CONTAINED",
  reversibility: "REVERSIBLE",
  conflict_with: [],
  supports_candidate_ids: [],
  enables_candidate_ids: [],
  duplicate_of: "",
  explicit_exclusion: false,
  source_refs: ["f7-p11:candidate"],
  ...over,
});

const base = (over: Partial<RecommendationPortfolioInput> = {}): RecommendationPortfolioInput => ({
  context_id: "portfolio-context",
  business_id: "org-a",
  decision_cycle_id: "cycle-a",
  strategic_objective: "Proteger la economía y recuperar crecimiento",
  dominant_priority: "acquisition@1",
  candidates: [candidate()],
  existing_initiatives: [],
  current_portfolio: [],
  current_wip: "one active initiative",
  available_capacity: "sufficient for a focused portfolio",
  shared_resources: ["paid_media"],
  management_attention: "focused",
  aggregate_capacity: "FEASIBLE",
  resource_conflicts: [],
  portfolio_constraints: [],
  strategic_theme: "protect economics",
  current_portfolio_complexity: "LOW",
  current_risk_state: "CONTAINED",
  evidence_quality: "SUPPORTED",
  timing_context: "NOW",
  source_refs: ["f7-p12:test"],
  unresolved_unknowns: [],
  ...over,
});

test("F7.12 creates a focused portfolio with primary, supporting and deferred roles", () => {
  const result = evaluateRecommendationPortfolio(base({
    candidates: [
      candidate({ candidate_id: "acquisition@1" }),
      candidate({ candidate_id: "tracking@1", intervention: "Corregir tracking mínimo", desired_role: "ENABLING", status: "ACTIVE_OPTION", horizon: "NOW", entry_reason: "Desbloquea la primary", enables_candidate_ids: ["acquisition@1"], shared_resources: ["analytics"] }),
      candidate({ candidate_id: "creative@1", intervention: "Mejorar throughput creativo", desired_role: "SUPPORTING", status: "ACTIVE_OPTION", horizon: "NOW", entry_reason: "Aumenta la eficacia de la primary", supports_candidate_ids: ["acquisition@1"], shared_resources: ["creative"] }),
      candidate({ candidate_id: "retention@1", intervention: "Segmentación predictiva", desired_role: "DEFERRED", status: "VALID_OPTION", horizon: "LATER", entry_reason: "Oportunidad válida futura", deferral_reason: "Falta capacidad y evidencia", reentry_trigger: "Capacidad analítica disponible", shared_resources: ["analytics"] }),
    ],
  }));
  assert.equal(result.disposition, "PORTFOLIO_AVAILABLE");
  assert.equal(result.primary_candidate_id, "acquisition@1");
  assert.deepEqual(result.active_candidate_ids, ["acquisition@1", "tracking@1", "creative@1"]);
  assert.deepEqual(result.deferred_candidate_ids, ["retention@1"]);
  assert.match(result.portfolio_narrative, /primary/i);
  assert.equal(result.execution_authorized, false);
});

test("F7.12 excludes duplicate and explicitly excluded recommendations", () => {
  const result = evaluateRecommendationPortfolio(base({
    candidates: [
      candidate(),
      candidate({ candidate_id: "same-mechanism@1", intervention: "Otra etiqueta para reasignación", desired_role: "SUPPORTING", duplicate_of: "acquisition@1", explicit_exclusion: false }),
      candidate({ candidate_id: "trend@1", intervention: "Añadir canal por moda", desired_role: "PARALLEL", explicit_exclusion: true, entry_reason: "No hay encaje causal" }),
    ],
  }));
  assert.equal(result.disposition, "PORTFOLIO_AVAILABLE");
  assert.ok(result.excluded_candidate_ids.includes("same-mechanism@1"));
  assert.ok(result.excluded_candidate_ids.includes("trend@1"));
  assert.ok(result.explicit_exclusions.some((item) => item.includes("same-mechanism@1")));
});

test("F7.12 does not run conflicting interventions together", () => {
  const result = evaluateRecommendationPortfolio(base({
    candidates: [
      candidate(),
      candidate({ candidate_id: "pricing@1", intervention: "Cambiar pricing", desired_role: "PARALLEL", status: "ACTIVE_OPTION", conflict_with: ["acquisition@1"], shared_resources: ["commercial"] }),
    ],
    resource_conflicts: ["acquisition@1|pricing@1"],
  }));
  assert.equal(result.disposition, "PORTFOLIO_AVAILABLE");
  assert.ok(result.deferred_candidate_ids.includes("pricing@1"));
  assert.match(result.sequence.join(" "), /pricing@1/);
  assert.ok(result.quality_flags.includes("INTERFERENCE_REQUIRES_SEQUENCE"));
});

test("F7.12 requires validation when the primary or aggregate capacity is unknown", () => {
  const result = evaluateRecommendationPortfolio(base({ dominant_priority: "missing@1", aggregate_capacity: "UNKNOWN" }));
  assert.equal(result.disposition, "VALIDATION_REQUIRED");
  assert.equal(result.primary_candidate_id, null);
  assert.ok(result.unresolved_unknowns.length > 0);
});

test("F7.12 rejects an empty candidate set without inventing a portfolio", () => {
  const result = evaluateRecommendationPortfolio(base({ candidates: [] }));
  assert.equal(result.disposition, "NO_PORTFOLIO_CANDIDATES");
  assert.deepEqual(result.active_candidate_ids, []);
  assert.equal(result.execution_authorized, false);
});
