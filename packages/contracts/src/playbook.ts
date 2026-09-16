import { z } from "zod";

const reference = z.string().min(1);

export const PLAYBOOK_APPLICABILITY_STATUSES = [
  "APPLICABLE",
  "APPLICABLE_WITH_CONDITIONS",
  "REQUIRES_VALIDATION",
  "CONTRAINDICATED",
  "BLOCKED",
  "NOT_APPLICABLE",
] as const;
export type PlaybookApplicabilityStatus =
  (typeof PLAYBOOK_APPLICABILITY_STATUSES)[number];

export const PLAYBOOK_TEMPLATE_LIFECYCLES = [
  "DRAFT",
  "ACTIVE",
  "DEPRECATED",
  "RETIRED",
] as const;
export const PLAYBOOK_INSTANCE_STATUSES = [
  "SELECTED",
  "VALIDATION_REQUIRED",
  "READY_FOR_HANDOFF",
  "BLOCKED",
  "SUPERSEDED",
] as const;
export const PLAYBOOK_DISPOSITIONS = [
  "READY_FOR_RECOMMENDATION",
  "VALIDATION_REQUIRED",
  "BLOCKED",
  "NO_APPLICABLE_PLAYBOOK",
  "REASSESS_DIAGNOSIS",
  "REPRIORITIZE",
] as const;
export type PlaybookDisposition = (typeof PLAYBOOK_DISPOSITIONS)[number];

export const PLAYBOOK_TRI_STATES = ["TRUE", "FALSE", "UNKNOWN"] as const;
export type PlaybookTriState = (typeof PLAYBOOK_TRI_STATES)[number];
export const PLAYBOOK_UNKNOWN_POLICIES = [
  "REQUIRE_VALIDATION",
  "BLOCK",
  "ALLOW_WITH_LIMITATIONS",
] as const;
export const PLAYBOOK_CONDITION_TYPES = [
  "HARD_PRECONDITION",
  "CONTEXT_CONDITION",
  "VALIDATION_REQUIREMENT",
] as const;
export const PLAYBOOK_ADAPTATION_POLICIES = [
  "LOCKED",
  "PARAMETERIZABLE",
  "OPTIONAL",
  "REORDERABLE",
  "EXTENSIBLE",
] as const;
export const PLAYBOOK_STAGES = [
  "STABILIZE",
  "ISOLATE",
  "CORRECT",
  "VALIDATE",
  "OPTIMIZE",
  "SCALE",
] as const;

const conditionSchema = z.object({
  condition_id: reference,
  condition_type: z.enum(PLAYBOOK_CONDITION_TYPES),
  fact_ref: reference,
  expected: z.enum(PLAYBOOK_TRI_STATES),
  unknown_policy: z.enum(PLAYBOOK_UNKNOWN_POLICIES),
  reason_code: z.string().min(1).optional(),
});
export type PlaybookCondition = z.input<typeof conditionSchema>;

const stepSchema = z.object({
  step_id: reference,
  label: z.string().min(1),
  stage: z.enum(PLAYBOOK_STAGES),
  adaptation_policy: z.enum(PLAYBOOK_ADAPTATION_POLICIES),
});
export type PlaybookStep = z.input<typeof stepSchema>;

const adaptationPolicySchema = z.object({
  default: z.enum(PLAYBOOK_ADAPTATION_POLICIES).default("LOCKED"),
  allow_new_steps: z.boolean().default(false),
});

export const playbookContextSchema = z.object({
  context_id: reference,
  decision_cycle_id: reference,
  business_id: reference,
  priority_ref: reference.nullable(),
  objective_ref: reference.nullable().default(null),
  problem_refs: z.array(reference).default([]),
  diagnosis_refs: z.array(reference).default([]),
  maturity_ref: reference.nullable().default(null),
  business_context_ref: reference.nullable().default(null),
  constraint_refs: z.array(reference).default([]),
  risk_assessment_refs: z.array(reference).default([]),
  economics_refs: z.array(reference).default([]),
  dependency_refs: z.array(reference).default([]),
  evidence_refs: z.array(reference).default([]),
  source_versions: z.array(reference).default([]),
  facts: z.record(z.string(), z.enum(PLAYBOOK_TRI_STATES)).default({}),
  as_of: z.string().datetime(),
});
export type PlaybookContext = z.infer<typeof playbookContextSchema>;
export type PlaybookContextInput = z.input<typeof playbookContextSchema>;

