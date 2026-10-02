import assert from "node:assert/strict";
import test from "node:test";
import { caminoPlanOutputSchema, caminoPlanSchemaForHorizon } from "@e-nora/ai";
import { buildCrossChannelMeasurementSet } from "@e-nora/contracts";
import {
  applyExecutiveDiagnosisToCaminoProposal,
  composeExecutiveDiagnosis,
  composeExecutiveDiagnosisView,
  deriveCaminoDiagnosis,
  getExecutiveDiagnosis,
  loadExecutiveDiagnosisContextBlocks,
  mapConfidence,
  mapSeverity,
  summarizeExecutiveDiagnosisForAgent,
  type ExecutiveDiagnosisSources,
} from "./executive-diagnosis.js";
import { metaPurchaseValueEvidence, shopifyNetSalesEvidence } from "./cross-channel-attribution.js";

// Fixtures sinteticos: prueban composicion y estados parciales, NO exactitud de negocio.
const output = (extra: Record<string, unknown> = {}) => ({
  id: "out-1", organization_id: "org-1", case_id: "case-1", store_id: null, status: "confirmed",
  finalization_status: "finalized_valid", validation_passed: true, handoff_ready: true, is_current: true,
  confidence: "medium", user_summary: "Las ventas netas caen frente al periodo anterior.", evaluated_at: "2026-09-29T01:00:00.000Z",
  root_cause_id: "rc-1", severity_assessment_id: "sev-1", constraint_id: null, temporal_diagnosis_id: null,
  root_cause_condition_satisfied: true, completeness_status: "complete", degraded: false, manual_review_required: false,
  limitation_summary: "Sin datos de margen por producto.", missing_components: [], blocking_components: [], ...extra,
});
const stage = (id: string, disposition: string, extra: Record<string, unknown> = {}) => ({
  id, disposition, evaluated_at: "2026-09-29T05:00:00.000Z", context_id: `ctx:${id}`, decision_cycle_id: `cycle:${id}`,
  input_envelope: {}, result: {}, ...extra,
});
// La cadena de intervenciones (7.01-7.11) cita D14; la 7.12-7.18 no lee D14 y no lleva diagnosis_refs.
const cites = (...ids: string[]) => ({ input_envelope: { context: { diagnosis_refs: ids } } });
const full = (): ExecutiveDiagnosisSources => ({
  output: output(),
  case_row: { id: "case-1", target_metric: "net_sales", primary_issue: "Caída de ventas netas" },
  root_cause: { id: "rc-1", statement: "Menos sesiones de pago", status: "confirmed" },
  severity: { id: "sev-1", overall_severity: "business_threat", trajectory: "deteriorating", limitations: [] },
  impact_measurements: [{ assessment_id: "sev-1", dimension: "revenue", evidence_type: "observed", timing: "realized", value: 1200, unit: "EUR" }],
  claim_confidence: [{ claim_layer: "overall", confidence_level: "medium", capped_at: "medium", limitations: [] }],
  hypotheses: [{ code: "H1", statement: "Menos tráfico", status: "confirmed" }, { code: "H2", statement: "Precio", status: "invalidated", rejection_reason: "sin cambio de precio" }],
  evidence: [{ id: "ev-1", code: "E1", source: "shopify", source_system: "shopify", metric: "sessions", reliability: "high" }],
  output_evidence: [{ id: "oe-1", claim_layer: "root_cause", claim: "sesiones -20%", source: "shopify", source_ref: "shopify_sessions_daily", stance: "supporting" }],
  data_gaps: [{ required_data: "coste por producto", reason: "sin costes cargados", impact_on_diagnosis: "medium" }],
  decision_impact: { id: "di-1", candidate_ref: "case-1", impact_assessment: "MEDIUM", unresolved_unknowns: [],
    result: { value_state: "POTENTIAL", value_type: "REVENUE", impact_type: "PROTECT", magnitude: { absolute_value: 5000, currency: "EUR" }, scenarios: { base: 5000 } } },
  prioritization_run: { id: "pr-1", run_status: "COMPLETED", decision_validity: "VALID",
    result: { run_status: "COMPLETED", decision_validity: "VALID", candidate_evaluation_refs: [{ candidate_id: "out-1", classification: "prioritize", rank: 1, decision_confidence: "SUFFICIENT_WITH_LIMITATIONS" }] } },
  ranking: { id: "rk-1", ranking_status: "RANKED", result: { ranked_candidates: [{ candidate_ref: "case-1", rank: 1 }] } },
  decision_output: { id: "do-1", candidate_ref: "case-1", decision_status: "READY", result: { decision_type: "PRIORITIZE", rank: 1, decision_confidence: "MEDIUM" } },
  f7: {
    matching: stage("mt-1", "MATCHES_AVAILABLE", cites("out-1")),
    prioritization: stage("ip-1", "PRIORITIZED", { primary_priority_candidate_id: "tpl@1", ...cites("out-1") }),
    portfolio: stage("pf-1", "PORTFOLIO_AVAILABLE", { primary_candidate_id: "tpl@1" }),
    restraint: stage("rs-1", "DECISION_AVAILABLE", { result: { decision: "ACT", rationale: "hay señal material" } }),
    communication: stage("cm-1", "COMMUNICATION_AVAILABLE", { primary_recommendation: "Recuperar sesiones de pago" }),
    expected_outcome: stage("eo-1", "OUTCOME_CRITERIA_AVAILABLE", {
      result: { recommendation: "Recuperar sesiones de pago", causal_thesis: "Si sube el tráfico...", direction: "IMPROVE_OR_STABILIZE", magnitude: "NOT_DECLARED", outcome_horizon: "30d", primary_success_criterion: "Sesiones +10%", outcome_confidence: "LOW", quality_flags: ["MAGNITUDE_NOT_SUPPORTED"] },
    }),
  },
  tenant_facts: [{ dimension: "main_market", value: "ES" }],
  organization_currency: "EUR",
});
const onlyD14 = (): ExecutiveDiagnosisSources => ({ output: output(), case_row: { id: "case-1", target_metric: "net_sales" } });

