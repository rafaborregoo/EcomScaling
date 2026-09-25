/**
 * F3/D12 — adaptador persistente de la revisión adversarial.
 *
 * La lógica de decisión vive en `@e-nora/contracts`. Este fichero solo
 * traduce las tablas que ya existen a la entrada del motor puro y persiste la
 * revisión append-only. No usa el LLM: el red team de D12 es deliberadamente
 * determinista y acotado por evidencia observable.
 */
import { createClient } from "@supabase/supabase-js";
import {
  DIAGNOSTIC_FAMILIES,
  getDiagnosticRobustness,
  REVISION_BUDGET_EXHAUSTED_NOTE,
  revisionDecision,
  type AdversarialRuntimeInput,
  type AdversarialRuntimeSignal,
  type AdversarialRuntimeEvent,
  type AdversarialRuntimeBreak,
  type AdversarialRuntimeMixSegment,
  type DiagnosticConfounder,
} from "@e-nora/contracts";
import { createLogger } from "@e-nora/observability";
import { type LoadedApiEnv } from "@e-nora/config";

const logger = createLogger("adversarial-engine");

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as any;
}

type CaseRow = {
  id: string;
  target_metric: string;
  scope: string;
  store_id: string | null;
  analysis_period_start: string;
  analysis_period_end: string;
  comparison_period_start: string | null;
  comparison_period_end: string | null;
  confidence: string | null;
};

const CHECK_FAMILY_BY_METRIC: Record<string, (typeof DIAGNOSTIC_FAMILIES)[number]> = {
  net_sales: "revenue",
  revenue: "revenue",
  orders_count: "revenue",
  cac: "cac",
  cpa: "cac",
  conversion_rate: "conversion",
  cvr: "conversion",
  retention: "retention",
  repeat_rate: "retention",
  gross_margin: "finance",
  contribution_margin: "finance",
  inventory: "inventory",
  stock: "inventory",
  data_quality: "data",
  technology: "technology",
};

function diagnosticFamily(metric: string): (typeof DIAGNOSTIC_FAMILIES)[number] {
  return CHECK_FAMILY_BY_METRIC[metric] ?? "data";
}

function overlaps(start: string | null | undefined, end: string | null | undefined, periodStart: string, periodEnd: string) {
  const itemStart = Date.parse(start ?? periodStart);
  const itemEnd = Date.parse(end ?? start ?? periodStart);
  const windowStart = Date.parse(periodStart);
  const windowEnd = Date.parse(periodEnd);
  return Number.isFinite(itemStart) && Number.isFinite(itemEnd)
    && itemEnd >= windowStart && itemStart <= windowEnd;
}

function sourceMatchesStore(row: { store_id?: string | null }, storeId: string | null) {
  return !storeId || !row.store_id || row.store_id === storeId;
}

function confidence(value: string | null): "high" | "medium" | "low" | "insufficient_data" | null {
  return value === "high" || value === "medium" || value === "low" || value === "insufficient_data"
    ? value
    : null;
}

function comparabilityFacts(
  metric: string,
  caseRow: CaseRow,
  breaks: readonly AdversarialRuntimeBreak[],
): NonNullable<AdversarialRuntimeInput["comparabilityFacts"]> {
  const definitionBreak = breaks.some((item) => item.breakType.includes("definition") || item.breakType.includes("schema") || item.subtype?.includes("definition"));
  const currencyBreak = breaks.some((item) => item.breakType.includes("currency") || item.subtype?.includes("currency"));
  const trackingBreak = breaks.some((item) => item.breakType.includes("tracking") || item.subtype?.includes("pixel") || item.subtype?.includes("attribution") || item.subtype?.includes("consent"));
  const knownShopifyMetric = ["net_sales", "revenue", "orders_count", "conversion_rate"].includes(metric);
  return {
    sameDefinition: definitionBreak ? "no" : knownShopifyMetric ? "yes" : "unknown",
    sameScope: caseRow.scope ? "yes" : "unknown",
    sameCurrency: currencyBreak ? "no" : knownShopifyMetric ? "yes" : "unknown",
    sameStatusFilter: trackingBreak ? "no" : knownShopifyMetric ? "yes" : "unknown",
  };
}

