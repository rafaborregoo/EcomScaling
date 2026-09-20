import { z } from "zod";

/** F7.12 construye una cartera deliberada; no optimiza ni asigna recursos. */
export const RECOMMENDATION_PORTFOLIO_DISPOSITIONS = [
  "PORTFOLIO_AVAILABLE",
  "VALIDATION_REQUIRED",
  "NO_PORTFOLIO_CANDIDATES",
] as const;
export type RecommendationPortfolioDisposition = (typeof RECOMMENDATION_PORTFOLIO_DISPOSITIONS)[number];

export const RECOMMENDATION_PORTFOLIO_ROLES = [
  "PRIMARY",
  "ENABLING",
  "SUPPORTING",
  "PARALLEL",
  "DEFERRED",
  "EXCLUDED",
] as const;
export type RecommendationPortfolioRole = (typeof RECOMMENDATION_PORTFOLIO_ROLES)[number];

const refs = z.array(z.string().min(1));

export const recommendationPortfolioCandidateInputSchema = z.object({
  candidate_id: z.string().min(1),
  intervention: z.string().min(1),
  desired_role: z.string().min(1),
  status: z.string().min(1),
  horizon: z.string().min(1),
  problem: z.string().min(1),
  expected_outcome: z.string().min(1),
  causal_mechanism: z.string().min(1),
  priority_context: z.string().min(1),
  entry_reason: z.string().min(1),
  deferral_reason: z.string(),
  reentry_trigger: z.string(),
  dependencies: refs,
  shared_resources: refs,
  evidence_status: z.string().min(1),
  individual_feasibility: z.string().min(1),
  individual_risk: z.string().min(1),
  reversibility: z.string().min(1),
  conflict_with: refs,
  supports_candidate_ids: refs,
  enables_candidate_ids: refs,
  duplicate_of: z.string(),
  explicit_exclusion: z.boolean(),
  source_refs: refs,
});
export type RecommendationPortfolioCandidateInput = z.input<typeof recommendationPortfolioCandidateInputSchema>;

export const recommendationPortfolioInputSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  strategic_objective: z.string().min(1),
  dominant_priority: z.string().min(1),
  candidates: z.array(recommendationPortfolioCandidateInputSchema),
  existing_initiatives: refs,
  current_portfolio: refs,
  current_wip: z.string().min(1),
  available_capacity: z.string().min(1),
  shared_resources: refs,
  management_attention: z.string().min(1),
  aggregate_capacity: z.string().min(1),
  resource_conflicts: refs,
  portfolio_constraints: refs,
  strategic_theme: z.string().min(1),
  current_portfolio_complexity: z.string().min(1),
  current_risk_state: z.string().min(1),
  evidence_quality: z.string().min(1),
  timing_context: z.string().min(1),
  source_refs: refs,
  unresolved_unknowns: refs,
});
export type RecommendationPortfolioInput = z.input<typeof recommendationPortfolioInputSchema>;

export const recommendationPortfolioCandidateResultSchema = recommendationPortfolioCandidateInputSchema.extend({
  role: z.enum(RECOMMENDATION_PORTFOLIO_ROLES),
  selection_status: z.enum(["ACTIVE", "DEFERRED", "EXCLUDED", "VALIDATION_REQUIRED"]),
  role_reason: z.string().min(1),
  sequence_position: z.enum(["FIRST", "TOGETHER", "LATER", "OUTSIDE_PORTFOLIO"]),
});
export type RecommendationPortfolioCandidateResult = z.infer<typeof recommendationPortfolioCandidateResultSchema>;

export const recommendationPortfolioResultSchema = z.object({
  context_id: z.string().min(1),
  business_id: z.string().min(1),
  decision_cycle_id: z.string().min(1),
  disposition: z.enum(RECOMMENDATION_PORTFOLIO_DISPOSITIONS),
  strategic_objective: z.string().min(1),
  dominant_priority: z.string().min(1),
  primary_candidate_id: z.string().min(1).nullable(),
  candidate_evaluations: z.array(recommendationPortfolioCandidateResultSchema),
  active_candidate_ids: refs,
  deferred_candidate_ids: refs,
  excluded_candidate_ids: refs,
  explicit_exclusions: refs,
  sequence: refs,
  conditional_branches: refs,
  aggregate_resource_load: refs,
  portfolio_feasibility: z.enum(["FEASIBLE", "FEASIBLE_WITH_DEFERRED", "VALIDATION_REQUIRED", "NOT_FEASIBLE"]),
  portfolio_risk: z.string().min(1),
  portfolio_confidence: z.string().min(1),
  portfolio_narrative: z.string().min(1),
  quality_flags: refs,
  unresolved_unknowns: refs,
  reason_codes: refs,
  source_refs: refs,
  evaluated_at: z.string().datetime(),
  execution_authorized: z.literal(false),
  deterministic: z.literal(true),
});
export type RecommendationPortfolioResult = z.infer<typeof recommendationPortfolioResultSchema>;