const agentRow = (status = "pending_approval", severity = "medium") => ({
  status, created_at: "2026-09-29T02:00:00.000Z",
  output: { findings: [{ title: "El margen cae", severity, evidence: "margen -3pp", area: "finanzas" }] },
  agent_runs: { store_id: null, agent_versions: { version: "v9", agent_definitions: { code: "a02_monitor_negocio" } } },
});

const period = { start: "2026-09-01", end: "2026-09-30" };

test("1. pipeline completo: enlaza por id sin recalcular nada", () => {
  const v = composeExecutiveDiagnosisView(full());
  assert.equal(v.identity.diagnostic_output_id, "out-1");
  assert.equal(v.identity.diagnostic_case_id, "case-1");
  assert.equal(v.identity.severity_assessment_id, "sev-1");
  assert.equal(v.identity.prioritization_run_id, "pr-1");
  assert.equal(v.identity.decision_output_id, "do-1");
  assert.equal(v.identity.decision_impact_assessment_id, "di-1");
  assert.equal(v.identity.expected_outcome_run_id, "eo-1");
  assert.equal(v.diagnosis.root_cause.state, "validated");
  // business_threat no se degrada: raw y presentacion intactos; solo el bucket visual sube a critical.
  assert.equal(v.diagnosis.severity.raw, "business_threat");
  assert.equal(v.diagnosis.severity.presentation, "business_threat");
  assert.equal(v.diagnosis.severity.visual_bucket, "critical");
  assert.deepEqual([v.priority.status, v.priority.classification, v.priority.rank], ["available", "prioritize", 1]);
  assert.equal(v.recommendation.status, "available");
  // El portafolio 7.12 no cita D14: es de organizacion y no se atribuye a este diagnostico.
  assert.equal(v.recommendation.matching?.link_state, "diagnosis_linked");
  assert.equal(v.recommendation.portfolio?.link_state, "organization_level");
  assert.equal(v.recommendation.attributable_to_diagnosis, false);
  assert.equal(v.validation_state.canonical, true);
  assert.deepEqual(
    v.executive_narrative.steps.map((s) => s.step),
    ["que_ocurre", "causa", "impacto_observado", "impacto_potencial", "prioridad", "recomendacion", "resultado_esperado", "evidencia", "incertidumbre", "siguiente_validacion"],
  );
});

test("2. D14 sin F4: no se deduce prioridad de la severidad", () => {
  const s = full();
  delete s.prioritization_run; delete s.ranking; delete s.decision_output;
  const v = composeExecutiveDiagnosisView(s);
  assert.equal(v.diagnosis.severity.raw, "business_threat");
  assert.equal(v.priority.status, "priority_unavailable");
  assert.equal(v.priority.classification, null);
  assert.equal(v.priority.rank, null);
  assert.equal(v.priority.decision_type, null);
  assert.match(v.executive_narrative.steps[4]!.text, /no disponible/);
});