async function loadCaseInput(supabase: any, organizationId: string, row: CaseRow): Promise<AdversarialRuntimeInput> {
  const family = diagnosticFamily(row.target_metric);
  const comparisonStart = row.comparison_period_start ?? row.analysis_period_start;
  const comparisonEnd = row.comparison_period_end ?? row.analysis_period_end;
  const [signalsResult, eventsResult, breaksResult, assessmentsResult, rootCauseResult, ordersResult] = await Promise.all([
    supabase.from("signals")
      .select("metric, data_confidence, low_sample, baseline_conflict, sample_size, window_start, window_end, store_id")
      .eq("organization_id", organizationId)
      .eq("metric", row.target_metric)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase.from("context_change_events")
      .select("event_type, description, occurred_at, source, ended_at, store_id")
      .eq("organization_id", organizationId)
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase.from("context_comparability_breaks")
      .select("break_type, subtype, description, affected_metrics, effective_from, store_id")
      .eq("organization_id", organizationId)
      .order("effective_from", { ascending: false })
      .limit(100),
    supabase.from("context_assessments")
      .select("id, assessed_at")
      .eq("case_id", row.id)
      .order("assessed_at", { ascending: false })
      .limit(1),
    supabase.from("root_causes")
      .select("id")
      .eq("case_id", row.id)
      .order("updated_at", { ascending: false })
      .limit(1),
    supabase.from("shopify_order_facts")
      .select("id, processed_at, external_created_at, store_id, is_test_order")
      .eq("organization_id", organizationId)
      .gte("processed_at", comparisonStart)
      .lt("processed_at", row.analysis_period_end)
      .eq("is_test_order", false)
      .limit(5000),
  ]);

  for (const result of [signalsResult, eventsResult, breaksResult, assessmentsResult, rootCauseResult, ordersResult]) {
    if (result.error) throw new Error(`adversarial_input_load_failed: ${result.error.message}`);
  }

  const signals: AdversarialRuntimeSignal[] = (signalsResult.data ?? [])
    .filter((item: any) => sourceMatchesStore(item, row.store_id) && overlaps(item.window_start, item.window_end, comparisonStart, row.analysis_period_end))
    .map((item: any) => ({
      metric: item.metric,
      dataConfidence: item.data_confidence === "insufficient_data" ? "insufficient_data" : item.data_confidence === "high" || item.data_confidence === "medium" || item.data_confidence === "low" ? item.data_confidence : undefined,
      lowSample: item.low_sample === true,
      baselineConflict: item.baseline_conflict === true,
      sampleSize: item.sample_size ?? undefined,
    }));

  const events: AdversarialRuntimeEvent[] = (eventsResult.data ?? [])
    .filter((item: any) => sourceMatchesStore(item, row.store_id) && overlaps(item.occurred_at, item.ended_at, comparisonStart, row.analysis_period_end))
    .map((item: any) => ({ eventType: item.event_type, description: item.description, occurredAt: item.occurred_at, source: item.source }));

  const breaks: AdversarialRuntimeBreak[] = (breaksResult.data ?? [])
    .filter((item: any) => sourceMatchesStore(item, row.store_id) && Date.parse(item.effective_from) <= Date.parse(row.analysis_period_end))
    .map((item: any) => ({ breakType: item.break_type, subtype: item.subtype, description: item.description, affectedMetrics: item.affected_metrics ?? [], effectiveFrom: item.effective_from }));

  let mixSegments: AdversarialRuntimeMixSegment[] = [];
  const sourceConfounderIds: Record<string, string> = {};
  const assessment = assessmentsResult.data?.[0];
  if (assessment) {
    const [mixResult, contextConfoundersResult] = await Promise.all([
      supabase.from("context_mix_segments")
        .select("dimension, segment, weight_before, weight_after, performance_before, performance_after")
        .eq("assessment_id", assessment.id),
      supabase.from("context_confounders")
        .select("id, variable")
        .eq("assessment_id", assessment.id),
    ]);
    if (mixResult.error) throw new Error(`adversarial_mix_load_failed: ${mixResult.error.message}`);
    if (contextConfoundersResult.error) throw new Error(`adversarial_context_confounders_load_failed: ${contextConfoundersResult.error.message}`);
    for (const item of contextConfoundersResult.data ?? []) {
      const variable = String(item.variable).toLowerCase();
      const type = variable.includes("traffic") ? "traffic_mix"
        : variable.includes("customer") ? "customer_mix"
          : variable.includes("product") ? "product_mix"
            : variable.includes("promotion") ? "promotion"
              : variable.includes("tracking") ? "tracking_change"
                : null;
      if (type && !sourceConfounderIds[type]) sourceConfounderIds[type] = item.id as string;
    }
    mixSegments = (mixResult.data ?? []).map((item: any) => ({
      dimension: item.dimension,
      segment: item.segment,
      weightBefore: Number(item.weight_before),
      weightAfter: Number(item.weight_after),
      performanceBefore: item.performance_before == null ? undefined : Number(item.performance_before),
      performanceAfter: item.performance_after == null ? undefined : Number(item.performance_after),
    }));
  }

  const orderRows = (ordersResult.data ?? []).filter((item: any) => sourceMatchesStore(item, row.store_id));
  return {
    robustnessId: `runtime-${row.id}`,
    caseId: row.id,
    family,
    metric: row.target_metric,
    analysisPeriod: { start: row.analysis_period_start, end: row.analysis_period_end },
    comparisonPeriod: row.comparison_period_start && row.comparison_period_end
      ? { start: row.comparison_period_start, end: row.comparison_period_end }
      : null,
    currentConfidence: confidence(row.confidence),
    comparabilityFacts: comparabilityFacts(row.target_metric, row, breaks),
    sourceConfounderIds,
    signals,
    events,
    comparabilityBreaks: breaks,
    mixSegments,
    orderCounts: { analysis: orderRows.filter((item: any) => overlaps(item.processed_at, item.processed_at, row.analysis_period_start, row.analysis_period_end)).length, comparison: orderRows.filter((item: any) => overlaps(item.processed_at, item.processed_at, comparisonStart, comparisonEnd)).length },
    matureCohortsObservable: false,
  };
}

