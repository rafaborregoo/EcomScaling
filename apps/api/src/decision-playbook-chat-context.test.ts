import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDecisionPlaybookContextBlocks,
  loadDecisionPlaybookContextBlocks,
  summarizeDecisionOutput,
  summarizeDiagnosticOutput,
  summarizeDiagnosticRobustness,
  summarizeInterventionEligibilityRun,
  summarizeInterventionMatchingRun,
  summarizeInterventionPrioritizationRun,
  summarizeInterventionImpactRun,
  summarizeInterventionFeasibilityRun,
  summarizeInterventionRiskRun,
  summarizeInterventionSequencingRun,
  summarizeInterventionTestExecuteRun,
  summarizeInterventionIntensityRun,
  summarizeMaturityRecommendationRun,
  summarizeConstraintRecommendationRun,
  summarizeRecommendationPortfolioRun,
  summarizeDynamicDecisionRun,
  summarizeRestraintDecisionRun,
  summarizeExpectedOutcomeRun,
  summarizeRecommendationConfidenceRun,
  summarizeRecommendationCommunicationRun,
  summarizePlaybookRun,
  summarizeTemporalDiagnosis,
} from "./decision-playbook-chat-context.js";

test("el Copiloto conserva binding constraint y accion factible sin asignar recursos", () => {
  const summary = summarizeConstraintRecommendationRun({ disposition: "CONSTRAINT_RECOMMENDATIONS_AVAILABLE", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "scale@1", binding_constraint: "cash", recommended_mode: "REDUCE_SCOPE", feasibility_disposition: "FEASIBLE_WITH_ADAPTATION", best_feasible_recommendation: "Prueba pequeña", deferred_action: "Escalar después", next_constraint_to_monitor: "fulfillment", unresolved_unknowns: [], rationale: [] }] } });
  assert.equal(summary.execution_authorized, false);
  assert.match(JSON.stringify(summary), /binding constraint|cash/);
  assert.match(String(summary.selection), /no asigna recursos/);
});

test("F7.12 entrega cartera, roles y diferidos sin optimizar ni autorizar ejecucion", () => {
  const summary = summarizeRecommendationPortfolioRun({ disposition: "PORTFOLIO_AVAILABLE", candidate_count: 2, primary_candidate_id: "fix@1", result: { strategic_objective: "Recover conversion", dominant_priority: "fix@1", portfolio_feasibility: "FEASIBLE_WITH_DEFERRED", portfolio_risk: "STACKING_REVIEW_REQUIRED", portfolio_narrative: "Primary visible; second action deferred.", candidate_evaluations: [{ candidate_id: "fix@1", role: "PRIMARY", selection_status: "ACTIVE", sequence_position: "FIRST", role_reason: "dominant" }, { candidate_id: "scale@1", role: "DEFERRED", selection_status: "DEFERRED", sequence_position: "LATER", role_reason: "shared resource" }] } });
  assert.equal(summary.execution_authorized, false);
  assert.match(JSON.stringify(summary), /PRIMARY/);
  assert.match(JSON.stringify(summary), /FEASIBLE_WITH_DEFERRED/);
  assert.match(String(summary.selection), /no optimiza/);
});

test("F7.13 entrega decisiones dinámicas y no autoriza ejecución", () => {
  const summary = summarizeDynamicDecisionRun({ disposition: "DECISIONS_AVAILABLE", overall_decision: "MIXED", result: { unit_decisions: [{ unit_id: "checkout@1", decision: "SCALE", decision_qualifiers: ["PROGRESSIVE_SCALE"], rationale: "evidence", scale_limit: "guardrails and capacity", execution_authorized: false }] } });
  assert.equal(summary.overall_decision, "MIXED");
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no .*ejecuta|no .*autoriza/i);
});

test("F7.14 entrega restraint reasoning al Copiloto sin convertirlo en research agent", () => {
  const summary = summarizeRestraintDecisionRun({ disposition: "DECISION_AVAILABLE", decision: "WAIT", result: { scope: "retention", wait_reason: "cohort maturation", review_condition: "next purchase cycle", decision_critical_question: "Does retention recover?", evidence_path: ["observe"], execution_authorized: false } });
  assert.equal(summary.decision, "WAIT");
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no monitoriza|no .*investiga/i);
});

test("F7.15 entrega tesis y criterios al Copiloto sin convertirlos en promesa", () => {
  const summary = summarizeExpectedOutcomeRun({ disposition: "OUTCOME_CRITERIA_AVAILABLE", result: { causal_thesis: "If X because Y expect Z", primary_success_criterion: "criterion", guardrails: ["margin"], scale_criterion: "scale readiness", execution_authorized: false } });
  assert.match(String(summary.causal_thesis), /expect Z/);
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no monitoriza|no .*evalua/i);
});