test("3. D14 + F4 sin F7: sin recomendacion ni resultado esperado inventados", () => {
  const s = full();
  s.f7 = {};
  const v = composeExecutiveDiagnosisView(s);
  assert.equal(v.priority.status, "available");
  assert.equal(v.recommendation.status, "unavailable");
  assert.equal(v.recommendation.primary_candidate_id, null);
  assert.equal(v.recommendation.portfolio, null);
  assert.equal(v.expected_outcome.status, "unavailable");
  assert.equal(v.expected_outcome.magnitude, null);
  assert.equal(v.expected_outcome.magnitude_supported, false);
  assert.equal(v.identity.expected_outcome_run_id, null);
});

test("4. evidencia contradictoria: se conserva junto a la que apoya", () => {
  const s = full();
  s.output_evidence = [
    ...s.output_evidence!,
    { id: "oe-2", claim_layer: "root_cause", claim: "las sesiones no cayeron en móvil", source: "shopify", source_ref: "shopify_sessions_daily", stance: "contradicting" },
  ];
  const v = composeExecutiveDiagnosisView(s);
  assert.equal(v.has_contradicting_evidence, true);
  assert.deepEqual(v.evidence_refs.filter((e) => e.kind === "diagnostic_output_evidence").map((e) => e.stance), ["supporting", "contradicting"]);
  assert.match(v.executive_narrative.text, /CONTRADICTORIA/);
});

test("5. confianza insuficiente: visible como unknown, con el valor original", () => {
  const v = composeExecutiveDiagnosisView({ ...full(), output: output({ confidence: "insufficient_data" }) });
  assert.deepEqual(v.diagnosis.confidence, { raw: "insufficient_data", source: "d_family", presentation: "unknown" });
  assert.match(v.executive_narrative.text, /Confianza: unknown/);
  assert.deepEqual(mapConfidence("f4_f7", "UNKNOWN").presentation, "unknown");
  assert.equal(mapConfidence("d_family", null).presentation, null);
});

test("6. prioridad validate_first: la suficiencia decisional no se convierte en confianza", () => {
  const s = full();
  s.prioritization_run = { id: "pr-2", run_status: "COMPLETED", result: { candidate_evaluation_refs: [{ candidate_id: "out-1", classification: "validate_first", decision_confidence: "VALIDATION_REQUIRED" }] } };
  const v = composeExecutiveDiagnosisView(s);
  assert.equal(v.priority.classification, "validate_first");
  assert.equal(v.priority.decision_sufficiency, "VALIDATION_REQUIRED");
  assert.equal(v.diagnosis.confidence.raw, "medium");
  assert.notEqual(v.diagnosis.confidence.presentation, "validation_required");
});

test("7. recomendacion bloqueada / no-accion / validacion requerida", () => {
  const held = full();
  held.f7!.restraint = stage("rs-2", "DECISION_AVAILABLE", { result: { decision: "NO_ACTION", rationale: "sin headroom" } });
  const hv = composeExecutiveDiagnosisView(held);
  assert.equal(hv.recommendation.status, "no_action");
  assert.match(hv.recommendation.reason ?? "", /NO_ACTION/);
  assert.match(hv.executive_narrative.steps[5]!.text, /no actuar todavía/);

  const validation = full();
  validation.f7!.restraint = null;
  validation.f7!.portfolio = stage("pf-2", "VALIDATION_REQUIRED", { primary_candidate_id: null });
  assert.equal(composeExecutiveDiagnosisView(validation).recommendation.status, "validation_required");

  const none = full();
  none.f7!.restraint = null;
  none.f7!.portfolio = stage("pf-3", "NO_PORTFOLIO_CANDIDATES", { primary_candidate_id: null });
  assert.equal(composeExecutiveDiagnosisView(none).recommendation.status, "unavailable");
});

