import { z } from "zod";

/**
 * F7.10 adapta una intervencion ya propuesta al nivel real de capacidad que
 * puede absorber el ecommerce. No clasifica el negocio por revenue, no calcula
 * un score y no autoriza cambios.
 */
export const MATURITY_RECOMMENDATION_DISPOSITIONS = [
  "MATURITY_RECOMMENDATIONS_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_MATURITY_CANDIDATES",
] as const;
export type MaturityRecommendationDisposition =
  (typeof MATURITY_RECOMMENDATION_DISPOSITIONS)[number];

export const MATURITY_RECOMMENDATION_MODES = [
  "LEARN_VALIDATE",
  "BUILD_CAPABILITY_FIRST",
  "SIMPLIFY",
  "STANDARDIZE_IMPROVE",
  "PROTECT_MARGINAL_ECONOMICS",
  "OPTIMIZE_ALLOCATION",
  "COORDINATE_RESILIENCE",
  "MAINTAIN_FOCUS",
  "VALIDATE_CONTEXT",
] as const;
export type MaturityRecommendationMode = (typeof MATURITY_RECOMMENDATION_MODES)[number];

const refs = z.array(z.string().min(1));

/**
 * Los stages, la madurez funcional y la capacidad de absorción son texto
 * deliberadamente abierto: el artefacto los define como modelo conceptual,
 * no como una taxonomía técnica cerrada ni como thresholds automáticos.
 */
export const maturityRecommendationInputSchema = z.object({
  candidate_id: z.string().min(1),
  selected_intervention: z.string().min(1),
  business_stage: z.string().min(1),
  functional_maturity: z.string().min(1),
  intervention_readiness: z.string().min(1),
  existing_capabilities: refs,
  missing_capabilities: refs,
  evidence: refs,
  risk: refs,
  resource_constraints: refs,
  current_mode: z.string().min(1),
  current_bottleneck: z.string().min(1),
  local_reset: z.boolean(),
  absorption_capacity: z.string().min(1),
  candidate_complexity: z.string().min(1),
  focus_capacity: z.string().min(1),
  organization_complexity: refs,
  current_debt: refs,
  current_recommendation: z.string().min(1),
  deferred_recommendation: z.string().min(1),
  not_yet_reason: z.string(),
  capability_to_build: z.string(),
  maturity_unlock: refs,
  unresolved_unknowns: refs,
  evidence_refs: refs,
  source_refs: refs,
});
export type MaturityRecommendationInput = z.input<typeof maturityRecommendationInputSchema>;