test("F7.17 entrega confianza por dimensiones sin convertirla en score", () => {
  const summary = summarizeRecommendationConfidenceRun({ disposition: "CONFIDENCE_AVAILABLE", result: { recommendation_confidence: "MEDIUM", impact_magnitude_confidence: "LOW", scale_confidence: "UNKNOWN", recommendation_form: "TEST_OR_PILOT", action_implication: "No autoriza ejecución" } });
  assert.equal(summary.recommendation_confidence, "MEDIUM");
  assert.equal(summary.impact_magnitude_confidence, "LOW");
  assert.equal(summary.scale_confidence, "UNKNOWN");
  assert.equal(summary.execution_authorized, false);
});

test("F7.18 entrega decisión primero, contexto después y no autoriza ejecución", () => {
  const summary = summarizeRecommendationCommunicationRun({ disposition: "COMMUNICATION_AVAILABLE", primary_recommendation: "Fix checkout", result: { reason: "Bottleneck", why_now: "Active now", expected_outcome: "If fixed, recovery is expected", main_uncertainty: "scope", fact_evidence: ["Observed"], inference_evidence: ["Likely cause"], next_decision: "Continue if signal holds", execution_authorized: false } });
  assert.equal(summary.primary_recommendation, "Fix checkout");
  assert.deepEqual(summary.fact_evidence, ["Observed"]);
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no ejecuta|no autoriza/i);
});

test("F7.10 entrega now/later y capability previa sin score ni autorización", () => {
  const summary = summarizeMaturityRecommendationRun({ disposition: "MATURITY_RECOMMENDATIONS_AVAILABLE", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "checkout@1", functional_maturity: "ad_hoc", recommended_mode: "BUILD_CAPABILITY_FIRST", timing_fit: "LATER", current_recommendation: "Instrumentar medición", deferred_recommendation: "Personalización avanzada", missing_capability: "reliable measurement", capability_building_recommendation: "Instrumentar medición", maturity_unlock: ["experimentation"], unresolved_unknowns: [], rationale: [] }] } });
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no puntúa madurez/);
  assert.match(JSON.stringify(summary), /reliable measurement/);
});

test("el contexto del Copiloto conserva abstención, incertidumbre y trazabilidad", () => {
  const blocks = buildDecisionPlaybookContextBlocks({
    decisionOutput: {
      as_of: "2026-09-17T10:00:00.000Z",
      candidate_ref: "case-1",
      decision_status: "VALIDATION_REQUIRED",
      reason_codes: ["VALIDATION.UNKNOWN"],
      result: {
        decision_type: "ABSTAIN",
        decision_confidence: "UNKNOWN",
        rationale: "Falta contexto",
        unknowns: ["ranking"],
        evidence_refs: ["output-1"],
        tradeoffs: ["delay"],
        critical_assumptions: ["objective"],
        review_trigger: "new evidence",
      },
    },
    playbookRuns: [
      {
        domain: "PAID_MEDIA",
        disposition: "VALIDATION_REQUIRED",
        candidate_count: 1,
        selected_instance_id: null,
        unresolved_unknowns: ["paid_media.measurement.sufficient"],
        reason_codes: ["SELECTION.VALIDATION_REQUIRED"],
        source_refs: ["rag:5.02"],
        as_of: "2026-09-17T10:00:00.000Z",
        result: { selected_instance: null },
      },
    ],
  });

  assert.equal(blocks.length, 21);
  assert.deepEqual(summarizeDecisionOutput({ decision_status: "ABSTAIN", result: {} }).status, "ABSTAIN");
  assert.deepEqual(
    summarizePlaybookRun({
      domain: "PAID_MEDIA",
      disposition: "VALIDATION_REQUIRED",
      unresolved_unknowns: ["measurement"],
      result: {},
    }).unknowns,
    ["measurement"],
  );
  assert.match(JSON.stringify(blocks), /paid_media\.measurement\.sufficient/);
  assert.match(JSON.stringify(blocks), /VALIDATION_REQUIRED/);
  assert.match(blocks[3]?.label ?? "", /F5\/F6/);
  assert.match(blocks[5]?.label ?? "", /F7\.02/);
  assert.match(blocks[6]?.label ?? "", /F7\.03/);
  assert.match(blocks[7]?.label ?? "", /F7\.04/);
  assert.match(blocks[8]?.label ?? "", /F7\.05/);
  assert.match(blocks[9]?.label ?? "", /F7\.06/);
  assert.match(blocks[10]?.label ?? "", /F7\.07/);
  assert.match(blocks[11]?.label ?? "", /F7\.08/);
  assert.match(blocks[12]?.label ?? "", /F7\.09/);
  assert.match(blocks[13]?.label ?? "", /F7\.10/);
});

