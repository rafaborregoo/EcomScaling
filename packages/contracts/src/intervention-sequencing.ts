import { z } from "zod";

export const INTERVENTION_SEQUENCE_DISPOSITIONS = ["SEQUENCE_READY", "VALIDATION_REQUIRED", "BLOCKED", "NOT_YET"] as const;
export type InterventionSequenceDisposition = (typeof INTERVENTION_SEQUENCE_DISPOSITIONS)[number];
export const INTERVENTION_SEQUENCE_RUN_DISPOSITIONS = ["SEQUENCES_AVAILABLE", "VALIDATION_REQUIRED", "NO_SEQUENCE_CANDIDATES"] as const;
export type InterventionSequenceRunDisposition = (typeof INTERVENTION_SEQUENCE_RUN_DISPOSITIONS)[number];

const refs = z.array(z.string().min(1));
const dependency = z.object({ dependency_id: z.string().min(1), description: z.string().min(1), category: z.string().min(1), requirement: z.string().min(1), status: z.string().min(1), blocking: z.boolean(), source_refs: refs, unlocks: refs });
const sequenceStep = z.object({ step_id: z.string().min(1), kind: z.string().min(1), action: z.string().min(1), why_first: z.string().min(1), prerequisite_ids: refs, gate_ids: refs, next_ids: refs, if_condition: z.string().min(1), if_not_condition: z.string().min(1), wait_for: z.string().min(1), exit_condition: z.string().min(1), source_refs: refs });
const gate = z.object({ gate_id: z.string().min(1), condition: z.string().min(1), if_true: z.string().min(1), if_false: z.string().min(1), wait_required: z.boolean(), exit_condition: z.string().min(1), guardrail_status: z.enum(["PASS", "FAIL", "UNKNOWN"]), source_refs: refs });

export const interventionSequencingInputSchema = z.object({
  candidate_id: z.string().min(1), priority_tier: z.enum(["NOW", "NEXT", "LATER", "DO_NOT_DO", "WAIT"]).optional(),
  strategic_intervention: z.string().min(1), intended_outcome: z.string().min(1),
  priority_disposition: z.string().min(1), impact_disposition: z.string().min(1), feasibility_disposition: z.string().min(1), risk_disposition: z.string().min(1),
  prerequisites: z.array(dependency), current_blockers: refs, resource_context: refs, risk_context: refs, evidence_context: refs, lead_times: refs, business_mode: z.string().min(1),
  guardrails: refs, guardrail_status: z.enum(["PASS", "FAIL", "UNKNOWN"]), current_experiments: refs, critical_path: refs,
  sequence_steps: z.array(sequenceStep), gates: z.array(gate), parallel_tracks: refs, not_yet: refs, wait_conditions: refs, exit_conditions: refs,
  unresolved_unknowns: refs, evidence_refs: refs, source_refs: refs,
});
export type InterventionSequencingInput = z.input<typeof interventionSequencingInputSchema>;

export const interventionSequencingResultSchema = interventionSequencingInputSchema.extend({
  disposition: z.enum(INTERVENTION_SEQUENCE_DISPOSITIONS),
  sequence_trace: z.object({ prerequisite_ids: refs, blocker_ids: refs, unlock_ids: refs, gate_ids: refs, next_ids: refs, branch_ids: refs, parallel_ids: refs, wait_ids: refs, not_yet_ids: refs }),
  decision_path: z.object({ now: refs, why_first: refs, then: refs, if_branches: refs, if_not_branches: refs, parallel: refs, not_yet: refs, wait: refs, exit_conditions: refs }),
  reason_codes: refs, execution_authorized: z.literal(false), deterministic: z.literal(true),
});
export type InterventionSequencingResult = z.infer<typeof interventionSequencingResultSchema>;