test("8. F10 comparable: conserva modelo, ventana, moneda y base; no es incrementalidad", () => {
  const set = buildCrossChannelMeasurementSet(
    shopifyNetSalesEvidence({ period, netSales: "10000", storeCurrencies: ["EUR"] }),
    [metaPurchaseValueEvidence({ period, purchaseValue: "2500", accountCurrencies: ["EUR"], attributionWindow: "7d_click" })],
  );
  const v = composeExecutiveDiagnosisView({ ...onlyD14(), attribution: [set] });
  const meta = v.attribution_evidence_refs.find((a) => a.source_system === "meta")!;
  assert.equal(meta.comparison_status, "comparable");
  assert.equal(meta.dependency_pct, 25);
  assert.equal(meta.dependency_is_incrementality, false);
  assert.deepEqual(
    [meta.attribution_basis, meta.attribution_model, meta.attribution_window, meta.currency_code, meta.revenue_basis],
    ["attributed", "platform_reported", "7d_click", "EUR", "platform_attributed_purchase_value"],
  );
  assert.equal(v.attribution_evidence_refs.find((a) => a.source_system === "shopify")!.evidence_role, "economic_anchor");
  assert.match(v.executive_narrative.text, /no demuestran causa ni incrementalidad/);
  // No se copia a diagnostic_evidence.
  assert.equal(v.evidence_refs.some((e) => e.metric_id === "meta.purchase_value"), false);
});

test("9. F10 not_comparable: sin ratio", () => {
  const set = buildCrossChannelMeasurementSet(
    shopifyNetSalesEvidence({ period, netSales: "10000", storeCurrencies: ["EUR"] }),
    [metaPurchaseValueEvidence({ period, purchaseValue: "2500", accountCurrencies: ["USD"], attributionWindow: "7d_click" })],
  );
  const meta = composeExecutiveDiagnosisView({ ...onlyD14(), attribution: [set] }).attribution_evidence_refs.find((a) => a.source_system === "meta")!;
  assert.equal(meta.comparison_status, "not_comparable");
  assert.equal(meta.dependency_pct, null);
});

test("10. finding LLM sin D14: no hay diagnostico canonico y el finding queda como agent_only", () => {
  const result = composeExecutiveDiagnosis({ sources: [], agentRows: [agentRow()] });
  assert.equal(result.status, "NO_VALIDATED_DIAGNOSTIC");
  assert.equal(result.views.length, 0);
  const f = result.agent_findings_unvalidated[0]!;
  assert.deepEqual([f.origin, f.validated, f.d14_relation, f.agent_code, f.agent_version], ["agent_only", false, "no_link_available", "a02_monitor_negocio", "v9"]);
  assert.deepEqual([f.severity.raw, f.severity.presentation], ["medium", "moderate"]);
  assert.equal(deriveCaminoDiagnosis(result), null);
});

test("11. D10 observado y F4.04 potencial: separados, nunca sumados", () => {
  const v = composeExecutiveDiagnosisView(full());
  assert.equal(v.measured_impact.basis, "d10_measured");
  assert.equal(v.decision_impact.basis, "f4_04_potential_decisional");
  assert.equal(v.measured_impact.items[0]!.is_observed, true);
  assert.equal(v.decision_impact.value_state, "POTENTIAL");
  const json = JSON.stringify(v);
  assert.ok(!json.includes("6200"), "1200 observado + 5000 potencial no aparece sumado");
  assert.ok(!Object.keys(v.measured_impact).concat(Object.keys(v.decision_impact)).some((k) => /total|sum|combined/i.test(k)));
  // Un D10 proyectado no se presenta como observado.
  const projected = full();
  projected.impact_measurements = [{ evidence_type: "forecast", timing: "projected", value: 900 }];
  assert.equal(composeExecutiveDiagnosisView(projected).measured_impact.items[0]!.is_observed, false);
  // Sin cuantificar: no es 0.
  const unquantified = full();
  unquantified.decision_impact = { id: "di-2", candidate_ref: "case-1", result: { value_state: "POTENTIAL", magnitude: { absolute_value: null, currency: null } } };
  assert.equal(composeExecutiveDiagnosisView(unquantified).decision_impact.quantified, false);
});

test("12. tenant context ausente: el ensamblado no se bloquea ni inventa contexto", () => {
  const v = composeExecutiveDiagnosisView(onlyD14());
  assert.deepEqual(v.tenant_context, { status: "empty", facts: {}, currency_code: null });
  assert.equal(v.validation_state.canonical, true);
  assert.equal(v.measured_impact.status, "unavailable");
  assert.equal(v.decision_impact.status, "unavailable");
  assert.equal(v.identity.severity_assessment_id, "sev-1");
  assert.equal(composeExecutiveDiagnosisView(full()).tenant_context.facts.main_market, "ES");
});

test("13. pending_approval no es canonico ni entra en las vistas", () => {
  const result = composeExecutiveDiagnosis({ sources: [full()], agentRows: [agentRow("pending_approval"), agentRow("approved")] });
  assert.deepEqual(result.agent_findings_unvalidated.map((f) => [f.pending_approval, f.validated]), [[true, false], [false, false]]);
  assert.ok(!JSON.stringify(result.views).includes("El margen cae"));
});

