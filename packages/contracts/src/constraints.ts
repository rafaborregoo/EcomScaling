import { z } from "zod";

export const CONSTRAINT_CAPABILITIES = ["DEMAND", "PRODUCT", "OFFER", "CREATIVE", "ACQUISITION", "CONVERSION", "PAYMENT", "INVENTORY", "SUPPLY", "FULFILLMENT", "CUSTOMER_SERVICE", "RETENTION", "CASH", "DATA", "TECHNOLOGY", "TEAM", "MANAGEMENT_ATTENTION", "MARKET", "POLICY_COMPLIANCE"] as const;
export const CONSTRAINT_ROLES = ["PRIMARY", "NEAR", "NON_CONSTRAINT", "POSSIBLE"] as const;
export const CONSTRAINT_HORIZONS = ["CURRENT", "EMERGING", "FUTURE"] as const;
export const DEPENDENCY_TYPES = ["INFORMATION", "RESOURCE", "TECHNICAL", "OPERATIONAL", "FINANCIAL", "SUPPLY", "ORGANIZATIONAL", "APPROVAL", "MARKET", "TEMPORAL", "LEARNING", "VALIDATION"] as const;
export const DEPENDENCY_RELATIONS = ["PREREQUISITE", "BLOCKER", "ENABLES", "RESOURCE_CONFLICT", "TEMPORAL", "VALIDATION"] as const;

const ref = z.string().min(1);
const date = z.string().datetime();
const confidence = z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]);

const constraint = z.object({
  candidate_ref: ref,
  capability: z.enum(CONSTRAINT_CAPABILITIES),
  role: z.enum(CONSTRAINT_ROLES),
  horizon: z.enum(CONSTRAINT_HORIZONS),
  status: z.enum(["HYPOTHESIZED", "CONFIRMED", "REJECTED", "RESOLVED"]),
  binding_evidence: z.array(ref),
  demand_on_capacity: z.number().nonnegative().nullable(),
  available_capacity: z.number().nonnegative().nullable(),
  saturation_share: z.number().min(0).max(1).nullable(),
  queue_or_backlog: z.number().nonnegative().nullable(),
  throughput_blocked: ref.nullable(),
  release_value: ref,
  falsifier: ref,
  confidence,
  source_refs: z.array(ref).min(1),
}).superRefine((value, ctx) => {
  if (value.role === "PRIMARY" && value.binding_evidence.length === 0) ctx.addIssue({ code: "custom", message: "primary_requires_binding_evidence" });
});

const dependency = z.object({
  upstream_ref: ref,
  downstream_ref: ref,
  dependency_type: z.enum(DEPENDENCY_TYPES),
  relation: z.enum(DEPENDENCY_RELATIONS),
  strength: z.enum(["HARD", "STRONG", "MODERATE", "WEAK"]),
  certainty: z.enum(["CONFIRMED", "HYPOTHESIZED"]),
  minimum_prerequisite: ref.nullable(),
  alternative_paths: z.array(ref),
  redundancy: z.enum(["NONE", "PARTIAL", "EFFECTIVE", "THEORETICAL", "UNKNOWN"]),
  switching_lead_time_days: z.number().nonnegative().nullable(),
  slack_days: z.number().nonnegative().nullable(),
  critical_path: z.boolean(),
  parallelism: z.enum(["PARALLEL", "PARALLEL_PARTIAL", "SERIAL", "UNKNOWN"]),
  shared_resource: ref.nullable(),
  control: z.enum(["CONTROLLABLE", "INFLUENCEABLE", "UNCONTROLLABLE", "UNKNOWN"]),
  explanation: ref,
  source_refs: z.array(ref).min(1),
}).superRefine((value, ctx) => {
  if (value.relation === "RESOURCE_CONFLICT" && value.shared_resource === null) ctx.addIssue({ code: "custom", message: "resource_conflict_requires_shared_resource" });
});

export const constraintsDependenciesInputSchema = z.object({
  assessment_id: ref,
  business_id: ref,
  as_of: date,
  system_objective: z.object({ statement: ref, source_refs: z.array(ref).min(1) }).nullable(),
  constraints: z.array(constraint),
  dependencies: z.array(dependency),
  source_refs: z.array(ref).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type ConstraintsDependenciesInput = z.infer<typeof constraintsDependenciesInputSchema>;
export type ConstraintsDependenciesInputLike = z.input<typeof constraintsDependenciesInputSchema>;

export const constraintsDependenciesResultSchema = constraintsDependenciesInputSchema.extend({
  input_fingerprint: ref,
  evaluated_at: date,
  constraint_map: z.object({ current_primary: ref.nullable(), near_constraints: z.array(ref), emerging_constraints: z.array(ref), future_constraints: z.array(ref) }),
  dependency_graph: z.array(dependency),
  unresolved_unknowns: z.array(ref),
  reason_codes: z.array(z.string().regex(/^[A-Z][A-Z0-9_]*\.[A-Z][A-Z0-9_]*$/)),
});
export type ConstraintsDependenciesResult = z.infer<typeof constraintsDependenciesResultSchema>;

function canonical(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`; if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).filter(([key]) => !["metadata", "assessment_id", "as_of"].includes(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`; return JSON.stringify(value); }
export function fingerprintConstraintsDependenciesInput(input: unknown): string { let hash = 2166136261; for (const char of canonical(input)) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`; }

export function evaluateConstraintsDependencies(raw: ConstraintsDependenciesInputLike): ConstraintsDependenciesResult {
  const parsed = constraintsDependenciesInputSchema.safeParse(raw);
  if (!parsed.success) throw new Error("constraints_input_invalid");
  const input = parsed.data;
  const unknowns: string[] = [];
  const reasons: string[] = [];
  if (input.system_objective === null) { unknowns.push("system_objective"); reasons.push("OBJECTIVE.MISSING"); }
  const primary = input.constraints.find((item) => item.role === "PRIMARY" && item.horizon === "CURRENT" && item.status !== "REJECTED" && item.status !== "RESOLVED");
  if (!primary) { unknowns.push("current_primary_constraint"); reasons.push("CONSTRAINT.PRIMARY_UNKNOWN"); }
  if (input.constraints.some((item) => item.role === "PRIMARY" && item.throughput_blocked === null)) { unknowns.push("throughput_blocked"); reasons.push("CONSTRAINT.THROUGHPUT_UNKNOWN"); }
  const result = constraintsDependenciesResultSchema.parse({ ...input, input_fingerprint: fingerprintConstraintsDependenciesInput(input), evaluated_at: new Date().toISOString(), constraint_map: { current_primary: input.system_objective && primary ? primary.candidate_ref : null, near_constraints: input.constraints.filter((item) => item.role === "NEAR").map((item) => item.candidate_ref), emerging_constraints: input.constraints.filter((item) => item.horizon === "EMERGING").map((item) => item.candidate_ref), future_constraints: input.constraints.filter((item) => item.horizon === "FUTURE").map((item) => item.candidate_ref) }, dependency_graph: input.dependencies, unresolved_unknowns: [...new Set(unknowns)], reason_codes: [...new Set(reasons)] });
  return result;
}
