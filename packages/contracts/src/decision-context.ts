import { z } from "zod";

export const DECISION_CONTEXT_STATUSES = ["COMPLETE", "INCOMPLETE", "CONFLICTING", "STALE", "FAILED"] as const;
export type DecisionContextStatus = (typeof DECISION_CONTEXT_STATUSES)[number];

export const CONTEXT_CONFIDENCES = ["SUFFICIENT_TO_DECIDE", "SUFFICIENT_WITH_LIMITATIONS", "VALIDATION_REQUIRED", "INSUFFICIENT", "UNKNOWN"] as const;
export type ContextConfidence = (typeof CONTEXT_CONFIDENCES)[number];

export const DECISION_OBJECTIVE_KINDS = ["GOAL", "TARGET", "STRATEGY", "INITIATIVE", "PREFERENCE"] as const;
export const DECISION_OBJECTIVE_SOURCES = ["DECLARED", "REVEALED", "INFERRED", "UNKNOWN"] as const;
export const CONTEXT_IMPORTANCE = ["high", "medium", "low", "unknown"] as const;
export const CONTEXT_URGENCY = ["critical", "high", "medium", "low", "unknown"] as const;

const reference = z.string().min(1);
const confidence = z.enum(["high", "medium", "low", "unknown"] as const);

export const decisionObjectiveSchema = z.object({
  objective_id: reference,
  kind: z.enum(DECISION_OBJECTIVE_KINDS),
  statement: z.string().trim().min(1),
  source: z.enum(DECISION_OBJECTIVE_SOURCES),
  rationale: z.string().trim().min(1).nullable().optional(),
  horizon: z.string().trim().min(1).nullable().optional(),
  importance: z.enum(CONTEXT_IMPORTANCE).default("unknown"),
  urgency: z.enum(CONTEXT_URGENCY).default("unknown"),
  target_state: z.string().trim().min(1).nullable().optional(),
  source_refs: z.array(reference).default([]),
});
export type DecisionObjective = z.infer<typeof decisionObjectiveSchema>;

export const objectiveConflictSchema = z.object({
  conflict_id: reference,
  statement: z.string().trim().min(1),
  objective_refs: z.array(reference).min(2),
  resolved: z.boolean().default(false),
  precedence: z.array(reference).default([]),
  source_refs: z.array(reference).default([]),
});

export const contextGuardrailSchema = z.object({
  guardrail_id: reference,
  family: z.enum(["ECONOMIC", "OPERATIONAL", "CUSTOMER", "STRATEGIC", "CONTINUITY"]),
  statement: z.string().trim().min(1),
  threshold: z.unknown().nullable().optional(),
  status: z.enum(["ACTIVE", "UNKNOWN", "NOT_APPLICABLE"]),
  source_refs: z.array(reference).default([]),
});

export const contextCommitmentSchema = z.object({
  commitment_id: reference,
  statement: z.string().trim().min(1),
  nature: z.enum(["REVERSIBLE", "IRREVERSIBLE", "SUNK_COST", "FUTURE_OBLIGATION"]),
  deadline: z.string().datetime().nullable().optional(),
  source_refs: z.array(reference).default([]),
});