test("14. moneda incompatible: la vista no calcula ratios propios", () => {
  const set = buildCrossChannelMeasurementSet(
    shopifyNetSalesEvidence({ period, netSales: "10000", storeCurrencies: ["EUR"] }),
    [metaPurchaseValueEvidence({ period, purchaseValue: "2500", accountCurrencies: ["EUR", "USD"], attributionWindow: "7d_click" })],
  );
  const refs = composeExecutiveDiagnosisView({ ...onlyD14(), attribution: [set] }).attribution_evidence_refs;
  assert.ok(refs.every((r) => r.dependency_pct === null));
  assert.equal(refs.find((r) => r.source_system === "meta")!.currency_code, null);
});

test("15. insufficient_data: diagnostico no validado, visible y sin plan derivado", () => {
  const s: ExecutiveDiagnosisSources = { ...full(), output: output({ status: "insufficient_data", confidence: "insufficient_data", finalization_status: "not_finalized", validation_passed: false, root_cause_id: null }), root_cause: null };
  const result = composeExecutiveDiagnosis({ sources: [s] });
  assert.equal(result.status, "NO_VALIDATED_DIAGNOSTIC");
  const v = result.views[0]!;
  assert.equal(v.validation_state.canonical, false);
  assert.equal(v.diagnosis.status, "insufficient_data");
  assert.equal(v.diagnosis.root_cause.state, "none");
  assert.match(v.executive_narrative.text, /NO validado/);
  assert.equal(deriveCaminoDiagnosis(result), null);
});

test("16. Strategic Plan: diagnosis derivado del ensamblado, sin tocar el schema", () => {
  const result = composeExecutiveDiagnosis({ sources: [full()] });
  const base = { plan_name: "Plan", horizon_months: 3, diagnosis: "texto libre del modelo", phases: [], sources: [{ kind: "metric" as const, reference: "net_sales", period: null }], confidence: "medium" as const, warnings: [] };
  const derived = caminoPlanSchemaForHorizon(90, 3).transform((p) => applyExecutiveDiagnosisToCaminoProposal(p, result)).parse(base);
  assert.notEqual(derived.diagnosis, "texto libre del modelo");
  assert.match(derived.diagnosis, /\[D14 out-1\]/);
  assert.ok(derived.sources.some((s) => s.reference === "diagnostic_outputs:out-1"));
  assert.ok(derived.warnings.some((w) => /D14/.test(w)));
  assert.equal(caminoPlanOutputSchema.safeParse(derived).success, true);
  // Sin diagnostico valido el plan no cambia.
  const untouched = caminoPlanOutputSchema.parse(base);
  assert.equal(applyExecutiveDiagnosisToCaminoProposal(untouched, composeExecutiveDiagnosis({ sources: [] })), untouched);
});

test("un finding de agente que contradice D14 no sobrescribe severidad ni prioridad", () => {
  const result = composeExecutiveDiagnosis({ sources: [full()], agentRows: [agentRow("approved", "low")] });
  assert.equal(result.views[0]!.diagnosis.severity.raw, "business_threat");
  assert.equal(result.views[0]!.priority.classification, "prioritize");
  assert.equal(result.agent_findings_unvalidated[0]!.severity.raw, "low");
});

test("mapeos: no destructivos", () => {
  assert.deepEqual(mapSeverity("agent", "medium"), { raw: "medium", source: "agent", presentation: "moderate", visual_bucket: "moderate" });
  assert.deepEqual(mapSeverity("d_family", "moderate").presentation, "moderate");
  assert.equal(mapSeverity("d_family", "business_threat").raw, "business_threat");
  assert.equal(mapSeverity("d_family", undefined).raw, null);
});

test("agentes: reciben la vista con reglas y sin poder de sustitucion", () => {
  const summary = summarizeExecutiveDiagnosisForAgent(composeExecutiveDiagnosis({ sources: [full()], agentRows: [agentRow()] }));
  assert.equal(summary.status, "ASSEMBLED");
  assert.ok(summary.reglas.some((r) => /No sobrescribas severidad/.test(r)));
  assert.equal(summary.diagnosticos[0]!.priority.classification, "prioritize");
  assert.equal(summary.findings_de_agente_sin_validar[0]!.origin, "agent_only");
});

// --- Loader: cliente falso con filtros reales para comprobar los joins.