const unique = (values: string[]) => [...new Set(values)];
const normalize = (value: string) => value.trim().toUpperCase();
const isUnknown = (value: string) => ["", "UNKNOWN", "UNAVAILABLE", "NOT_ASSESSED"].includes(normalize(value));
const isBlocked = (value: string) => ["BLOCKED", "NOT_FEASIBLE", "VALIDATION_REQUIRED"].includes(normalize(value));

function fallback(raw: Partial<RecommendationPortfolioInput>, reasons: string[], unknowns: string[], evaluatedAt: string): RecommendationPortfolioResult {
  const contextId = typeof raw.context_id === "string" ? raw.context_id : "invalid-context";
  const businessId = typeof raw.business_id === "string" ? raw.business_id : "invalid-business";
  const cycleId = typeof raw.decision_cycle_id === "string" ? raw.decision_cycle_id : "invalid-cycle";
  const objective = typeof raw.strategic_objective === "string" ? raw.strategic_objective : "UNKNOWN";
  return recommendationPortfolioResultSchema.parse({
    context_id: contextId, business_id: businessId, decision_cycle_id: cycleId, disposition: "VALIDATION_REQUIRED", strategic_objective: objective,
    dominant_priority: typeof raw.dominant_priority === "string" ? raw.dominant_priority : "UNKNOWN", primary_candidate_id: null, candidate_evaluations: [], active_candidate_ids: [], deferred_candidate_ids: [], excluded_candidate_ids: [], explicit_exclusions: [], sequence: [], conditional_branches: [], aggregate_resource_load: [], portfolio_feasibility: "VALIDATION_REQUIRED", portfolio_risk: "UNKNOWN", portfolio_confidence: "LOW", portfolio_narrative: "Validar la cartera antes de recomendar trabajo simultáneo", quality_flags: unique(reasons), unresolved_unknowns: unique([...unknowns, "portfolio_context"]), reason_codes: unique(reasons), source_refs: refsFrom(raw.source_refs), evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
  });
}

function refsFrom(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : []; }