test("F7.01 entrega al Copiloto elegibilidad sin convertirla en seleccion", () => {
  const summary = summarizeInterventionEligibilityRun({
    organization_id: "org-a",
    disposition: "VALIDATION_REQUIRED",
    candidate_count: 1,
    eligible_count: 0,
    as_of: "2026-09-18T10:00:00.000Z",
    unresolved_unknowns: ["intervention.dependencies.observed"],
    reason_codes: ["ELIGIBILITY.INSUFFICIENT_EVIDENCE"],
    source_refs: ["playbook_template:org-a:f7-smoke"],
    result: {
      selection: { selected: false },
      candidate_evaluations: [{
        candidate_id: "f7-smoke",
        disposition: "INSUFFICIENT_EVIDENCE",
        conditions: [],
        blockers: [],
        unresolved_unknowns: ["intervention.dependencies.observed"],
        reason_codes: ["ELIGIBILITY.INSUFFICIENT_EVIDENCE"],
      }],
    },
  });

  assert.equal(summary.selection, "none; F7.01 no prioriza ni elige candidatos");
  const candidates = summary.candidates as Array<{ candidate_id?: string }>;
  assert.equal(candidates[0]?.candidate_id, "f7-smoke");
  assert.deepEqual(summary.unknowns, ["intervention.dependencies.observed"]);
});

test("F7.02 entrega al Copiloto la cadena causal sin seleccionar candidatos", () => {
  const summary = summarizeInterventionMatchingRun({
    disposition: "MATCHES_AVAILABLE",
    candidate_count: 1,
    matched_count: 1,
    as_of: "2026-09-18T10:00:00.000Z",
    result: {
      matched_candidate_ids: ["f7-match"],
      candidate_evaluations: [{
        candidate_id: "f7-match",
        disposition: "MATCHED",
        causal_chain: {
          problem_refs: ["problem:cvr"],
          driver_refs: ["driver:checkout"],
          cause_refs: ["cause:mobile"],
          mechanism_refs: ["mechanism:checkout"],
          lever_refs: ["lever:mobile"],
        },
        supporting_signal_refs: ["signal:mobile"],
        disconfirming_signal_refs: [],
        discriminating_evidence_refs: [],
        unresolved_unknowns: [],
        reason_codes: ["MATCHING.CAUSAL_FIT_SUPPORTED"],
      }],
    },
  });
  assert.equal(summary.selection, "none; F7.02 no prioriza ni elige candidatos");
  assert.deepEqual(summary.matched_candidate_ids, ["f7-match"]);
});

test("F7.03 entrega al Copiloto una prioridad explicable sin autorizar ejecución", () => {
  const summary = summarizeInterventionPrioritizationRun({
    disposition: "PRIORITY_AVAILABLE",
    candidate_count: 2,
    primary_priority_candidate_id: "fix-checkout",
    result: {
      candidate_evaluations: [
        { candidate_id: "fix-checkout", priority_tier: "NOW", reason_codes: ["PRIORITY.PRIMARY_NOW"], unresolved_unknowns: [] },
        { candidate_id: "rewrite-copy", priority_tier: "LATER", reason_codes: ["PRIORITY.LOWER_RELATIVE_PRIORITY"], unresolved_unknowns: [] },
      ],
    },
  });
  assert.equal(summary.primary_priority_candidate_id, "fix-checkout");
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no autoriza ejecución/);
});

test("F7.04 entrega expectativa trazable sin prometer resultado ni autorizar ejecución", () => {
  const summary = summarizeInterventionImpactRun({
    disposition: "IMPACTS_AVAILABLE",
    candidate_count: 1,
    primary_priority_candidate_id: "fix-checkout",
    result: { candidate_evaluations: [{ candidate_id: "fix-checkout", disposition: "SUPPORTED_QUALITATIVE", primary_effect: "Reducir fricción", impact_trace: { mechanism_refs: ["checkout-friction"], leading_indicator_refs: ["checkout_completion"] }, unresolved_unknowns: [], reason_codes: [] }] },
  });
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no garantiza resultado/);
  assert.match(JSON.stringify(summary), /checkout_completion/);
});