async function persistReview(supabase: any, organizationId: string, input: AdversarialRuntimeInput) {
  const review = getDiagnosticRobustness(input);

  // Presupuesto de revision: cuantas reaperturas ya confirmo el consultor y si
  // hay una propuesta esperando. Una confirmacion posterior a la ultima
  // revision todavia no ha sido revisada, asi que el caso sigue "confirmado".
  const { data: peticiones, error: peticionesError } = await supabase
    .from("diagnostic_revision_requests")
    .select("id, status, decided_at")
    .eq("case_id", input.caseId);
  if (peticionesError) throw new Error(`adversarial_revisions_load_failed: ${peticionesError.message}`);
  const { data: previa } = await supabase
    .from("diagnostic_robustness")
    .select("reviewed_at")
    .eq("case_id", input.caseId)
    .eq("review_status", "current")
    .maybeSingle();
  const confirmadas = (peticiones ?? []).filter((p: any) => p.status === "confirmed");
  const pendienteDeRevisar = confirmadas.some(
    (p: any) => p.decided_at && previa?.reviewed_at && p.decided_at > previa.reviewed_at,
  );
  const revision = revisionDecision({
    revision_triggered: review.robustness.revision_triggered,
    confirmed_count: confirmadas.length,
    open_proposal: (peticiones ?? []).some((p: any) => p.status === "proposed"),
    confirmation_pending_review: pendienteDeRevisar,
  });

  const { error: checksDeleteError } = await supabase.from("mandatory_confounder_checks").delete().eq("case_id", input.caseId);
  if (checksDeleteError) throw new Error(`adversarial_checks_delete_failed: ${checksDeleteError.message}`);
  const { error: gateDeleteError } = await supabase.from("metric_comparability_gates").delete().eq("case_id", input.caseId);
  if (gateDeleteError) throw new Error(`adversarial_gate_delete_failed: ${gateDeleteError.message}`);
  const { error: supersedeError } = await supabase.from("diagnostic_robustness")
    .update({ review_status: "superseded" })
    .eq("case_id", input.caseId)
    .eq("review_status", "current");
  if (supersedeError) throw new Error(`adversarial_supersede_failed: ${supersedeError.message}`);

  const { data: robustness, error: robustnessError } = await supabase.from("diagnostic_robustness").insert({
    organization_id: organizationId,
    case_id: input.caseId,
    review_status: "current",
    false_diagnosis_risk: review.robustness.false_diagnosis_risk,
    survival_status: review.robustness.survival_status,
    robustness: review.robustness.robustness,
    diagnosis_stability: review.robustness.diagnosis_stability,
    confidence_before: review.robustness.confidence_before ?? null,
    confidence_after: review.robustness.confidence_after ?? null,
    confidence_adjustment: review.robustness.confidence_adjustment ?? null,
    red_team_counter_explanation: review.robustness.red_team_counter_explanation ?? null,
    red_team_supporting_evidence: review.robustness.red_team_supporting_evidence ?? null,
    red_team_required_evidence: review.robustness.red_team_required_evidence ?? null,
    red_team_effect: review.robustness.red_team_effect ?? null,
    revision_triggered: review.robustness.revision_triggered,
    reopened_blocks: review.robustness.reopened_blocks,
    revision_budget_used: revision.budget_used,
    revision_state: revision.state,
    remaining_limitations:
      revision.state === "budget_exhausted"
        ? [review.robustness.remaining_limitations, REVISION_BUDGET_EXHAUSTED_NOTE].filter(Boolean).join(" ")
        : (review.robustness.remaining_limitations ?? null),
  }).select("id").single();
  if (robustnessError || !robustness) throw new Error(`adversarial_robustness_write_failed: ${robustnessError?.message ?? "no row"}`);

  if (revision.state === "budget_exhausted") {
    // Sin mas reaperturas, el caso deja de investigarse: queda no concluyente
    // hasta que entre evidencia nueva y alguien lo vuelva a abrir.
    await supabase
      .from("diagnostic_cases")
      .update({ status: "inconclusive" })
      .eq("id", input.caseId)
      .in("status", ["open", "investigating"]);
  }

  if (revision.propose) {
    const { error: proposalError } = await supabase.from("diagnostic_revision_requests").insert({
      organization_id: organizationId,
      case_id: input.caseId,
      robustness_id: robustness.id,
      reopened_blocks: review.robustness.reopened_blocks,
      attempt: revision.budget_used + 1,
      status: "proposed",
    });
    if (proposalError) throw new Error(`adversarial_revision_proposal_failed: ${proposalError.message}`);
  }

  const confounderIds = new Map<string, string>();
  for (const confounder of review.confounders) {
    const { data: inserted, error } = await supabase.from("diagnostic_confounders").insert({
      organization_id: organizationId,
      case_id: input.caseId,
      robustness_id: robustness.id,
      source_confounder_id: confounder.source_confounder_id ?? null,
      confounder_type: confounder.confounder_type,
      category: confounder.category,
      description: confounder.description,
      affected_claims: [],
      affected_metrics: confounder.affected_metrics,
      scope: confounder.scope,
      evidence: confounder.evidence ?? null,
      plausibility: confounder.plausibility,
      strength: confounder.strength,
      materiality: confounder.materiality,
      status: confounder.status,
      resolution: confounder.resolution,
      adjustment_note: confounder.adjustment_note ?? null,
      confidence_effect: confounder.confidence_effect ?? null,
      masking_effect: confounder.masking_effect,
    }).select("id").single();
    if (error || !inserted) throw new Error(`adversarial_confounder_write_failed: ${error?.message ?? confounder.confounder_type}`);
    confounderIds.set(confounder.confounder_id, inserted.id);
  }

  const tests = review.tests.map((test) => ({
    organization_id: organizationId,
    confounder_id: confounderIds.get(test.confounder_id),
    required_data: test.required_data,
    expected_pattern: test.expected_pattern,
    control_kind: test.control_kind,
    result: test.result,
    effect_on_diagnosis: test.effect_on_diagnosis ?? null,
  })).filter((test) => test.confounder_id);
  if (tests.length > 0) {
    const { error } = await supabase.from("confounder_tests").insert(tests);
    if (error) throw new Error(`adversarial_tests_write_failed: ${error.message}`);
  }

  const { error: gateError } = await supabase.from("metric_comparability_gates").insert({
    organization_id: organizationId,
    case_id: input.caseId,
    metric: input.metric,
    ...review.gates[0],
  });
  if (gateError) throw new Error(`adversarial_gate_write_failed: ${gateError.message}`);

  const checks = review.checks.map((check) => ({
    organization_id: organizationId,
    case_id: input.caseId,
    diagnostic_family: check.diagnostic_family,
    check_key: check.check_key,
    status: check.status,
    outcome: check.outcome ?? null,
    reason: check.reason ?? null,
    executed_at: check.status === "executed" ? new Date().toISOString() : null,
  }));
  if (checks.length > 0) {
    const { error } = await supabase.from("mandatory_confounder_checks").insert(checks);
    if (error) throw new Error(`adversarial_checks_write_failed: ${error.message}`);
  }

  const { error: sensitivityError } = await supabase.from("sensitivity_analyses").insert(review.sensitivity.map((item) => ({
    organization_id: organizationId,
    robustness_id: robustness.id,
    assumption: item.assumption,
    low_case: item.low_case ?? null,
    base_case: item.base_case ?? null,
    high_case: item.high_case ?? null,
    diagnosis_changes: item.diagnosis_changes,
    note: item.note ?? null,
  })));
  if (sensitivityError) throw new Error(`adversarial_sensitivity_write_failed: ${sensitivityError.message}`);

  return { review, robustnessId: robustness.id, confounders: review.confounders.length, checks: review.checks.length };
}