export function evaluateRecommendationPortfolio(raw: RecommendationPortfolioInput, evaluatedAt = new Date().toISOString()): RecommendationPortfolioResult {
  const parsed = recommendationPortfolioInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<RecommendationPortfolioInput>, ["PORTFOLIO.INPUT_SCHEMA_INVALID"], ["input_schema"], evaluatedAt);
  const input = parsed.data;
  if (input.candidates.length === 0) {
    return recommendationPortfolioResultSchema.parse({
      context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: "NO_PORTFOLIO_CANDIDATES", strategic_objective: input.strategic_objective, dominant_priority: input.dominant_priority, primary_candidate_id: null, candidate_evaluations: [], active_candidate_ids: [], deferred_candidate_ids: [], excluded_candidate_ids: [], explicit_exclusions: [], sequence: [], conditional_branches: [], aggregate_resource_load: [], portfolio_feasibility: "VALIDATION_REQUIRED", portfolio_risk: input.current_risk_state, portfolio_confidence: "LOW", portfolio_narrative: "No hay candidatos de intervención para construir una cartera", quality_flags: ["PORTFOLIO.EMPTY"], unresolved_unknowns: unique([...input.unresolved_unknowns, "candidates"]), reason_codes: ["PORTFOLIO.NO_CANDIDATES"], source_refs: input.source_refs, evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
    });
  }

  const unknowns = [...input.unresolved_unknowns];
  const reasons: string[] = [];
  const primary = input.candidates.find((item) => item.candidate_id === input.dominant_priority);
  const capacityUnknown = isUnknown(input.aggregate_capacity) || isUnknown(input.available_capacity) || isUnknown(input.management_attention);
  if (!primary) unknowns.push("dominant_priority_candidate");
  if (capacityUnknown) unknowns.push("aggregate_capacity");
  if (!primary || capacityUnknown || isBlocked(primary.individual_feasibility)) {
    return fallback({ ...input, source_refs: input.source_refs }, ["PORTFOLIO.PRIMARY_OR_CAPACITY_REQUIRES_VALIDATION"], unknowns, evaluatedAt);
  }

  const evaluations: RecommendationPortfolioCandidateResult[] = [];
  const active: string[] = [];
  const deferred: string[] = [];
  const excluded: string[] = [];
  const explicitExclusions: string[] = [];
  const sequence: string[] = [];
  const branches: string[] = [];
  const qualityFlags = ["PORTFOLIO.PRIMARY_VISIBLE", "PORTFOLIO.MINIMUM_SUFFICIENT_SET"];
  for (const candidate of input.candidates) {
    let role: RecommendationPortfolioRole = "DEFERRED";
    let selectionStatus: "ACTIVE" | "DEFERRED" | "EXCLUDED" | "VALIDATION_REQUIRED" = "DEFERRED";
    let roleReason = candidate.entry_reason;
    let sequencePosition: "FIRST" | "TOGETHER" | "LATER" | "OUTSIDE_PORTFOLIO" = "LATER";
    const candidateRole = normalize(candidate.desired_role);
    const explicitDeferred = candidateRole === "DEFERRED" || normalize(candidate.horizon) === "LATER" || normalize(candidate.status) === "DEFERRED";
    const conflict = candidate.candidate_id !== primary.candidate_id && (candidate.conflict_with.includes(primary.candidate_id) || input.resource_conflicts.some((item) => item.includes(`${primary.candidate_id}|${candidate.candidate_id}`) || item.includes(`${candidate.candidate_id}|${primary.candidate_id}`)));
    if (candidate.duplicate_of || candidate.explicit_exclusion || candidateRole === "EXCLUDED") {
      role = "EXCLUDED"; selectionStatus = "EXCLUDED"; sequencePosition = "OUTSIDE_PORTFOLIO"; roleReason = candidate.duplicate_of ? `Consolidada en ${candidate.duplicate_of}` : candidate.entry_reason; excluded.push(candidate.candidate_id); explicitExclusions.push(`${candidate.candidate_id}: ${roleReason}`);
    } else if (candidate.candidate_id === primary.candidate_id) {
      role = "PRIMARY"; selectionStatus = "ACTIVE"; sequencePosition = "FIRST"; active.push(candidate.candidate_id); roleReason = "Intervención dominante de la prioridad actual"; reasons.push("PORTFOLIO.PRIMARY_SELECTED");
    } else if (conflict) {
      role = "DEFERRED"; selectionStatus = "DEFERRED"; sequencePosition = "LATER"; deferred.push(candidate.candidate_id); sequence.push(`${candidate.candidate_id} after ${primary.candidate_id}: interference or shared resource conflict`); qualityFlags.push("INTERFERENCE_REQUIRES_SEQUENCE"); roleReason = "No se ejecuta junto a la Primary por interferencia o recurso compartido";
    } else if (explicitDeferred) {
      role = "DEFERRED"; selectionStatus = "DEFERRED"; sequencePosition = "LATER"; deferred.push(candidate.candidate_id); roleReason = candidate.deferral_reason || "Válida pero no ahora"; if (candidate.reentry_trigger) branches.push(`${candidate.candidate_id} when ${candidate.reentry_trigger}`);
    } else if (["ENABLING", "SUPPORTING", "PARALLEL"].includes(candidateRole)) {
      role = candidateRole as RecommendationPortfolioRole; selectionStatus = "ACTIVE"; sequencePosition = candidateRole === "ENABLING" ? "FIRST" : "TOGETHER"; active.push(candidate.candidate_id);
    } else {
      role = "DEFERRED"; selectionStatus = "DEFERRED"; deferred.push(candidate.candidate_id); roleReason = "Rol o encaje conjunto no suficientemente declarado"; unknowns.push(`role:${candidate.candidate_id}`);
    }
    evaluations.push({ ...candidate, role, selection_status: selectionStatus, role_reason: roleReason, sequence_position: sequencePosition });
  }
  const activeResources = unique(evaluations.filter((item) => item.selection_status === "ACTIVE").flatMap((item) => item.shared_resources));
  const portfolioFeasibility = deferred.length > 0 ? "FEASIBLE_WITH_DEFERRED" : "FEASIBLE";
  const portfolioRisk = input.resource_conflicts.length > 0 || evaluations.filter((item) => item.selection_status === "ACTIVE").filter((item) => ["HIGH", "CRITICAL"].includes(normalize(item.individual_risk))).length > 1 ? "STACKING_REVIEW_REQUIRED" : input.current_risk_state;
  if (portfolioRisk === "STACKING_REVIEW_REQUIRED") qualityFlags.push("PORTFOLIO.RISK_STACKING_REVIEW");
  const narrative = `Primary: ${primary.intervention}. ${evaluations.filter((item) => item.role === "ENABLING").length ? "Enabling actions unlock the primary. " : ""}${evaluations.filter((item) => item.role === "SUPPORTING").length ? "Supporting actions materially reinforce it. " : ""}${evaluations.filter((item) => item.role === "PARALLEL").length ? "Independent parallel work remains bounded. " : ""}${deferred.length ? "Valid but lower-fit or conflicting actions remain deferred. " : ""}Excluded actions are explicit to preserve focus.`;
  return recommendationPortfolioResultSchema.parse({
    context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: "PORTFOLIO_AVAILABLE", strategic_objective: input.strategic_objective, dominant_priority: input.dominant_priority, primary_candidate_id: primary.candidate_id, candidate_evaluations: evaluations, active_candidate_ids: active, deferred_candidate_ids: deferred, excluded_candidate_ids: excluded, explicit_exclusions: explicitExclusions, sequence, conditional_branches: branches, aggregate_resource_load: activeResources, portfolio_feasibility: portfolioFeasibility, portfolio_risk: portfolioRisk, portfolio_confidence: unknowns.length ? "LOWER_CONFIDENCE" : "CONTEXT_SUPPORTED", portfolio_narrative: narrative, quality_flags: unique(qualityFlags), unresolved_unknowns: unique(unknowns), reason_codes: unique(reasons), source_refs: unique([...input.source_refs, ...evaluations.flatMap((item) => item.source_refs)]), evaluated_at: evaluatedAt, execution_authorized: false, deterministic: true,
  });
}