export const playbookTemplateSchema = z.object({
  template_id: reference,
  template_version: reference,
  schema_version: reference,
  lifecycle: z.enum(PLAYBOOK_TEMPLATE_LIFECYCLES),
  domain: z.string().min(1).default("GENERAL"),
  domain_extension: z.record(z.string(), z.unknown()).default({}),
  name: z.string().min(1),
  purpose: z.string().min(1),
  problem_refs: z.array(reference).default([]),
  intent: z.string().min(1),
  intervention_type: z.string().min(1),
  activation_signals: z.array(reference).default([]),
  preconditions: z.array(conditionSchema).default([]),
  contraindications: z.array(conditionSchema).default([]),
  steps: z.array(stepSchema).min(1),
  expected_effects: z.array(reference).default([]),
  validation_requirements: z.array(reference).min(1),
  success_criteria: z.array(reference).min(1),
  failure_criteria: z.array(reference).min(1),
  stop_conditions: z.array(reference).min(1),
  reassessment_conditions: z.array(reference).default([]),
  resource_requirements: z.array(reference).default([]),
  dependencies: z.array(reference).default([]),
  intervention_risks: z.array(reference).default([]),
  adaptation_policy: adaptationPolicySchema.default({
    default: "LOCKED",
    allow_new_steps: false,
  }),
  source_refs: z.array(reference).min(1),
});
export type PlaybookTemplate = z.infer<typeof playbookTemplateSchema>;
export type PlaybookTemplateInput = z.input<typeof playbookTemplateSchema>;

const conditionEvaluationSchema = z.object({
  condition_id: reference,
  condition_type: z.enum(PLAYBOOK_CONDITION_TYPES),
  fact_ref: reference,
  expected: z.enum(PLAYBOOK_TRI_STATES),
  observed: z.enum(PLAYBOOK_TRI_STATES),
  unknown_policy: z.enum(PLAYBOOK_UNKNOWN_POLICIES),
  triggered: z.boolean().nullable(),
  reason_code: reference.optional(),
});
export type PlaybookConditionEvaluation = z.infer<
  typeof conditionEvaluationSchema
>;

export const playbookCandidateEvaluationSchema = z.object({
  template_id: reference,
  template_version: reference,
  applicability: z.enum(PLAYBOOK_APPLICABILITY_STATUSES),
  precondition_evaluations: z.array(conditionEvaluationSchema),
  contraindication_evaluations: z.array(conditionEvaluationSchema),
  reason_codes: z.array(reference).default([]),
  unresolved_unknowns: z.array(reference).default([]),
  evidence_refs: z.array(reference).default([]),
  evaluated_at: z.string().datetime(),
  deterministic: z.literal(true),
});
export type PlaybookCandidateEvaluation = z.infer<
  typeof playbookCandidateEvaluationSchema
>;

const adaptationTraceSchema = z.object({
  original_element_ref: reference,
  adaptation_type: z.enum([
    "PARAMETERIZED",
    "OMITTED",
    "REORDERED",
    "EXTENDED",
  ]),
  adapted_value: z.string().min(1),
  reason: z.string().min(1),
  evidence_refs: z.array(reference).default([]),
  producer: z.enum(["DETERMINISTIC_RUNTIME", "HUMAN", "AI"]).default(
    "DETERMINISTIC_RUNTIME",
  ),
});

export const playbookInstanceSchema = z.object({
  instance_id: reference,
  playbook_id: reference,
  playbook_version: reference,
  schema_version: reference,
  context_ref: reference,
  priority_ref: reference,
  decision_cycle_id: reference,
  intervention_type: reference,
  intervention_hypothesis: reference,
  domain_extension: z.record(z.string(), z.unknown()).default({}),
  adaptations: z.array(adaptationTraceSchema).default([]),
  resolved_steps: z.array(stepSchema).min(1),
  resolved_preconditions: z.array(conditionEvaluationSchema),
  expected_effects: z.array(reference).min(1),
  validation_requirements: z.array(reference).min(1),
  success_criteria: z.array(reference).min(1),
  failure_criteria: z.array(reference).min(1),
  stop_conditions: z.array(reference).min(1),
  reassessment_conditions: z.array(reference).default([]),
  resource_requirements: z.array(reference).default([]),
  intervention_risks: z.array(reference).default([]),
  instance_dependencies: z.array(reference).default([]),
  instance_status: z.enum(PLAYBOOK_INSTANCE_STATUSES),
  trace: z.object({
    template_ref: reference,
    context_ref: reference,
    priority_ref: reference,
    evidence_refs: z.array(reference).default([]),
    selection_reason: reference,
  }),
});
export type PlaybookInstance = z.infer<typeof playbookInstanceSchema>;

