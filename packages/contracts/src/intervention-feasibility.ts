import { z } from "zod";

export const INTERVENTION_FEASIBILITY_DISPOSITIONS = ["FEASIBLE_NOW", "FEASIBLE_WITH_ADAPTATION", "VALIDATION_REQUIRED", "NOT_FEASIBLE_NOW"] as const;
export type InterventionFeasibilityDisposition = (typeof INTERVENTION_FEASIBILITY_DISPOSITIONS)[number];
export const INTERVENTION_FEASIBILITY_RUN_DISPOSITIONS = ["FEASIBILITY_AVAILABLE", "VALIDATION_REQUIRED", "NO_FEASIBILITY_CANDIDATES"] as const;
export type InterventionFeasibilityRunDisposition = (typeof INTERVENTION_FEASIBILITY_RUN_DISPOSITIONS)[number];

const refs = z.array(z.string().min(1));
const level = z.enum(["LIMITED", "MODERATE", "MATERIAL", "UNKNOWN"]);
const resourceRequirement = z.object({
  resource: z.string().min(1), required_level: level,
  availability: z.enum(["AVAILABLE", "PARTIAL", "UNAVAILABLE", "UNKNOWN"]),
  capacity_status: z.enum(["SUFFICIENT", "CONTENDED", "INSUFFICIENT", "UNKNOWN"]),
  capability_status: z.enum(["FIT", "GAP", "UNKNOWN"]),
  owner_status: z.enum(["ASSIGNED", "AVAILABLE", "MISSING", "UNKNOWN"]),
  duration: z.string().min(1), bottleneck: z.boolean(), source_refs: refs,
});
const costProfile = z.object({
  direct: level, recurring: level, fixed: level, variable: level, switching: level, maintenance: level,
  coordination: level, training: level, decommissioning: level, opportunity: level,
  numeric_support: z.boolean(), amounts: z.array(z.object({ kind: z.string().min(1), amount: z.number().finite(), unit: z.string().min(1), support_refs: refs })),
});
const effortProfile = z.object({ complexity: level, workload: level, teams_involved: refs, handoffs: refs, coordination: level });
const timeRequirement = z.object({ implementation: z.string().min(1), operational_readiness: z.string().min(1), confident_outcome: z.string().min(1), deadline_fit: z.enum(["FIT", "TIGHT", "MISSED", "UNKNOWN"]) });
const adaptation = z.object({ kind: z.enum(["smaller_scope", "pilot", "staged", "outsource", "buy", "build", "manual_first", "temporary_bridge"]), description: z.string().min(1), resource_burden: level, source_refs: refs });
const alternative = z.object({ candidate_id: z.string().min(1), description: z.string().min(1), resource_burden: level, preserves_objective: z.enum(["TRUE", "UNKNOWN"]), source_refs: refs });

export const interventionFeasibilityInputSchema = z.object({
  candidate_id: z.string().min(1), priority_tier: z.enum(["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"]).optional(),
  expected_impact_disposition: z.enum(["SUPPORTED_QUALITATIVE", "POTENTIAL_ONLY", "VALIDATION_REQUIRED", "NO_VALID_IMPACT"]),
  resource_requirements: z.array(resourceRequirement), cost_profile: costProfile, effort_profile: effortProfile, time_requirement: timeRequirement,
  capability_gaps: refs, dependencies: refs, current_priority_refs: refs, opportunity_cost_refs: refs,
  success_capacity: z.object({ required_resources: refs, moving_bottleneck: z.string().min(1).nullable(), buffer_status: z.enum(["PRESENT", "THIN", "NONE", "UNKNOWN"]) }),
  adaptations: z.array(adaptation), alternatives: z.array(alternative), minimum_viable_commitment: z.string().min(1), recurring_burden: refs,
  reversibility: z.enum(["FLEXIBLE", "PARTIAL", "FIXED", "STRANDED", "UNKNOWN"]), guardrail_status: z.enum(["PASS", "FAIL", "UNKNOWN"]),
  unresolved_unknowns: refs, evidence_refs: refs, source_refs: refs,
});
export type InterventionFeasibilityInput = z.input<typeof interventionFeasibilityInputSchema>;

export const interventionFeasibilityResultSchema = z.object({
  candidate_id: z.string().min(1), priority_tier: z.enum(["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"]).optional(), disposition: z.enum(INTERVENTION_FEASIBILITY_DISPOSITIONS),
  expected_impact_disposition: z.enum(["SUPPORTED_QUALITATIVE", "POTENTIAL_ONLY", "VALIDATION_REQUIRED", "NO_VALID_IMPACT"]), resource_trace: z.object({ required_resources: refs, available_resources: refs, bottleneck_resources: refs, capability_gaps: refs, contention_refs: refs }),
  resource_requirements: z.array(resourceRequirement), cost_profile: costProfile, effort_profile: effortProfile, time_requirement: timeRequirement,
  success_capacity: z.object({ required_resources: refs, moving_bottleneck: z.string().min(1).nullable(), buffer_status: z.enum(["PRESENT", "THIN", "NONE", "UNKNOWN"]) }),
  adaptations: z.array(adaptation), alternatives: z.array(alternative), minimum_viable_commitment: z.string().min(1), recurring_burden: refs, reversibility: z.enum(["FLEXIBLE", "PARTIAL", "FIXED", "STRANDED", "UNKNOWN"]),
  reason_codes: refs, unresolved_unknowns: refs, evidence_refs: refs, source_refs: refs, execution_authorized: z.literal(false), deterministic: z.literal(true),
});
export type InterventionFeasibilityResult = z.infer<typeof interventionFeasibilityResultSchema>;
export const interventionFeasibilityRunResultSchema = z.object({
  context_id: z.string().min(1), business_id: z.string().min(1), decision_cycle_id: z.string().min(1), disposition: z.enum(INTERVENTION_FEASIBILITY_RUN_DISPOSITIONS),
  candidate_evaluations: z.array(interventionFeasibilityResultSchema), primary_priority_candidate_id: z.string().min(1).nullable(), reason_codes: refs, unresolved_unknowns: refs, source_refs: refs, evaluated_at: z.string().datetime(), execution_authorized: z.literal(false), deterministic: z.literal(true),
});
export type InterventionFeasibilityRunResult = z.infer<typeof interventionFeasibilityRunResultSchema>;