export const contextInputSchema = z.object({
  decision_context_id: reference,
  business_id: reference,
  as_of: z.string().datetime(),
  schema_version: z.string().min(1),
  context_policy_version: z.string().min(1),
  primary_objective: decisionObjectiveSchema.nullable(),
  secondary_objectives: z.array(decisionObjectiveSchema).default([]),
  declared_objective: z.string().trim().min(1).nullable().optional(),
  revealed_objective: decisionObjectiveSchema.nullable().optional(),
  objective_conflicts: z.array(objectiveConflictSchema).default([]),
  time_horizon: z.string().trim().min(1).nullable().optional(),
  current_constraint_refs: z.array(reference).default([]),
  guardrails: z.array(contextGuardrailSchema).default([]),
  resources: z.record(z.string(), z.object({ value: z.unknown().nullable(), state: z.enum(["KNOWN", "UNKNOWN", "ESTIMATED"]) })).default({}),
  risk_context: z.object({
    appetite: z.enum(["low", "medium", "high", "unknown"]),
    capacity: z.enum(["low", "medium", "high", "UNKNOWN"]),
    unresolved: z.array(reference).default([]),
  }),
  commitments: z.array(contextCommitmentSchema).default([]),
  business_stage: z.object({ stage: z.string().trim().min(1).nullable().optional(), confidence }),
  current_state: z.record(z.string(), z.unknown()).default({}),
  target_state: z.object({ statement: z.string().trim().min(1).nullable().optional(), source_refs: z.array(reference).default([]) }).default({ statement: null, source_refs: [] }),
  gaps: z.array(z.object({ gap_id: reference, statement: z.string().trim().min(1), binding: z.boolean().nullable(), source_refs: z.array(reference).default([]) })).default([]),
  dependencies: z.array(z.object({ dependency_id: reference, statement: z.string().trim().min(1), status: z.enum(["OPEN", "BLOCKED", "SATISFIED", "UNKNOWN"]), source_refs: z.array(reference).default([]) })).default([]),
  event_windows: z.array(z.object({ event_id: reference, statement: z.string().trim().min(1), starts_at: z.string().datetime().nullable().optional(), ends_at: z.string().datetime().nullable().optional(), source_refs: z.array(reference).default([]) })).default([]),
  must_win: z.array(reference).default([]),
  must_not_fail: z.array(reference).default([]),
  source_lineage_refs: z.array(reference).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  technical_error: z.string().min(1).optional(),
});
export type DecisionContextInput = z.infer<typeof contextInputSchema>;
export type DecisionContextInputLike = z.input<typeof contextInputSchema>;

