import { type AuthContext, createUserScopedClient } from "./auth-context.js";

type ApiEnv = {
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type PlaybookAssessment = {
  domain: string;
  disposition: string;
  unresolved_unknowns?: string[];
  reason_codes?: string[];
};

export type AiInsightAssessment = PlaybookAssessment & {
  case_id?: string | undefined;
  store_id?: string | null;
  evaluated_at?: string | undefined;
};

export function latestPlaybookAssessments(
  rows: PlaybookAssessment[],
): PlaybookAssessment[] {
  const latest = new Map<string, PlaybookAssessment>();
  for (const row of rows) {
    if (!latest.has(row.domain)) latest.set(row.domain, row);
  }
  return [...latest.values()];
}

export function latestAiAssessments(
  rows: AiInsightAssessment[],
): AiInsightAssessment[] {
  const latest = new Map<string, AiInsightAssessment>();
  for (const row of rows) {
    if (!latest.has(row.domain)) latest.set(row.domain, row);
  }
  return [...latest.values()];
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

function tenantRows(value: unknown, organizationId: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is Record<string, unknown> =>
      Boolean(row) &&
      typeof row === "object" &&
      (row as Record<string, unknown>).organization_id === organizationId,
  );
}

export function f3AssessmentsFromRows(
  outputs: Record<string, unknown>[],
  robustness: Record<string, unknown>[],
  temporal: Record<string, unknown>[],
): AiInsightAssessment[] {
  const assessments: AiInsightAssessment[] = [];

  for (const row of outputs) {
    const finalization = String(row.finalization_status ?? "invalid_output");
    if (finalization === "finalized_valid") continue;
    assessments.push({
      domain: "F3_D14_OUTPUT",
      disposition: "VALIDATION_REQUIRED",
      case_id: typeof row.case_id === "string" ? row.case_id : undefined,
      store_id: typeof row.store_id === "string" ? row.store_id : null,
      evaluated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
      unresolved_unknowns: [
        ...stringArray(row.missing_components),
        ...stringArray(row.blocking_components),
      ],
      reason_codes: [
        "invalid_output",
        ...(typeof row.failure_kind === "string" ? [row.failure_kind] : []),
      ],
    });
  }

  for (const row of robustness) {
    const risk = String(row.false_diagnosis_risk ?? "medium");
    const survival = String(row.survival_status ?? "weakened");
    const robustnessLevel = String(row.robustness ?? "medium");
    if (
      !["high", "critical"].includes(risk) &&
      !["requires_revision", "invalidated"].includes(survival) &&
      robustnessLevel !== "low"
    ) {
      continue;
    }
    assessments.push({
      domain: "F3_D12_ADVERSARIAL",
      disposition: "REASSESS_DIAGNOSIS",
      case_id: typeof row.case_id === "string" ? row.case_id : undefined,
      evaluated_at: typeof row.reviewed_at === "string" ? row.reviewed_at : undefined,
      unresolved_unknowns: typeof row.remaining_limitations === "string"
        ? [row.remaining_limitations]
        : [],
      reason_codes: [
        ...(risk === "high" || risk === "critical" ? [`false_diagnosis_risk_${risk}`] : []),
        ...(survival === "requires_revision" || survival === "invalidated" ? [survival] : []),
        ...(robustnessLevel === "low" ? ["robustness_low"] : []),
      ],
    });
  }

  for (const row of temporal) {
    const trajectory = String(row.trajectory ?? "unknown");
    const sufficiency = String(row.temporal_sufficiency ?? "insufficient");
    const confidence = String(row.trajectory_confidence ?? "unknown");
    if (trajectory !== "unknown" && sufficiency !== "insufficient" && !["unknown", "low"].includes(confidence)) {
      continue;
    }
    assessments.push({
      domain: "F3_D13_TEMPORAL",
      disposition: "VALIDATION_REQUIRED",
      case_id: typeof row.case_id === "string" ? row.case_id : undefined,
      evaluated_at: typeof row.assessed_at === "string" ? row.assessed_at : undefined,
      unresolved_unknowns: [
        ...(trajectory === "unknown" ? ["trajectory_unknown"] : []),
        ...(sufficiency === "insufficient" ? ["temporal_history_insufficient"] : []),
      ],
      reason_codes: [
        ...(confidence === "unknown" || confidence === "low" ? [`trajectory_confidence_${confidence}`] : []),
      ],
    });
  }

  return assessments.sort((left, right) =>
    String(right.evaluated_at ?? "").localeCompare(String(left.evaluated_at ?? "")),
  );
}

export function f7AssessmentsFromRows(
  rows: Record<string, unknown>[],
): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "CANDIDATES_AVAILABLE")
    .map((row) => ({
      domain: "F7_01_ELIGIBILITY",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7MatchingAssessmentsFromRows(
  rows: Record<string, unknown>[],
): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "MATCHES_AVAILABLE")
    .map((row) => ({
      domain: "F7_02_MATCHING",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7PrioritizationAssessmentsFromRows(
  rows: Record<string, unknown>[],
): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "PRIORITY_AVAILABLE")
    .map((row) => ({
      domain: "F7_03_PRIORITIZATION",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7ImpactAssessmentsFromRows(
  rows: Record<string, unknown>[],
): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "IMPACTS_AVAILABLE")
    .map((row) => ({
      domain: "F7_04_IMPACT",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7FeasibilityAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows.filter((row) => String(row.disposition ?? "") !== "FEASIBILITY_AVAILABLE").map((row) => ({ domain: "F7_05_FEASIBILITY", disposition: "VALIDATION_REQUIRED", evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined, unresolved_unknowns: stringArray(row.unresolved_unknowns), reason_codes: stringArray(row.reason_codes) }));
}

export function f7RiskAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows.filter((row) => String(row.disposition ?? "") !== "RISK_ASSESSMENTS_AVAILABLE").map((row) => ({ domain: "F7_06_RISK", disposition: "VALIDATION_REQUIRED", evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined, unresolved_unknowns: stringArray(row.unresolved_unknowns), reason_codes: stringArray(row.reason_codes) }));
}

export function f7SequencingAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows.filter((row) => String(row.disposition ?? "") !== "SEQUENCES_AVAILABLE").map((row) => ({ domain: "F7_07_SEQUENCING", disposition: "VALIDATION_REQUIRED", evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined, unresolved_unknowns: stringArray(row.unresolved_unknowns), reason_codes: stringArray(row.reason_codes) }));
}

export function f7TestExecuteAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows.filter((row) => {
    if (String(row.disposition ?? "") !== "DECISIONS_AVAILABLE") return true;
    const result = row.result && typeof row.result === "object" ? row.result as Record<string, unknown> : {};
    const candidates = Array.isArray(result.candidate_evaluations) ? result.candidate_evaluations : [];
    return candidates.some((candidate) => candidate && typeof candidate === "object" && String((candidate as Record<string, unknown>).recommended_mode ?? "") !== "DIRECT_EXECUTION");
  }).map((row) => ({ domain: "F7_08_TEST_EXECUTE", disposition: "VALIDATION_REQUIRED", evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined, unresolved_unknowns: stringArray(row.unresolved_unknowns), reason_codes: stringArray(row.reason_codes) }));
}

export function f7IntensityAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows.filter((row) => String(row.disposition ?? "") !== "INTENSITY_PROFILES_AVAILABLE").map((row) => ({ domain: "F7_09_INTENSITY", disposition: "VALIDATION_REQUIRED", evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined, unresolved_unknowns: stringArray(row.unresolved_unknowns), reason_codes: stringArray(row.reason_codes) }));
}

export function f7MaturityAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "MATURITY_RECOMMENDATIONS_AVAILABLE")
    .map((row) => ({
      domain: "F7_10_MATURITY",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7ConstraintAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "CONSTRAINT_RECOMMENDATIONS_AVAILABLE")
    .map((row) => ({
      domain: "F7_11_CONSTRAINTS",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7PortfolioAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "PORTFOLIO_AVAILABLE")
    .map((row) => ({
      domain: "F7_12_PORTFOLIO",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7DynamicDecisionAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "DECISIONS_AVAILABLE")
    .map((row) => ({
      domain: "F7_13_DYNAMIC_DECISION",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7RestraintDecisionAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "DECISION_AVAILABLE")
    .map((row) => ({
      domain: "F7_14_RESTRAINT_DECISION",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7ExpectedOutcomeAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "OUTCOME_CRITERIA_AVAILABLE")
    .map((row) => ({
      domain: "F7_15_EXPECTED_OUTCOME",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7RecommendationConfidenceAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "CONFIDENCE_AVAILABLE")
    .map((row) => ({
      domain: "F7_17_RECOMMENDATION_CONFIDENCE",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f7RecommendationCommunicationAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => String(row.disposition ?? "") !== "COMMUNICATION_AVAILABLE")
    .map((row) => ({
      domain: "F7_18_RECOMMENDATION_COMMUNICATION",
      disposition: "VALIDATION_REQUIRED",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export function f8HitlApprovalAssessmentsFromRows(rows: Record<string, unknown>[]): AiInsightAssessment[] {
  return rows
    .filter((row) => ["APPROVAL_REQUIRED", "ESCALATION_REQUIRED", "HUMAN_ONLY", "VALIDATION_REQUIRED"].includes(String(row.disposition ?? "")))
    .map((row) => ({
      domain: "F8_02_HITL_APPROVAL",
      disposition: String(row.disposition),
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : undefined,
      unresolved_unknowns: stringArray(row.unresolved_unknowns),
      reason_codes: stringArray(row.reason_codes),
    }));
}

export async function listConsultantAiPlaybookInsights(
  env: ApiEnv,
  authorization: string,
  context: AuthContext,
  organizationId: string | undefined,
) {
  if (!["consultant", "platform_admin"].includes(context.profile.platform_role)) {
    return { ok: false as const, statusCode: 403, error: "consultant_only" };
  }
  if (!organizationId) return { ok: true as const, data: { assessments: [] } };

  const supabase = createUserScopedClient(env, authorization.slice("Bearer ".length)) as any;
  const [playbookResult, outputResult, robustnessResult, temporalResult, eligibilityResult, matchingResult, prioritizationResult, impactResult, feasibilityResult, riskResult, sequencingResult, testExecuteResult, intensityResult, maturityResult, constraintResult, portfolioResult, dynamicDecisionResult, restraintDecisionResult, expectedOutcomeResult, recommendationConfidenceResult, recommendationCommunicationResult, hitlApprovalResult] = await Promise.all([
    supabase
      .from("playbook_framework_runs")
      .select("organization_id, domain, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(300),
    supabase
      .from("diagnostic_outputs")
      .select("organization_id, case_id, store_id, finalization_status, missing_components, blocking_components, failure_kind, updated_at")
      .eq("organization_id", organizationId)
      .eq("is_current", true)
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("diagnostic_robustness")
      .select("organization_id, case_id, review_status, false_diagnosis_risk, survival_status, robustness, remaining_limitations, reviewed_at")
      .eq("organization_id", organizationId)
      .eq("review_status", "current")
      .order("reviewed_at", { ascending: false })
      .limit(100),
    supabase
      .from("temporal_diagnoses")
      .select("organization_id, case_id, assessment_status, trajectory, trajectory_confidence, temporal_sufficiency, assessed_at")
      .eq("organization_id", organizationId)
      .eq("assessment_status", "current")
      .order("assessed_at", { ascending: false })
      .limit(100),
    supabase
      .from("intervention_eligibility_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("intervention_matching_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("intervention_prioritization_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("intervention_impact_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("intervention_feasibility_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("intervention_risk_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("intervention_sequencing_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("intervention_test_execute_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at, result")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("intervention_intensity_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("maturity_recommendation_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("constraint_recommendation_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("recommendation_portfolio_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("dynamic_decision_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("restraint_decision_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("expected_outcome_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("recommendation_confidence_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("recommendation_communication_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
    supabase
      .from("hitl_approval_assessment_runs")
      .select("organization_id, disposition, unresolved_unknowns, reason_codes, evaluated_at")
      .eq("organization_id", organizationId)
      .order("evaluated_at", { ascending: false })
      .limit(30),
  ]);

  const error = playbookResult.error ?? outputResult.error ?? robustnessResult.error ?? temporalResult.error ?? eligibilityResult.error ?? matchingResult.error ?? prioritizationResult.error ?? impactResult.error ?? feasibilityResult.error ?? riskResult.error ?? sequencingResult.error ?? testExecuteResult.error ?? intensityResult.error ?? maturityResult.error ?? constraintResult.error ?? portfolioResult.error ?? dynamicDecisionResult.error ?? restraintDecisionResult.error ?? expectedOutcomeResult.error ?? recommendationConfidenceResult.error ?? recommendationCommunicationResult.error ?? hitlApprovalResult.error;
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "ai_playbook_insights_load_failed",
      detail: error.message,
    };
  }

  return {
    ok: true as const,
    data: {
      assessments: latestAiAssessments([
        ...latestPlaybookAssessments(
          tenantRows(playbookResult.data, organizationId) as PlaybookAssessment[],
        ),
        ...f3AssessmentsFromRows(
          tenantRows(outputResult.data, organizationId),
          tenantRows(robustnessResult.data, organizationId),
          tenantRows(temporalResult.data, organizationId),
        ),
        ...f7AssessmentsFromRows(tenantRows(eligibilityResult.data, organizationId)),
        ...f7MatchingAssessmentsFromRows(tenantRows(matchingResult.data, organizationId)),
        ...f7PrioritizationAssessmentsFromRows(tenantRows(prioritizationResult.data, organizationId)),
        ...f7ImpactAssessmentsFromRows(tenantRows(impactResult.data, organizationId)),
        ...f7FeasibilityAssessmentsFromRows(tenantRows(feasibilityResult.data, organizationId)),
        ...f7RiskAssessmentsFromRows(tenantRows(riskResult.data, organizationId)),
        ...f7SequencingAssessmentsFromRows(tenantRows(sequencingResult.data, organizationId)),
        ...f7TestExecuteAssessmentsFromRows(tenantRows(testExecuteResult.data, organizationId)),
        ...f7IntensityAssessmentsFromRows(tenantRows(intensityResult.data, organizationId)),
        ...f7MaturityAssessmentsFromRows(tenantRows(maturityResult.data, organizationId)),
        ...f7ConstraintAssessmentsFromRows(tenantRows(constraintResult.data, organizationId)),
        ...f7PortfolioAssessmentsFromRows(tenantRows(portfolioResult.data, organizationId)),
        ...f7DynamicDecisionAssessmentsFromRows(tenantRows(dynamicDecisionResult.data, organizationId)),
        ...f7RestraintDecisionAssessmentsFromRows(tenantRows(restraintDecisionResult.data, organizationId)),
        ...f7ExpectedOutcomeAssessmentsFromRows(tenantRows(expectedOutcomeResult.data, organizationId)),
        ...f7RecommendationConfidenceAssessmentsFromRows(tenantRows(recommendationConfidenceResult.data, organizationId)),
        ...f7RecommendationCommunicationAssessmentsFromRows(tenantRows(recommendationCommunicationResult.data, organizationId)),
        ...f8HitlApprovalAssessmentsFromRows(tenantRows(hitlApprovalResult.data, organizationId)),
      ]),
    },
  };
}