type Table = Record<string, Array<Record<string, unknown>>>;
function fakeClient(tables: Table, failing: string[] = []) {
  return {
    from(name: string) {
      let rows = [...(tables[name] ?? [])];
      let single = false;
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), q),
        is: (c: string, v: unknown) => ((rows = rows.filter((r) => (r[c] ?? null) === v)), q),
        in: (c: string, v: unknown[]) => ((rows = rows.filter((r) => v.includes(r[c]))), q),
        not: (c: string, _op: string, v: string) => ((rows = rows.filter((r) => !v.replace(/[()]/g, "").split(",").includes(String(r[c])))), q),
        order: () => q,
        limit: (n: number) => ((rows = rows.slice(0, n)), q),
        maybeSingle: () => ((single = true), q),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(failing.includes(name) ? { data: null, error: { message: "boom" } } : { data: single ? rows[0] ?? null : rows, error: null }).then(resolve, reject),
      };
      return q;
    },
  } as never;
}

const fixtureTables = (): Table => {
  const s = full();
  return {
    diagnostic_outputs: [output(), output({ id: "out-2", case_id: "case-2", root_cause_id: null, severity_assessment_id: null })],
    diagnostic_cases: [{ id: "case-1", target_metric: "net_sales" }, { id: "case-2", target_metric: "orders_count" }],
    root_causes: [s.root_cause!], severity_assessments: [s.severity!], impact_measurements: s.impact_measurements!,
    claim_confidence: [{ case_id: "case-1", claim_layer: "overall", confidence_level: "medium" }],
    diagnostic_hypotheses: [{ case_id: "case-1", code: "H1", statement: "x", status: "confirmed" }],
    diagnostic_evidence: [], diagnostic_output_evidence: [{ id: "oe-1", output_id: "out-1", stance: "supporting" }], diagnostic_data_gaps: [],
    decision_impact_assessments: [{ ...s.decision_impact!, organization_id: "org-1" }],
    decision_rankings: [{ ...s.ranking!, organization_id: "org-1" }],
    // El motor de F4 cae al id de la organizacion cuando no hay caso: no es de ningun caso.
    decision_outputs: [{ ...s.decision_output!, organization_id: "org-1" }, { id: "do-org", organization_id: "org-1", candidate_ref: "org-1", result: { decision_type: "PRIORITIZE" } }],
    prioritization_runs: [{ ...s.prioritization_run!, organization_id: "org-1" }],
    intervention_matching_runs: [{ ...s.f7!.matching, organization_id: "org-1" }],
    intervention_prioritization_runs: [{ ...s.f7!.prioritization, organization_id: "org-1" }],
    recommendation_portfolio_runs: [{ ...s.f7!.portfolio, organization_id: "org-1", input_envelope: {} }],
    restraint_decision_runs: [{ ...s.f7!.restraint, organization_id: "org-1" }],
    recommendation_confidence_runs: [], recommendation_communication_runs: [],
    expected_outcome_runs: [{ ...s.f7!.expected_outcome, organization_id: "org-1" }],
    tenant_context_facts: [{ organization_id: "org-1", dimension: "main_market", value: "ES", effective_to: null }],
    organizations: [{ id: "org-1", currency_code: "EUR" }],
    agent_outputs: [],
  };
};

test("loader: joins reales por caso/output y estados parciales sin atribuir lo ajeno", async () => {
  const result = await getExecutiveDiagnosis(fakeClient(fixtureTables()), "org-1");
  assert.equal(result.views.length, 2);
  const [a, b] = result.views as [typeof result.views[number], typeof result.views[number]];
  assert.equal(a.identity.decision_output_id, "do-1");
  assert.equal(a.identity.decision_impact_assessment_id, "di-1");
  assert.equal(a.priority.classification, "prioritize");
  assert.equal(a.measured_impact.status, "available");
  // out-2/case-2: sin severidad D10, sin impacto F4.04, sin decision propia, sin evaluacion F4.00.
  assert.equal(b.identity.decision_output_id, null);
  assert.equal(b.identity.decision_impact_assessment_id, null);
  assert.equal(b.decision_impact.status, "unavailable");
  assert.equal(b.measured_impact.status, "unavailable");
  assert.equal(b.priority.status, "priority_unavailable");
  // F7 corre por organizacion: matching cita out-1, no out-2; el portafolio no cita a nadie (organizacion).
  assert.equal(a.recommendation.matching?.link_state, "diagnosis_linked");
  assert.equal(b.recommendation.matching?.link_state, "unlinked");
  assert.equal(a.recommendation.portfolio?.link_state, "organization_level");
  assert.equal(b.recommendation.portfolio?.link_state, "organization_level");
  assert.equal(result.canonical_count, 2);
});

