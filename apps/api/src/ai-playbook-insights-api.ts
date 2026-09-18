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
  const [playbookResult, outputResult, robustnessResult, temporalResult, eligibilityResult, matchingResult] = await Promise.all([
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
  ]);

  const error = playbookResult.error ?? outputResult.error ?? robustnessResult.error ?? temporalResult.error ?? eligibilityResult.error ?? matchingResult.error;
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
      ]),
    },
  };
}