test("F7.05 entrega recursos y capacidad sin convertirlos en presupuesto o autorización", () => {
  const summary = summarizeInterventionFeasibilityRun({ disposition: "VALIDATION_REQUIRED", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "fix@1.0.0", disposition: "VALIDATION_REQUIRED", resource_trace: { required_resources: ["developer"], bottleneck_resources: ["developer"] }, cost_profile: { direct: "UNKNOWN", recurring: "UNKNOWN" }, effort_profile: { workload: "MATERIAL" }, unresolved_unknowns: ["developer:capacity"], reason_codes: ["RESOURCE.CONTEXT_UNKNOWN"] }] } });
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no contrata/);
  assert.match(JSON.stringify(summary), /developer:capacity/);
});

test("F7.06 entrega riesgo y reversibilidad separados sin autorizar ejecucion", () => {
  const summary = summarizeInterventionRiskRun({ disposition: "RISK_REQUIRES_MITIGATION", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "fix@1.0.0", disposition: "RISK_REQUIRES_MITIGATION", potential_downside: ["hidden damage"], blast_radius: { scope: ["mobile"], level: "MATERIAL" }, reversibility_profile: { can_revert: "PARTIAL" }, cost_of_error: { severity: "MATERIAL" }, unresolved_unknowns: ["reversal_delay"], reason_codes: ["REVERSIBILITY.PARTIAL"] }] } });
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no calcula risk score/);
  assert.match(JSON.stringify(summary), /hidden damage/);
});

test("F7.07 entrega camino condicional sin crear tareas ni autorizar ejecucion", () => {
  const summary = summarizeInterventionSequencingRun({ disposition: "SEQUENCES_AVAILABLE", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "scale@1", disposition: "SEQUENCE_READY", strategic_intervention: "Scale checkout", decision_path: { now: ["Confirm tracking"], then: ["Scale checkout"], if_branches: ["ready -> scale"], if_not_branches: ["not ready -> repair"], parallel: [], wait: [] }, current_blockers: [], unresolved_unknowns: [], reason_codes: [] }] } });
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no crea tareas/);
  assert.match(JSON.stringify(summary), /Confirm tracking/);
});

test("F7.08 entrega modo, hipótesis y handoff sin lanzar experimento ni autorizar ejecución", () => {
  const summary = summarizeInterventionTestExecuteRun({ disposition: "DECISIONS_AVAILABLE", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "checkout@1", recommended_mode: "TEST", candidate_intervention: "Improve checkout", hypothesis: "If X because Y, Z improves", learning_question: "Does X change Z?", decision_after_result: ["expand", "stop"], decision_path: { handoff: ["Evidence -> Gate"], why_now: [], why_not_direct: [], why_not_test: [], preconditions: [], after_result: [] }, outcome_interpretation: { positive: ["expand"], negative: ["stop"], inconclusive: ["observe"], business_significance: [], full_funnel: [], incrementality: [] }, contamination: [], rationale: ["DECISION.TEST_LEARNING_VALUE"], unresolved_unknowns: [], reason_codes: [] }] } });
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no lanza tests/);
  assert.match(JSON.stringify(summary), /Evidence -> Gate/);
  assert.match(JSON.stringify(summary), /Improve checkout/);
});

test("F7.09 entrega intensidad multidimensional sin presupuesto ni autorización", () => {
  const summary = summarizeInterventionIntensityRun({ disposition: "INTENSITY_PROFILES_AVAILABLE", candidate_count: 1, result: { candidate_evaluations: [{ candidate_id: "scale@1", recommended_mode: "INCREASE", magnitude: "moderate", scope: "mobile", velocity: "stepwise", duration: "temporary", current_limiter: "cash", ramp_logic: ["increase -> observe"], decision_path: { why_this_size: [], limiter: ["cash"], next_observation: [], if_improves: [], if_deteriorates: [], if_capacity_tightens: [], handoff: [] }, rationale: [], unresolved_unknowns: [] }] } });
  assert.equal(summary.execution_authorized, false);
  assert.match(String(summary.selection), /no fija porcentajes/);
  assert.match(JSON.stringify(summary), /stepwise/);
});

