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
  summarizePlaybookRun,
  summarizeTemporalDiagnosis,
} from "./decision-playbook-chat-context.js";

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

  assert.equal(blocks.length, 6);
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

test("el contexto del Copiloto expone F3 sin convertir un diagnóstico incompleto en una conclusión", () => {
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