test("loader: un fallo de lectura queda como limitacion visible, no como cero", async () => {
  const result = await getExecutiveDiagnosis(fakeClient(fixtureTables(), ["decision_impact_assessments"]), "org-1");
  const v = result.views[0]!;
  assert.equal(v.decision_impact.status, "unavailable");
  assert.ok(v.limitations.some((l) => /decision_impact_assessments/.test(l)));
});

test("loader: sin D14 vigente no hay diagnostico ejecutivo canonico", async () => {
  const tables = fixtureTables();
  tables.diagnostic_outputs = [];
  const result = await getExecutiveDiagnosis(fakeClient(tables), "org-1");
  assert.equal(result.status, "NO_VALIDATED_DIAGNOSTIC");
  const [block] = await loadExecutiveDiagnosisContextBlocks(fakeClient(tables), "org-1");
  assert.match(block!.label, /^F11 DIAGNÓSTICO EJECUTIVO/);
  assert.equal((block!.data as { status: string }).status, "NO_VALIDATED_DIAGNOSTIC");
});

test("contexto de agentes: si la lectura revienta, se declara no disponible", async () => {
  const boom = { from: () => { throw new Error("db down"); } } as never;
  const [block] = await loadExecutiveDiagnosisContextBlocks(boom, "org-1");
  assert.match(String(block!.data), /no_disponible/);
});

// --- F11.1 integridad de enlaces: identidad explicita > fallback, y el fallback nunca atribuye causalidad.

const withF7 = (f7: NonNullable<ExecutiveDiagnosisSources["f7"]>, extra: Partial<ExecutiveDiagnosisSources> = {}): ExecutiveDiagnosisSources => ({ ...full(), f7, ...extra });

test("F11.1-8: una recomendacion que cita solo este D14 es diagnosis_linked y atribuible", () => {
  const v = composeExecutiveDiagnosisView(withF7({
    portfolio: stage("pf-1", "PORTFOLIO_AVAILABLE", { primary_candidate_id: "tpl@1", ...cites("out-1") }),
    expected_outcome: stage("eo-1", "OUTCOME_CRITERIA_AVAILABLE", { ...cites("out-1"), result: { primary_success_criterion: "Sesiones +10%", magnitude: "NOT_DECLARED" } }),
  }, { org_output_ids: ["out-1"] }));
  assert.equal(v.recommendation.link_state, "diagnosis_linked");
  assert.equal(v.recommendation.attributable_to_diagnosis, true);
  assert.equal(v.expected_outcome.attributable_to_diagnosis, true);
  assert.match(v.executive_narrative.text, /construida sobre este diagnóstico/);
});

test("F11.1-9/15: recomendacion de organizacion (sin referencias) no se atribuye ni cuenta como causa", () => {
  const v = composeExecutiveDiagnosisView(withF7({ portfolio: stage("pf-1", "PORTFOLIO_AVAILABLE", { primary_candidate_id: "tpl@1" }) }));
  assert.equal(v.recommendation.link_state, "organization_level");
  assert.equal(v.recommendation.attributable_to_diagnosis, false);
  assert.match(v.executive_narrative.text, /de contexto \(organization_level; no atribuible a este diagnóstico\)/);
  assert.doesNotMatch(v.executive_narrative.text, /construida sobre este diagnóstico/);
});

test("F11.1-10: un run anterior al diagnostico es historical, aunque sea el ultimo de la organizacion", () => {
  const old = stage("pf-0", "PORTFOLIO_AVAILABLE", { primary_candidate_id: "tpl@1", evaluated_at: "2026-09-28T00:00:00.000Z" });
  const v = composeExecutiveDiagnosisView(withF7({ portfolio: old }));
  assert.equal(v.recommendation.portfolio?.predates_diagnosis, true);
  assert.equal(v.recommendation.link_state, "historical");
  assert.equal(v.recommendation.attributable_to_diagnosis, false);
});

test("F11.1-11: posterior y sin referencia en la cadena de intervenciones queda unlinked, no ligado al ultimo D14", () => {
  const v = composeExecutiveDiagnosisView(withF7({ matching: stage("mt-2", "MATCHES_AVAILABLE") }));
  assert.equal(v.recommendation.matching?.link_state, "unlinked");
  assert.equal(v.recommendation.matching?.link_via, null);
});