export const decisionContextResultSchema = contextInputSchema.extend({
  input_fingerprint: reference,
  evaluated_at: z.string().datetime(),
  context_status: z.enum(DECISION_CONTEXT_STATUSES),
  context_confidence: z.enum(CONTEXT_CONFIDENCES),
  unresolved_unknowns: z.array(reference),
  reason_codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/)),
}).superRefine((result, ctx) => {
  if (["COMPLETE", "CONFLICTING"].includes(result.context_status) && result.source_lineage_refs.length === 0) {
    ctx.addIssue({ code: "custom", path: ["source_lineage_refs"], message: "Un contexto evaluado exige lineage." });
  }
  if (result.context_status === "CONFLICTING" && !result.reason_codes.includes("OBJECTIVE.CONFLICT_UNRESOLVED")) {
    ctx.addIssue({ code: "custom", path: ["reason_codes"], message: "Un contexto conflictivo exige una razón explícita." });
  }
});
export type DecisionContextResult = z.infer<typeof decisionContextResultSchema>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const ignored = ["metadata", "technical_error", "decision_context_id", "as_of", "evaluated_at", "input_fingerprint"];
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([name]) => !ignored.includes(name))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, item]) => `${JSON.stringify(name)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintDecisionContextInput(input: unknown): string {
  let hash = 2166136261;
  for (const char of canonical(input)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function invalidResult(raw: DecisionContextInputLike, now: string): DecisionContextResult {
  const fallback = raw as Partial<DecisionContextInput>;
  return decisionContextResultSchema.parse({
    decision_context_id: fallback.decision_context_id ?? "invalid-context",
    business_id: fallback.business_id ?? "invalid-business",
    as_of: fallback.as_of ?? now,
    schema_version: fallback.schema_version ?? "p1.v1",
    context_policy_version: fallback.context_policy_version ?? "unknown",
    primary_objective: null,
    secondary_objectives: [],
    declared_objective: null,
    revealed_objective: null,
    objective_conflicts: [],
    time_horizon: null,
    current_constraint_refs: [],
    guardrails: [],
    resources: {},
    risk_context: { appetite: "unknown", capacity: "UNKNOWN", unresolved: ["input_schema"] },
    commitments: [],
    business_stage: { stage: null, confidence: "unknown" },
    current_state: {},
    target_state: { statement: null, source_refs: [] },
    gaps: [],
    dependencies: [],
    event_windows: [],
    must_win: [],
    must_not_fail: [],
    source_lineage_refs: [],
    input_fingerprint: fingerprintDecisionContextInput(raw),
    evaluated_at: now,
    context_status: "INCOMPLETE",
    context_confidence: "INSUFFICIENT",
    unresolved_unknowns: ["input_schema"],
    reason_codes: ["INPUT.INVALID_SCHEMA"],
  });
}

/** Construye contexto; nunca calcula score, ranking ni prioridad de candidatos. */
export function buildDecisionContext(raw: DecisionContextInputLike): DecisionContextResult {
  const now = new Date().toISOString();
  const parsed = contextInputSchema.safeParse(raw);
  if (!parsed.success) return invalidResult(raw, now);
  const input = parsed.data;
  const unresolved = [...input.risk_context.unresolved];
  const reasons: string[] = [];
  let status: DecisionContextStatus = "COMPLETE";
  let contextConfidence: ContextConfidence = "SUFFICIENT_TO_DECIDE";

  if (!input.primary_objective) {
    status = "INCOMPLETE";
    contextConfidence = "INSUFFICIENT";
    unresolved.push("objective_context");
    reasons.push("OBJECTIVE.MISSING_REQUIRED");
  } else if (input.primary_objective.kind !== "GOAL") {
    status = "INCOMPLETE";
    contextConfidence = "VALIDATION_REQUIRED";
    unresolved.push("objective_semantics");
    reasons.push("OBJECTIVE.NOT_A_GOAL");
  }
  const unresolvedConflicts = input.objective_conflicts.filter((conflict) => !conflict.resolved);
  if (unresolvedConflicts.length) {
    status = "CONFLICTING";
    contextConfidence = "VALIDATION_REQUIRED";
    reasons.push("OBJECTIVE.CONFLICT_UNRESOLVED");
    unresolved.push(...unresolvedConflicts.map((conflict) => `objective_conflict:${conflict.conflict_id}`));
  }
  if (!input.time_horizon) {
    unresolved.push("time_horizon");
    contextConfidence = contextConfidence === "SUFFICIENT_TO_DECIDE" ? "SUFFICIENT_WITH_LIMITATIONS" : contextConfidence;
    reasons.push("CONTEXT.MISSING_HORIZON");
  }
  if (input.risk_context.capacity === "UNKNOWN") {
    unresolved.push("risk_capacity");
    contextConfidence = contextConfidence === "SUFFICIENT_TO_DECIDE" ? "SUFFICIENT_WITH_LIMITATIONS" : contextConfidence;
    reasons.push("RISK.CAPACITY_UNKNOWN");
  }
  for (const [resource, detail] of Object.entries(input.resources)) {
    if (detail.state === "UNKNOWN") {
      unresolved.push(`resource:${resource}`);
      contextConfidence = contextConfidence === "SUFFICIENT_TO_DECIDE" ? "SUFFICIENT_WITH_LIMITATIONS" : contextConfidence;
      reasons.push("RESOURCE.VISIBILITY_LIMITED");
    }
  }
  if (status === "COMPLETE" && reasons.length === 0 && unresolved.length === 0) contextConfidence = "SUFFICIENT_TO_DECIDE";
  else if (status === "COMPLETE" && contextConfidence === "SUFFICIENT_TO_DECIDE") contextConfidence = "SUFFICIENT_WITH_LIMITATIONS";

  return decisionContextResultSchema.parse({
    ...input,
    input_fingerprint: fingerprintDecisionContextInput(input),
    evaluated_at: now,
    context_status: status,
    context_confidence: contextConfidence,
    unresolved_unknowns: [...new Set(unresolved)],
    reason_codes: [...new Set(reasons)],
  });
}