export const playbookFrameworkInputSchema = z.object({
  context: playbookContextSchema,
  templates: z.array(playbookTemplateSchema).default([]),
  evaluated_at: z.string().datetime(),
});
export type PlaybookFrameworkInput = z.infer<
  typeof playbookFrameworkInputSchema
>;
export type PlaybookFrameworkInputLike = z.input<
  typeof playbookFrameworkInputSchema
>;

export const playbookFrameworkResultSchema = z.object({
  context_id: reference,
  business_id: reference,
  decision_cycle_id: reference,
  disposition: z.enum(PLAYBOOK_DISPOSITIONS),
  input_fingerprint: reference,
  candidate_evaluations: z.array(playbookCandidateEvaluationSchema),
  selected_instance: playbookInstanceSchema.nullable(),
  reason_codes: z.array(reference).default([]),
  unresolved_unknowns: z.array(reference).default([]),
  source_refs: z.array(reference).default([]),
  evaluated_at: z.string().datetime(),
  deterministic: z.literal(true),
});
export type PlaybookFrameworkResult = z.infer<
  typeof playbookFrameworkResultSchema
>;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "evaluated_at")
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintPlaybookInput(input: unknown): string {
  let hash = 2166136261;
  for (const char of canonical(input)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function evaluateCondition(
  condition: PlaybookCondition,
  facts: Record<string, PlaybookTriState>,
  contraindication: boolean,
): PlaybookConditionEvaluation {
  const observed = facts[condition.fact_ref] ?? "UNKNOWN";
  if (observed === "UNKNOWN") {
    return {
      ...condition,
      observed,
      triggered: null,
    };
  }
  const matches = observed === condition.expected;
  return {
    ...condition,
    observed,
    triggered: contraindication ? matches : matches,
  };
}

function evaluateTemplate(
  context: PlaybookContext,
  template: PlaybookTemplate,
  evaluatedAt: string,
): PlaybookCandidateEvaluation {
  const evidenceRefs = [...context.evidence_refs, ...template.source_refs];
  const extension = template.domain_extension as Record<string, unknown>;
  if (template.domain !== "ACQUISITION" && "acquisition" in extension) {
    return {
      template_id: template.template_id,
      template_version: template.template_version,
      applicability: "REQUIRES_VALIDATION",
      precondition_evaluations: [],
      contraindication_evaluations: [],
      reason_codes: ["ACQ.DOMAIN_EXTENSION_FORBIDDEN"],
      unresolved_unknowns: ["domain_extension.acquisition"],
      evidence_refs: evidenceRefs,
      evaluated_at: evaluatedAt,
      deterministic: true,
    };
  }
  if (template.lifecycle !== "ACTIVE") {
    return {
      template_id: template.template_id,
      template_version: template.template_version,
      applicability: "NOT_APPLICABLE",
      precondition_evaluations: [],
      contraindication_evaluations: [],
      reason_codes: ["TEMPLATE.NOT_ACTIVE"],
      unresolved_unknowns: [],
      evidence_refs: evidenceRefs,
      evaluated_at: evaluatedAt,
      deterministic: true,
    };
  }
  if (template.problem_refs.length > 0 && context.problem_refs.length === 0) {
    return {
      template_id: template.template_id,
      template_version: template.template_version,
      applicability: "REQUIRES_VALIDATION",
      precondition_evaluations: [],
      contraindication_evaluations: [],
      reason_codes: ["CONTEXT.PROBLEM_UNKNOWN"],
      unresolved_unknowns: ["problem_refs"],
      evidence_refs: evidenceRefs,
      evaluated_at: evaluatedAt,
      deterministic: true,
    };
  }
  if (
    template.problem_refs.length > 0 &&
    !template.problem_refs.some((ref) => context.problem_refs.includes(ref))
  ) {
    return {
      template_id: template.template_id,
      template_version: template.template_version,
      applicability: "NOT_APPLICABLE",
      precondition_evaluations: [],
      contraindication_evaluations: [],
      reason_codes: ["CONTEXT.PROBLEM_MISMATCH"],
      unresolved_unknowns: [],
      evidence_refs: evidenceRefs,
      evaluated_at: evaluatedAt,
      deterministic: true,
    };
  }

  const preconditions = template.preconditions.map((condition) =>
    evaluateCondition(condition, context.facts, false),
  );
  const contraindications = template.contraindications.map((condition) =>
    evaluateCondition(condition, context.facts, true),
  );
  const unknowns = [
    ...preconditions
      .filter((condition) => condition.observed === "UNKNOWN")
      .map((condition) => condition.fact_ref),
    ...contraindications
      .filter((condition) => condition.observed === "UNKNOWN")
      .map((condition) => condition.fact_ref),
  ];
  const triggeredContraindication = contraindications.some(
    (condition) => condition.triggered === true,
  );
  if (triggeredContraindication) {
    return {
      template_id: template.template_id,
      template_version: template.template_version,
      applicability: "CONTRAINDICATED",
      precondition_evaluations: preconditions,
      contraindication_evaluations: contraindications,
      reason_codes: ["CONTRAINDICATION.ACTIVE"],
      unresolved_unknowns: unknowns,
      evidence_refs: evidenceRefs,
      evaluated_at: evaluatedAt,
      deterministic: true,
    };
  }
  const hardFailure = preconditions.some(
    (condition) =>
      condition.observed !== "UNKNOWN" &&
      condition.triggered === false &&
      condition.condition_type === "HARD_PRECONDITION",
  );
  if (hardFailure) {
    return {
      template_id: template.template_id,
      template_version: template.template_version,
      applicability: "BLOCKED",
      precondition_evaluations: preconditions,
      contraindication_evaluations: contraindications,
      reason_codes: ["PRECONDITION.HARD_FAIL"],
      unresolved_unknowns: unknowns,
      evidence_refs: evidenceRefs,
      evaluated_at: evaluatedAt,
      deterministic: true,
    };
  }
  const requiresValidation = [...preconditions, ...contraindications].some(
    (condition) =>
      condition.observed === "UNKNOWN" &&
      condition.unknown_policy === "REQUIRE_VALIDATION",
  );
  if (requiresValidation || !context.priority_ref) {
    return {
      template_id: template.template_id,
      template_version: template.template_version,
      applicability: "REQUIRES_VALIDATION",
      precondition_evaluations: preconditions,
      contraindication_evaluations: contraindications,
      reason_codes: [
        ...(requiresValidation ? ["CONDITION.UNKNOWN"] : []),
        ...(!context.priority_ref ? ["CONTEXT.PRIORITY_MISSING"] : []),
      ],
      unresolved_unknowns: [
        ...unknowns,
        ...(!context.priority_ref ? ["priority_ref"] : []),
      ],
      evidence_refs: evidenceRefs,
      evaluated_at: evaluatedAt,
      deterministic: true,
    };
  }
  const limited = [...preconditions, ...contraindications].some(
    (condition) =>
      condition.observed === "UNKNOWN" &&
      condition.unknown_policy === "ALLOW_WITH_LIMITATIONS",
  );
  return {
    template_id: template.template_id,
    template_version: template.template_version,
    applicability: limited ? "APPLICABLE_WITH_CONDITIONS" : "APPLICABLE",
    precondition_evaluations: preconditions,
    contraindication_evaluations: contraindications,
    reason_codes: limited ? ["CONDITION.UNKNOWN_ALLOWED"] : [],
    unresolved_unknowns: unknowns,
    evidence_refs: evidenceRefs,
    evaluated_at: evaluatedAt,
    deterministic: true,
  };
}

function makeInstance(
  context: PlaybookContext,
  template: PlaybookTemplate,
  evaluation: PlaybookCandidateEvaluation,
): PlaybookInstance {
  return {
    instance_id: `instance:${context.context_id}:${template.template_id}:${template.template_version}`,
    playbook_id: template.template_id,
    playbook_version: template.template_version,
    schema_version: template.schema_version,
    context_ref: context.context_id,
    priority_ref: context.priority_ref!,
    decision_cycle_id: context.decision_cycle_id,
    intervention_type: template.intervention_type,
    intervention_hypothesis: `Bajo ${context.context_id}, ${template.intent} deberia producir ${template.expected_effects.join(", ")}`,
    domain_extension: template.domain_extension,
    adaptations: [],
    resolved_steps: template.steps,
    resolved_preconditions: evaluation.precondition_evaluations,
    expected_effects: template.expected_effects,
    validation_requirements: template.validation_requirements,
    success_criteria: template.success_criteria,
    failure_criteria: template.failure_criteria,
    stop_conditions: template.stop_conditions,
    reassessment_conditions: template.reassessment_conditions,
    resource_requirements: template.resource_requirements,
    intervention_risks: template.intervention_risks,
    instance_dependencies: template.dependencies,
    instance_status: "SELECTED",
    trace: {
      template_ref: `${template.template_id}@${template.template_version}`,
      context_ref: context.context_id,
      priority_ref: context.priority_ref!,
      evidence_refs: evaluation.evidence_refs,
      selection_reason: "DETERMINISTIC_FIRST_APPLICABLE_TEMPLATE",
    },
  };
}

function invalidResult(
  raw: PlaybookFrameworkInputLike,
  now: string,
): PlaybookFrameworkResult {
  const context = raw.context as Partial<PlaybookContext> | undefined;
  return {
    context_id: context?.context_id ?? "invalid-context",
    business_id: context?.business_id ?? "invalid-business",
    decision_cycle_id: context?.decision_cycle_id ?? "invalid-cycle",
    disposition: "VALIDATION_REQUIRED",
    input_fingerprint: fingerprintPlaybookInput(raw),
    candidate_evaluations: [],
    selected_instance: null,
    reason_codes: ["INPUT.SCHEMA_INVALID"],
    unresolved_unknowns: ["input_schema"],
    source_refs: [],
    evaluated_at: now,
    deterministic: true,
  };
}

export function evaluatePlaybookFramework(
  raw: PlaybookFrameworkInputLike,
): PlaybookFrameworkResult {
  const now = new Date().toISOString();
  const parsed = playbookFrameworkInputSchema.safeParse(raw);
  if (!parsed.success) return invalidResult(raw, now);
  const input = parsed.data;
  const { context, templates } = input;
  const fingerprint = fingerprintPlaybookInput(input);
  const sourceRefs = [
    ...context.source_versions,
    ...context.diagnosis_refs,
    ...context.evidence_refs,
  ];
  if (templates.length === 0) {
    return playbookFrameworkResultSchema.parse({
      context_id: context.context_id,
      business_id: context.business_id,
      decision_cycle_id: context.decision_cycle_id,
      disposition: "NO_APPLICABLE_PLAYBOOK",
      input_fingerprint: fingerprint,
      candidate_evaluations: [],
      selected_instance: null,
      reason_codes: ["CATALOG.EMPTY"],
      unresolved_unknowns: [],
      source_refs: sourceRefs,
      evaluated_at: input.evaluated_at,
      deterministic: true,
    });
  }
  const evaluations = templates
    .slice()
    .sort((a, b) =>
      `${a.template_id}@${a.template_version}`.localeCompare(
        `${b.template_id}@${b.template_version}`,
      ),
    )
    .map((template) => evaluateTemplate(context, template, input.evaluated_at));
  const applicable = evaluations.find(
    (evaluation) =>
      evaluation.applicability === "APPLICABLE" ||
      evaluation.applicability === "APPLICABLE_WITH_CONDITIONS",
  );
  const selectedTemplate = applicable
    ? templates.find(
        (template) =>
          template.template_id === applicable.template_id &&
          template.template_version === applicable.template_version,
      )
    : undefined;
  if (applicable && selectedTemplate) {
    const instance = makeInstance(context, selectedTemplate, applicable);
    return playbookFrameworkResultSchema.parse({
      context_id: context.context_id,
      business_id: context.business_id,
      decision_cycle_id: context.decision_cycle_id,
      disposition: "READY_FOR_RECOMMENDATION",
      input_fingerprint: fingerprint,
      candidate_evaluations: evaluations,
      selected_instance: instance,
      reason_codes: ["SELECTION.FIRST_APPLICABLE"],
      unresolved_unknowns: applicable.unresolved_unknowns,
      source_refs: sourceRefs,
      evaluated_at: input.evaluated_at,
      deterministic: true,
    });
  }
  const validation = evaluations.filter(
    (evaluation) => evaluation.applicability === "REQUIRES_VALIDATION",
  );
  const blocked = evaluations.some(
    (evaluation) =>
      evaluation.applicability === "BLOCKED" ||
      evaluation.applicability === "CONTRAINDICATED",
  );
  return playbookFrameworkResultSchema.parse({
    context_id: context.context_id,
    business_id: context.business_id,
    decision_cycle_id: context.decision_cycle_id,
    disposition: validation.length
      ? "VALIDATION_REQUIRED"
      : blocked
        ? "BLOCKED"
        : "NO_APPLICABLE_PLAYBOOK",
    input_fingerprint: fingerprint,
    candidate_evaluations: evaluations,
    selected_instance: null,
    reason_codes: validation.length
      ? ["SELECTION.VALIDATION_REQUIRED"]
      : blocked
        ? ["SELECTION.BLOCKED"]
        : ["SELECTION.NONE_APPLICABLE"],
    unresolved_unknowns: [
      ...new Set(validation.flatMap((evaluation) => evaluation.unresolved_unknowns)),
    ],
    source_refs: sourceRefs,
    evaluated_at: input.evaluated_at,
    deterministic: true,
  });
}