function unique(values: string[]) { return [...new Set(values)]; }
function result(input: InterventionFeasibilityInput, disposition: InterventionFeasibilityDisposition, reasons: string[], unknowns: string[]): InterventionFeasibilityResult {
  const bottlenecks = input.resource_requirements.filter((item) => item.bottleneck).map((item) => item.resource);
  return interventionFeasibilityResultSchema.parse({ ...input, disposition, resource_trace: { required_resources: unique(input.resource_requirements.map((item) => item.resource)), available_resources: input.resource_requirements.filter((item) => item.availability === "AVAILABLE").map((item) => item.resource), bottleneck_resources: unique(bottlenecks), capability_gaps: unique(input.capability_gaps), contention_refs: input.resource_requirements.filter((item) => item.capacity_status === "CONTENDED").map((item) => item.resource), }, reason_codes: unique(reasons), unresolved_unknowns: unique(unknowns), execution_authorized: false, deterministic: true });
}

export function evaluateInterventionFeasibility(raw: InterventionFeasibilityInput): InterventionFeasibilityResult {
  const parsed = interventionFeasibilityInputSchema.safeParse(raw);
  if (!parsed.success) return result(raw as Partial<InterventionFeasibilityInput> as InterventionFeasibilityInput, "VALIDATION_REQUIRED", ["INPUT.SCHEMA_INVALID"], ["input_schema"]);
  const input = parsed.data;
  const reasons: string[] = [];
  const unknowns = [...input.unresolved_unknowns];
  const unknownResources = input.resource_requirements.flatMap((item) => [item.availability === "UNKNOWN" ? `${item.resource}:availability` : "", item.capacity_status === "UNKNOWN" ? `${item.resource}:capacity` : "", item.capability_status === "UNKNOWN" ? `${item.resource}:capability` : "", item.owner_status === "UNKNOWN" ? `${item.resource}:owner` : ""].filter(Boolean));
  unknowns.push(...unknownResources);
  if (!input.resource_requirements.length) { unknowns.push("resource_requirements"); reasons.push("RESOURCE.REQUIREMENTS_MISSING"); }
  if (unknownResources.length) reasons.push("RESOURCE.CONTEXT_UNKNOWN");
  if (input.cost_profile.amounts.length && !input.cost_profile.numeric_support) reasons.push("COST.NUMERIC_UNSUPPORTED");
  const unavailable = input.resource_requirements.some((item) => item.availability === "UNAVAILABLE" || item.capacity_status === "INSUFFICIENT" || item.owner_status === "MISSING" || item.capability_status === "GAP");
  const contention = input.resource_requirements.some((item) => item.capacity_status === "CONTENDED" || item.availability === "PARTIAL");
  if (unavailable) reasons.push("RESOURCE.INSUFFICIENT_OR_MISSING");
  if (contention) reasons.push("RESOURCE.CONTENDED");
  if (input.guardrail_status === "FAIL") reasons.push("GUARDRAIL.CONFLICT");
  let disposition: InterventionFeasibilityDisposition = "FEASIBLE_NOW";
  if (input.guardrail_status === "FAIL" || (unavailable && !input.adaptations.length && !input.alternatives.length)) disposition = "NOT_FEASIBLE_NOW";
  else if (unknowns.length || input.time_requirement.deadline_fit === "UNKNOWN" || input.success_capacity.buffer_status === "UNKNOWN") disposition = "VALIDATION_REQUIRED";
  else if (unavailable || contention || input.adaptations.length > 0) disposition = "FEASIBLE_WITH_ADAPTATION";
  const normalizedInput = input.cost_profile.numeric_support
    ? input
    : { ...input, cost_profile: { ...input.cost_profile, amounts: [] } };
  return result(normalizedInput, disposition, reasons, unique(unknowns));
}

export function evaluateInterventionFeasibilitySet(input: { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; candidates: InterventionFeasibilityInput[]; evaluated_at: string }): InterventionFeasibilityRunResult {
  const evaluations = input.candidates.map(evaluateInterventionFeasibility);
  const useful = evaluations.some((item) => ["FEASIBLE_NOW", "FEASIBLE_WITH_ADAPTATION"].includes(item.disposition));
  return interventionFeasibilityRunResultSchema.parse({ context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: evaluations.length === 0 ? "NO_FEASIBILITY_CANDIDATES" : useful ? "FEASIBILITY_AVAILABLE" : "VALIDATION_REQUIRED", candidate_evaluations: evaluations, primary_priority_candidate_id: input.primary_priority_candidate_id, reason_codes: unique(evaluations.flatMap((item) => item.reason_codes)), unresolved_unknowns: unique(evaluations.flatMap((item) => item.unresolved_unknowns)), source_refs: unique(evaluations.flatMap((item) => item.source_refs)), evaluated_at: input.evaluated_at, execution_authorized: false, deterministic: true });
}