export const interventionSequencingRunResultSchema = z.object({
  context_id: z.string().min(1), business_id: z.string().min(1), decision_cycle_id: z.string().min(1), disposition: z.enum(INTERVENTION_SEQUENCE_RUN_DISPOSITIONS),
  candidate_evaluations: z.array(interventionSequencingResultSchema), primary_priority_candidate_id: z.string().min(1).nullable(), reason_codes: refs, unresolved_unknowns: refs, source_refs: refs,
  evaluated_at: z.string().datetime(), execution_authorized: z.literal(false), deterministic: z.literal(true),
});
export type InterventionSequencingRunResult = z.infer<typeof interventionSequencingRunResultSchema>;

function unique(values: string[]): string[] { return [...new Set(values)]; }

function fallback(raw: Partial<InterventionSequencingInput>, reasons: string[], unknowns: string[]): InterventionSequencingResult {
  const candidateId = typeof raw.candidate_id === "string" ? raw.candidate_id : "invalid-candidate";
  return interventionSequencingResultSchema.parse({
    candidate_id: candidateId, ...(raw.priority_tier ? { priority_tier: raw.priority_tier } : {}), strategic_intervention: typeof raw.strategic_intervention === "string" ? raw.strategic_intervention : "intervention not defined", intended_outcome: typeof raw.intended_outcome === "string" ? raw.intended_outcome : "outcome not defined", priority_disposition: "UNKNOWN", impact_disposition: "UNKNOWN", feasibility_disposition: "UNKNOWN", risk_disposition: "UNKNOWN", prerequisites: [], current_blockers: [], resource_context: [], risk_context: [], evidence_context: [], lead_times: [], business_mode: "UNKNOWN", guardrails: [], guardrail_status: "UNKNOWN", current_experiments: [], critical_path: [], sequence_steps: [], gates: [], parallel_tracks: [], not_yet: [], wait_conditions: [], exit_conditions: [], unresolved_unknowns: unique(unknowns), evidence_refs: [], source_refs: [], disposition: "VALIDATION_REQUIRED", sequence_trace: { prerequisite_ids: [], blocker_ids: [], unlock_ids: [], gate_ids: [], next_ids: [], branch_ids: [], parallel_ids: [], wait_ids: [], not_yet_ids: [] }, decision_path: { now: [], why_first: [], then: [], if_branches: [], if_not_branches: [], parallel: [], not_yet: [], wait: [], exit_conditions: [] }, reason_codes: unique(reasons), execution_authorized: false, deterministic: true,
  });
}