test("el contexto del Copiloto expone F3 sin convertir un diagnostico incompleto en una conclusion", () => {
  const blocks = buildDecisionPlaybookContextBlocks({
    diagnosticOutputs: [
      {
        organization_id: "org-a",
        case_id: "case-a",
        status: "insufficient_data",
        completeness_status: "blocked",
        finalization_status: "invalid_output",
        confidence: "insufficient_data",
        confidence_language: "insufficient_data",
        blocking_components: ["confounder_review", "temporal_review"],
        missing_components: ["validated_evidence"],
        diagnostic_summary: "No puede determinarse con la evidencia disponible.",
        limitation_summary: "La revisión adversarial no ha terminado.",
        data_gap_summary: "Falta una serie comparable.",
        manual_review_required: true,
        handoff_ready: false,
        evaluated_at: "2026-09-18T10:00:00.000Z",
      },
    ],
    robustnessReviews: [
      {
        organization_id: "org-a",
        case_id: "case-a",
        review_status: "current",
        false_diagnosis_risk: "high",
        survival_status: "requires_revision",
        robustness: "low",
        diagnosis_stability: "highly_sensitive",
        remaining_limitations: "Falta controlar el cambio de tracking.",
        red_team_required_evidence: "Reconciliación del evento de compra.",
        reviewed_at: "2026-09-18T10:00:00.000Z",
      },
    ],
    temporalDiagnoses: [
      {
        organization_id: "org-a",
        case_id: "case-a",
        assessment_status: "current",
        current_state: "unknown",
        trajectory: "unknown",
        temporal_sufficiency: "insufficient",
        baseline_status: "active",
        trajectory_confidence: "unknown",
        limitations: "No hay histórico suficiente.",
        assessed_at: "2026-09-18T10:00:00.000Z",
      },
    ],
  });

  const f3 = blocks.find((block) => block.label.startsWith("F3"));
  assert.ok(f3);
  assert.match(JSON.stringify(f3), /invalid_output/);
  assert.match(JSON.stringify(f3), /requires_revision/);
  assert.match(JSON.stringify(f3), /temporal_review/);
  assert.equal(summarizeDiagnosticOutput({ finalization_status: "invalid_output" }).status, "invalid_output");
  assert.equal(summarizeDiagnosticRobustness({ survival_status: "requires_revision" }).status, "requires_revision");
  assert.equal(summarizeTemporalDiagnosis({ trajectory: "unknown" }).trajectory, "unknown");
});

test("el adaptador del Copiloto fija y respeta el tenant en todas las lecturas", async () => {
  const organizationId = "org-a";
  const calls: Array<{ table: string; column: string; value: unknown }> = [];
  const rowsByTable: Record<string, unknown[]> = {
    diagnostic_outputs: [
      { organization_id: "org-a", case_id: "case-a", finalization_status: "invalid_output" },
      { organization_id: "org-b", case_id: "case-b", finalization_status: "finalized_valid" },
    ],
    diagnostic_robustness: [],
    temporal_diagnoses: [],
    decision_contexts: [],
    decision_outputs: [],
    playbook_framework_runs: [],
  };

  const client = {
    from(table: string) {
      const rows = rowsByTable[table] ?? [];
      const query: any = {
        select() { return query; },
        eq(column: string, value: unknown) {
          calls.push({ table, column, value });
          return query;
        },
        is() { return query; },
        order() { return query; },
        limit() { return query; },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };

  const blocks = await loadDecisionPlaybookContextBlocks(client as never, organizationId);
  const f3 = blocks.find((block) => block.label.startsWith("F3"));
  assert.ok(f3);
  assert.match(JSON.stringify(f3), /case-a/);
  assert.doesNotMatch(JSON.stringify(f3), /case-b/);
  assert.ok(
    calls.filter((call) => call.column === "organization_id").every((call) => call.value === organizationId),
  );
});

test("el resumen de playbooks conserva facts y evidencia de benchmarks F6", () => {
  const summary = summarizePlaybookRun({
    organization_id: "org-a",
    domain: "BENCHMARKS_GUARDRAILS",
    disposition: "VALIDATION_REQUIRED",
    input_envelope: {
      context: {
        as_of: "2026-09-18T10:00:00.000Z",
        facts: {
          "benchmark.metric.value.observed": "TRUE",
          "benchmark.comparability.observed": "UNKNOWN",
          "benchmark.guardrails.observed": "UNKNOWN",
          "untrusted.extra": "not-a-tristate",
        },
        evidence_refs: ["shopify_sales_summary:org-a:2026-09-18"],
        source_versions: ["f6-p00.v1"],
      },
    },
    result: {},
  });

  assert.deepEqual(summary.context_facts, {
    "benchmark.metric.value.observed": "TRUE",
    "benchmark.comparability.observed": "UNKNOWN",
    "benchmark.guardrails.observed": "UNKNOWN",
  });
  assert.deepEqual(summary.context_evidence_refs, ["shopify_sales_summary:org-a:2026-09-18"]);
  assert.deepEqual(summary.context_source_versions, ["f6-p00.v1"]);
});