export const maturityRecommendationResultSchema = maturityRecommendationInputSchema.extend({
  functional_maturity: z.string().min(1),
  recommended_mode: z.enum(MATURITY_RECOMMENDATION_MODES),
  complexity_decision: z.enum(["APPROPRIATE", "TOO_COMPLEX", "VALIDATION_REQUIRED"]),
  timing_fit: z.enum(["NOW", "LATER", "VALIDATION_REQUIRED"]),
  current_recommendation: z.string().min(1),
  deferred_recommendation: z.string().min(1),
  not_yet_reason: z.string().nullable(),
  missing_capability: z.string().nullable(),
  capability_building_recommendation: z.string().nullable(),
  evidence_standard: z.string().min(1),
  rationale: refs,
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type MaturityRecommendationResult = z.infer<typeof maturityRecommendationResultSchema>;

export const maturityRecommendationRunResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(MATURITY_RECOMMENDATION_DISPOSITIONS),
  candidate_evaluations: z.array(maturityRecommendationResultSchema),
  primary_priority_candidate_id: z.string().min(1).nullable(),
  reason_codes: refs,
  unresolved_unknowns: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type MaturityRecommendationRunResult = z.infer<typeof maturityRecommendationRunResultSchema>;

const unique = (values: string[]) => [...new Set(values)];

function fallback(raw: Partial<MaturityRecommendationInput>, reasons: string[], unknowns: string[]) {
  const candidateId = typeof raw.candidate_id === "string" ? raw.candidate_id : "invalid-candidate";
  return maturityRecommendationResultSchema.parse({
    candidate_id: candidateId,
    selected_intervention: typeof raw.selected_intervention === "string" ? raw.selected_intervention : "intervention not defined",
    business_stage: "UNKNOWN",
    functional_maturity: "UNKNOWN",
    intervention_readiness: "UNKNOWN",
    existing_capabilities: [],
    missing_capabilities: [],
    evidence: [],
    risk: [],
    resource_constraints: [],
    current_mode: "UNKNOWN",
    current_bottleneck: "UNKNOWN",
    local_reset: false,
    absorption_capacity: "UNKNOWN",
    candidate_complexity: "UNKNOWN",
    focus_capacity: "UNKNOWN",
    organization_complexity: [],
    current_debt: [],
    current_recommendation: "Validar el contexto de madurez antes de recomendar una intervención",
    deferred_recommendation: "UNKNOWN",
    not_yet_reason: "Falta contexto suficiente para distinguir una buena idea de una buena idea ahora",
    capability_to_build: "",
    maturity_unlock: [],
    unresolved_unknowns: unique([...unknowns, "maturity_context"]),
    evidence_refs: [],
    source_refs: [],
    recommended_mode: "VALIDATE_CONTEXT",
    complexity_decision: "VALIDATION_REQUIRED",
    timing_fit: "VALIDATION_REQUIRED",
    missing_capability: null,
    capability_building_recommendation: null,
    evidence_standard: "Contexto de madurez y readiness verificables",
    rationale: unique(reasons),
    execution_authorized: false,
    deterministic: true,
  });
}

function isUnknown(value: string) {
  return ["UNKNOWN", "NOT_ASSESSED", "UNAVAILABLE", ""].includes(value.toUpperCase());
}

function isLowCapacity(value: string) {
  return ["LOW", "LIMITED", "BASIC", "INSUFFICIENT"].includes(value.toUpperCase());
}

function isAdvanced(value: string) {
  return ["ADVANCED", "HIGH", "COMPLEX"].includes(value.toUpperCase());
}

export function evaluateMaturityRecommendation(
  raw: MaturityRecommendationInput,
): MaturityRecommendationResult {
  const parsed = maturityRecommendationInputSchema.safeParse(raw);
  if (!parsed.success) {
    return fallback(raw as Partial<MaturityRecommendationInput>, ["MATURITY.INPUT_SCHEMA_INVALID"], ["input_schema"]);
  }

  const input = parsed.data;
  const unknowns = [...input.unresolved_unknowns];
  const rationale: string[] = [];
  const readinessUnknown = isUnknown(input.intervention_readiness);
  if (readinessUnknown) {
    unknowns.push("intervention_readiness");
    rationale.push("MATURITY.READINESS_UNKNOWN");
  }
  if (isUnknown(input.functional_maturity)) {
    unknowns.push("functional_maturity");
    rationale.push("MATURITY.FUNCTIONAL_MATURITY_UNKNOWN");
  }

  let mode: MaturityRecommendationMode = "MAINTAIN_FOCUS";
  let complexityDecision: "APPROPRIATE" | "TOO_COMPLEX" | "VALIDATION_REQUIRED" = "APPROPRIATE";
  let timingFit: "NOW" | "LATER" | "VALIDATION_REQUIRED" = "NOW";
  let currentRecommendation = input.current_recommendation;
  let notYetReason: string | null = input.not_yet_reason || null;
  let missingCapability: string | null = input.missing_capabilities[0] ?? null;
  let capabilityBuildingRecommendation: string | null = input.capability_to_build || null;

  if (readinessUnknown || isUnknown(input.functional_maturity)) {
    mode = "VALIDATE_CONTEXT";
    complexityDecision = "VALIDATION_REQUIRED";
    timingFit = "VALIDATION_REQUIRED";
    notYetReason ??= "Falta readiness o madurez funcional verificable";
  } else if (input.local_reset) {
    mode = "LEARN_VALIDATE";
    rationale.push("MATURITY.LOCAL_RESET_REQUIRES_LEARNING");
  } else if (input.missing_capabilities.length > 0 && ["NOT_READY", "PARTIAL", "LOW"].includes(input.intervention_readiness.toUpperCase())) {
    mode = "BUILD_CAPABILITY_FIRST";
    timingFit = "LATER";
    rationale.push("MATURITY.MISSING_CAPABILITY_BLOCKS_INTERVENTION");
    notYetReason ??= `La intervención necesita antes: ${input.missing_capabilities.join(", ")}`;
    if (!capabilityBuildingRecommendation) {
      capabilityBuildingRecommendation = `Construir primero ${input.missing_capabilities[0]}`;
    }
    currentRecommendation = capabilityBuildingRecommendation;
  } else if (isLowCapacity(input.absorption_capacity) && isAdvanced(input.candidate_complexity)) {
    mode = "SIMPLIFY";
    complexityDecision = "TOO_COMPLEX";
    timingFit = "LATER";
    rationale.push("MATURITY.COMPLEXITY_EXCEEDS_ABSORPTION");
    notYetReason ??= "La sofisticación propuesta supera la capacidad de absorción actual";
  } else {
    const normalizedMode = input.current_mode.toLowerCase();
    if (["validation", "learning", "commercial_fit", "exploration"].includes(normalizedMode)) {
      mode = "LEARN_VALIDATE";
    } else if (["repeatability", "standardize", "standardization"].includes(normalizedMode)) {
      mode = "STANDARDIZE_IMPROVE";
    } else if (normalizedMode === "scaling") {
      mode = "PROTECT_MARGINAL_ECONOMICS";
    } else if (["mature", "optimization", "optimize"].includes(normalizedMode)) {
      mode = "OPTIMIZE_ALLOCATION";
    } else if (["complex", "coordination"].includes(normalizedMode) || input.organization_complexity.length > 0) {
      mode = "COORDINATE_RESILIENCE";
    }
    rationale.push("MATURITY.STAGE_APPROPRIATE_RECOMMENDATION");
  }

  if (input.current_debt.length > 0 && !["VALIDATE_CONTEXT", "BUILD_CAPABILITY_FIRST"].includes(mode)) {
    rationale.push("MATURITY.STABILIZATION_DEBT_PRESENT");
    currentRecommendation = input.current_recommendation;
  }
  if (input.evidence.length === 0) {
    unknowns.push("evidence");
  }
  const evidenceStandard = input.business_stage.toLowerCase() === "validation"
    ? "Evidencia direccional o cualitativa con exposición pequeña y reversible"
    : "Evidencia suficiente para el alcance, riesgo y blast radius de la intervención";

  return maturityRecommendationResultSchema.parse({
    ...input,
    current_recommendation: currentRecommendation,
    deferred_recommendation: input.deferred_recommendation,
    not_yet_reason: notYetReason,
    missing_capability: missingCapability,
    capability_building_recommendation: capabilityBuildingRecommendation,
    recommended_mode: mode,
    complexity_decision: complexityDecision,
    timing_fit: timingFit,
    evidence_standard: evidenceStandard,
    unresolved_unknowns: unique(unknowns),
    rationale: unique(rationale),
    execution_authorized: false,
    deterministic: true,
  });
}

export function evaluateMaturityRecommendationSet(input: {
  context_id: string;
  business_id: string;
  decision_cycle_id: string;
  primary_priority_candidate_id: string | null;
  candidates: MaturityRecommendationInput[];
  evaluated_at: string;
}): MaturityRecommendationRunResult {
  const evaluations = input.candidates.map(evaluateMaturityRecommendation);
  const usable = evaluations.some((item) => item.timing_fit !== "VALIDATION_REQUIRED");
  return maturityRecommendationRunResultSchema.parse({
    context_id: input.context_id,
    business_id: input.business_id,
    decision_cycle_id: input.decision_cycle_id,
    disposition: evaluations.length === 0
      ? "NO_MATURITY_CANDIDATES"
      : usable
        ? "MATURITY_RECOMMENDATIONS_AVAILABLE"
        : "VALIDATION_REQUIRED",
    candidate_evaluations: evaluations,
    primary_priority_candidate_id: input.primary_priority_candidate_id,
    reason_codes: unique(evaluations.flatMap((item) => item.rationale)),
    unresolved_unknowns: unique(evaluations.flatMap((item) => item.unresolved_unknowns)),
    source_refs: unique(evaluations.flatMap((item) => item.source_refs)),
    evaluated_at: input.evaluated_at,
    execution_authorized: false,
    deterministic: true,
  });
}