export function evaluateInterventionSequence(raw: InterventionSequencingInput): InterventionSequencingResult {
  const parsed = interventionSequencingInputSchema.safeParse(raw);
  if (!parsed.success) return fallback(raw as Partial<InterventionSequencingInput>, ["INPUT.SCHEMA_INVALID"], ["input_schema"]);
  const input = parsed.data;
  const unknowns = [...input.unresolved_unknowns];
  const reasons: string[] = [];
  if (!input.sequence_steps.length) { unknowns.push("sequence_steps"); reasons.push("SEQUENCE.PATH_MISSING"); }
  if (!input.prerequisites.length) { unknowns.push("prerequisites"); reasons.push("DEPENDENCY.CONTEXT_MISSING"); }
  if (!input.strategic_intervention.trim()) { unknowns.push("strategic_intervention"); reasons.push("PRIORITY.INTERVENTION_MISSING"); }
  if (input.guardrail_status === "UNKNOWN") { unknowns.push("guardrails"); reasons.push("GUARDRAIL.CONTEXT_UNKNOWN"); }
  const hardUnresolved = input.prerequisites.filter((item) => item.requirement.toUpperCase() === "HARD" && item.blocking && !["READY", "RESOLVED", "SUFFICIENTLY_READY"].includes(item.status.toUpperCase()));
  const unknownDependencies = input.prerequisites.filter((item) => item.status.toUpperCase() === "UNKNOWN");
  const failedGates = input.gates.filter((item) => item.guardrail_status === "FAIL");
  if (hardUnresolved.length) reasons.push("DEPENDENCY.HARD_BLOCKER");
  if (unknownDependencies.length) { reasons.push("DEPENDENCY.STATUS_UNKNOWN"); unknowns.push(...unknownDependencies.map((item) => item.dependency_id)); }
  if (failedGates.length || input.guardrail_status === "FAIL") reasons.push("GUARDRAIL.SEQUENCE_INTERRUPTED");
  const prerequisiteIds = unique(input.prerequisites.map((item) => item.dependency_id));
  const blockerIds = unique([...input.current_blockers, ...hardUnresolved.map((item) => item.dependency_id)]);
  const unlockIds = unique(input.prerequisites.flatMap((item) => item.unlocks));
  const gateIds = unique(input.gates.map((item) => item.gate_id));
  const nextIds = unique(input.sequence_steps.flatMap((item) => item.next_ids));
  const branchIds = unique(input.gates.flatMap((item) => [item.if_true, item.if_false]).filter((item) => item.length > 0));
  let disposition: InterventionSequenceDisposition = "SEQUENCE_READY";
  if (input.guardrail_status === "FAIL" || failedGates.length) disposition = "BLOCKED";
  else if (hardUnresolved.length) disposition = "BLOCKED";
  else if (unknowns.length) disposition = "VALIDATION_REQUIRED";
  else if (input.current_blockers.length || input.priority_disposition === "WAIT" || input.priority_disposition === "LATER") disposition = "NOT_YET";
  const decisionPath = { now: input.sequence_steps.filter((item) => item.kind.toUpperCase() === "NOW").map((item) => item.action), why_first: input.sequence_steps.map((item) => item.why_first), then: input.sequence_steps.filter((item) => ["THEN", "NEXT"].includes(item.kind.toUpperCase())).map((item) => item.action), if_branches: input.gates.map((item) => `${item.condition} -> ${item.if_true}`), if_not_branches: input.gates.map((item) => `${item.condition} not met -> ${item.if_false}`), parallel: unique(input.parallel_tracks), not_yet: unique(input.not_yet), wait: unique(input.wait_conditions), exit_conditions: unique(input.exit_conditions) };
  return interventionSequencingResultSchema.parse({ ...input, disposition, sequence_trace: { prerequisite_ids: prerequisiteIds, blocker_ids: blockerIds, unlock_ids: unlockIds, gate_ids: gateIds, next_ids: nextIds, branch_ids: branchIds, parallel_ids: unique(input.parallel_tracks), wait_ids: unique(input.wait_conditions), not_yet_ids: unique(input.not_yet) }, decision_path: decisionPath, reason_codes: unique(reasons), unresolved_unknowns: unique(unknowns), execution_authorized: false, deterministic: true });
}

export function evaluateInterventionSequenceSet(input: { context_id: string; business_id: string; decision_cycle_id: string; primary_priority_candidate_id: string | null; candidates: InterventionSequencingInput[]; evaluated_at: string }): InterventionSequencingRunResult {
  const evaluations = input.candidates.map(evaluateInterventionSequence);
  const available = evaluations.some((item) => ["SEQUENCE_READY", "NOT_YET"].includes(item.disposition));
  return interventionSequencingRunResultSchema.parse({ context_id: input.context_id, business_id: input.business_id, decision_cycle_id: input.decision_cycle_id, disposition: evaluations.length === 0 ? "NO_SEQUENCE_CANDIDATES" : available ? "SEQUENCES_AVAILABLE" : "VALIDATION_REQUIRED", candidate_evaluations: evaluations, primary_priority_candidate_id: input.primary_priority_candidate_id, reason_codes: unique(evaluations.flatMap((item) => item.reason_codes)), unresolved_unknowns: unique(evaluations.flatMap((item) => item.unresolved_unknowns)), source_refs: unique(evaluations.flatMap((item) => item.source_refs)), evaluated_at: input.evaluated_at, execution_authorized: false, deterministic: true });
}