export async function runAdversarialEngine(env: LoadedApiEnv, organizationId: string) {
  const supabase = createServiceClient(env);
  const { data: cases, error } = await supabase.from("diagnostic_cases")
    .select("id, target_metric, scope, store_id, analysis_period_start, analysis_period_end, comparison_period_start, comparison_period_end, confidence")
    .eq("organization_id", organizationId)
    .in("status", ["open", "investigating"]);
  if (error) throw new Error(`diagnostic_cases_load_failed: ${error.message}`);

  const summary = { cases: 0, robustness: 0, confounders: 0, checks: 0 };
  for (const row of (cases ?? []) as CaseRow[]) {
    summary.cases += 1;
    const input = await loadCaseInput(supabase, organizationId, row);
    const result = await persistReview(supabase, organizationId, input);
    summary.robustness += 1;
    summary.confounders += result.confounders;
    summary.checks += result.checks;
  }
  return summary;
}

export async function runAdversarialEngineForAllOrganizations(env: LoadedApiEnv) {
  const supabase = createServiceClient(env);
  const { data: organizations, error } = await supabase.from("organizations")
    .select("id")
    .in("status", ["onboarding", "active"]);
  if (error) throw new Error(`organizations_load_failed: ${error.message}`);

  const summary = { organizations: 0, succeeded: 0, failed: 0, cases: 0, robustness: 0, confounders: 0, checks: 0 };
  for (const organization of organizations ?? []) {
    summary.organizations += 1;
    try {
      const result = await runAdversarialEngine(env, organization.id as string);
      summary.succeeded += 1;
      summary.cases += result.cases;
      summary.robustness += result.robustness;
      summary.confounders += result.confounders;
      summary.checks += result.checks;
    } catch (engineError) {
      summary.failed += 1;
      logger.error("adversarial_engine_org_failed", {
        organization_id: organization.id,
        error: engineError instanceof Error ? engineError.message : String(engineError),
      });
    }
  }
  return summary;
}