test("F11.1-12: dos diagnosticos simultaneos: el run que cita ambos es de organizacion; el que cita uno solo, de ese", () => {
  const known = ["out-1", "out-2"];
  const both = composeExecutiveDiagnosisView(withF7({ portfolio: stage("pf-1", "PORTFOLIO_AVAILABLE", { primary_candidate_id: "tpl@1", ...cites("out-1", "out-2") }) }, { org_output_ids: known }));
  assert.equal(both.recommendation.link_state, "organization_level");
  assert.equal(both.recommendation.portfolio?.cited_diagnosis_count, 2);
  const onlyA = stage("pf-2", "PORTFOLIO_AVAILABLE", { primary_candidate_id: "tpl@1", ...cites("out-1") });
  const forA = composeExecutiveDiagnosisView(withF7({ portfolio: onlyA }, { org_output_ids: known }));
  const forB = composeExecutiveDiagnosisView(withF7({ portfolio: onlyA }, { output: output({ id: "out-2", case_id: "case-2" }), org_output_ids: known }));
  assert.equal(forA.recommendation.link_state, "diagnosis_linked");
  // 4: la recomendacion vinculada a A no aparece como de B.
  assert.equal(forB.recommendation.link_state, "unlinked");
  assert.equal(forB.recommendation.attributable_to_diagnosis, false);
});

test("F11.1: la referencia por lineage (source_refs con id exacto de D14) cuenta como explicita y se rotula", () => {
  const v = composeExecutiveDiagnosisView(withF7({ prioritization: stage("ip-9", "PRIORITIZED", { source_refs: ["f7-p03.v1", "out-1"] }) }, { org_output_ids: ["out-1"] }));
  assert.equal(v.recommendation.prioritization?.link_state, "diagnosis_linked");
  assert.equal(v.recommendation.prioritization?.link_via, "source_refs");
});

test("F11.1: el fallback organization_latest_run ya no existe como vinculo confirmado", () => {
  const v = composeExecutiveDiagnosisView(full());
  for (const ref of [v.recommendation.portfolio, v.recommendation.restraint, v.recommendation.matching, v.expected_outcome.run]) {
    assert.ok(ref && ["diagnosis_linked", "organization_level", "historical", "unlinked"].includes(ref.link_state));
    assert.equal("link_basis" in ref, false);
  }
});

test("F11.1-5/6/7: F11 lee classification si F4 la produjo y nunca la inventa", () => {
  const withClass = composeExecutiveDiagnosisView(full());
  assert.equal(withClass.priority.classification, "prioritize");
  const absent = full();
  absent.prioritization_run = { id: "pr-2", run_status: "READY", decision_validity: "VALID_WITH_LIMITATIONS", result: { run_status: "READY", decision_validity: "VALID_WITH_LIMITATIONS", candidate_evaluation_refs: [{ candidate_id: "out-1", decision_confidence: "UNKNOWN" }] } };
  absent.ranking = null;
  absent.decision_output = { id: "do-9", candidate_ref: "case-1", result: { decision_type: "ABSTAIN" } };
  const v = composeExecutiveDiagnosisView(absent);
  assert.equal(v.priority.classification, null);
  assert.equal(v.priority.status, "abstained");
  assert.equal(v.priority.rank, null);
});

test("F11.1-1/2/3: dos D14 y dos casos abiertos: cada uno conserva su decision, impacto y prioridad", async () => {
  const tables = fixtureTables();
  tables.decision_outputs!.push({ id: "do-2", organization_id: "org-1", candidate_ref: "case-2", result: { decision_type: "VALIDATE" } });
  tables.decision_impact_assessments!.push({ id: "di-2", organization_id: "org-1", candidate_ref: "case-2", impact_assessment: "LOW", unresolved_unknowns: [], result: {} });
  const result = await getExecutiveDiagnosis(fakeClient(tables), "org-1");
  const [a, b] = result.views as [typeof result.views[number], typeof result.views[number]];
  assert.deepEqual([a.identity.decision_output_id, a.identity.decision_impact_assessment_id], ["do-1", "di-1"]);
  assert.deepEqual([b.identity.decision_output_id, b.identity.decision_impact_assessment_id], ["do-2", "di-2"]);
  assert.equal(a.priority.decision_type, "PRIORITIZE");
  assert.equal(b.priority.decision_type, "VALIDATE");
  assert.equal(b.priority.classification, null);
});
