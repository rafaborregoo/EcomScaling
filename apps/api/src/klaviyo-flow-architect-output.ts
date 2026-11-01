import { z } from "zod";
import { agentOutputJsonSchema, agentOutputSchema, agentProposedWriteSchema } from "@e-nora/ai";

const flowArchitectureSchema = z.object({
  decision: z.enum(["no_change", "needs_validation", "design_proposal"]),
  summary: z.string().trim().min(1).max(1200),
  candidates: z.array(z.object({
    action: z.enum(["create", "adjust", "retire", "measure"]),
    name: z.string().trim().min(1).max(160),
    objective: z.string().trim().min(1).max(500),
    entry_trigger: z.string().trim().min(1).max(500),
    trigger_verification: z.enum(["verified", "unverified", "not_available"]),
    source_flow_refs: z.array(z.string().regex(/^flow-[0-9]{3}$/)).max(8).default([]),
    entry_conditions: z.array(z.string().trim().min(1).max(300)).max(8),
    exit_conditions: z.array(z.string().trim().min(1).max(300)).max(8),
    exclusions: z.array(z.string().trim().min(1).max(300)).max(8),
    sequence: z.array(z.object({
      step: z.number().int().min(1).max(8),
      channel: z.enum(["email", "sms", "push", "wait", "branch", "other"]),
      delay: z.string().trim().min(1).max(120),
      purpose: z.string().trim().min(1).max(300),
    })).max(8).superRefine((steps, ctx) => {
      const numbers = steps.map((step) => step.step).sort((left, right) => left - right);
      if (new Set(numbers).size !== numbers.length || numbers.some((step, index) => step !== index + 1)) {
        ctx.addIssue({ code: "custom", message: "Los pasos deben ser únicos y consecutivos desde 1." });
      }
    }),
    cadence: z.string().trim().min(1).max(300),
    priority: z.enum(["low", "medium", "high"]),
    primary_kpi: z.string().trim().min(1).max(200),
    stop_rule: z.string().trim().min(1).max(500),
    evidence: z.array(z.object({
      source: z.string().trim().min(1).max(160),
      period: z.string().trim().min(1).max(120),
      sample_size: z.number().int().nonnegative().nullable(),
      coverage: z.enum(["complete", "partial", "insufficient", "not_available"]),
    })).max(8),
    data_gaps: z.array(z.string().trim().min(1).max(300)).max(8),
    conflicts: z.array(z.object({
      existing_flow_or_campaign: z.string().trim().min(1).max(160),
      conflict: z.string().trim().min(1).max(300),
      resolution: z.string().trim().min(1).max(300),
    })).max(8),
  })).max(4),
}).superRefine((architecture, ctx) => {
  if (architecture.decision === "design_proposal" && architecture.candidates.length === 0) {
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "Una propuesta de diseño necesita al menos un candidato." });
  }
  if (architecture.decision === "no_change" && architecture.candidates.length > 0) {
    ctx.addIssue({ code: "custom", path: ["candidates"], message: "Una decisión de no cambiar no puede incluir candidatos." });
  }
  for (const [index, candidate] of architecture.candidates.entries()) {
    if (candidate.trigger_verification === "verified" && candidate.evidence.length === 0) {
      ctx.addIssue({ code: "custom", path: ["candidates", index, "trigger_verification"], message: "Un disparador verificado requiere evidencia." });
    }
    if (["adjust", "retire"].includes(candidate.action) && candidate.source_flow_refs.length === 0) {
      ctx.addIssue({ code: "custom", path: ["candidates", index, "source_flow_refs"], message: "Ajustar o retirar requiere enlazar un flow observado." });
    }
    if (candidate.action === "measure" && candidate.sequence.some((step) => step.channel !== "wait" && step.channel !== "branch")) {
      ctx.addIssue({ code: "custom", path: ["candidates", index, "sequence"], message: "Una medición no puede activar comunicaciones." });
    }
  }
});

export const klaviyoFlowArchitectOutputSchema = agentOutputSchema.extend({
  proposed_writes: z.array(agentProposedWriteSchema).max(4),
  flow_architecture: flowArchitectureSchema,
}).superRefine((output, ctx) => {
  output.flow_architecture.candidates.forEach((candidate, index) => {
    if (candidate.trigger_verification === "verified" && !candidate.source_flow_refs.length) {
      ctx.addIssue({ code: "custom", path: ["flow_architecture", "candidates", index, "source_flow_refs"], message: "El disparador verificado requiere un flow de origen observado." });
    }
  });
  const validFlowRefs = new Set(output.flow_architecture.candidates.flatMap((candidate) => candidate.source_flow_refs));
  output.proposed_writes.forEach((write, index) => {
    if (write.kind !== "task") ctx.addIssue({ code: "custom", path: ["proposed_writes", index, "kind"], message: "A28 solo crea tareas revisables." });
    const hasPlanIdentity = write.plan_id != null || write.plan_version != null || write.plan_revision != null || write.milestone_id != null || write.phase != null;
    if (hasPlanIdentity && (!write.plan_id || !write.plan_version || !write.plan_revision)) {
      ctx.addIssue({ code: "custom", path: ["proposed_writes", index], message: "La alineación requiere plan, versión y revisión exactos." });
    }
    if (write.architecture_candidate_index != null && (!Number.isInteger(write.architecture_candidate_index) || write.architecture_candidate_index < 0 || write.architecture_candidate_index >= output.flow_architecture.candidates.length)) {
      ctx.addIssue({ code: "custom", path: ["proposed_writes", index, "architecture_candidate_index"], message: "La tarea debe enlazar un candidato de arquitectura de esta salida." });
    }
    const linkedCandidate = write.architecture_candidate_index == null ? null : output.flow_architecture.candidates[write.architecture_candidate_index];
    const linkedCandidateRefs = new Set(linkedCandidate?.source_flow_refs ?? []);
    if ((write.source_flow_refs ?? []).some((ref) => !validFlowRefs.has(ref) || !linkedCandidateRefs.has(ref))) {
      ctx.addIssue({ code: "custom", path: ["proposed_writes", index, "source_flow_refs"], message: "La tarea debe enlazar flows citados en la arquitectura de esta salida." });
    }
    if (output.flow_architecture.candidates.length && write.architecture_candidate_index == null) {
      ctx.addIssue({ code: "custom", path: ["proposed_writes", index, "architecture_candidate_index"], message: "La tarea debe enlazar el candidato que concreta." });
    }
  });
});

export type KlaviyoFlowArchitectOutput = z.infer<typeof klaviyoFlowArchitectOutputSchema>;

/** Keep approved A28 designs useful to sibling agents without passing arbitrary output JSON. */
export function summarizeKlaviyoFlowArchitecture(value: unknown) {
  const parsed = flowArchitectureSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    decision: parsed.data.decision,
    summary: parsed.data.summary.slice(0, 500),
    candidates: parsed.data.candidates.map((candidate) => ({
      action: candidate.action,
      name: candidate.name.slice(0, 100),
      objective: candidate.objective.slice(0, 240),
      entry_trigger: candidate.entry_trigger.slice(0, 240),
      trigger_verification: candidate.trigger_verification,
      source_flow_refs: candidate.source_flow_refs,
      entry_conditions: candidate.entry_conditions,
      exit_conditions: candidate.exit_conditions,
      exclusions: candidate.exclusions,
      sequence: candidate.sequence,
      cadence: candidate.cadence.slice(0, 160),
      priority: candidate.priority,
      primary_kpi: candidate.primary_kpi.slice(0, 120),
      stop_rule: candidate.stop_rule.slice(0, 240),
      evidence: candidate.evidence,
      data_gaps: candidate.data_gaps,
      conflicts: candidate.conflicts,
    })),
  };
}

type JsonSchemaObject = {
  type: "object";
  additionalProperties: false;
  required: string[];
  properties: Record<string, unknown>;
};

const baseJsonSchema = structuredClone(agentOutputJsonSchema) as unknown as JsonSchemaObject;
const proposedWritesJsonSchema = baseJsonSchema.properties.proposed_writes as { maxItems?: number; items?: { properties?: Record<string, unknown> } };
proposedWritesJsonSchema.maxItems = 4;
const proposedWriteKind = proposedWritesJsonSchema.items?.properties?.kind as { enum?: string[] } | undefined;
if (proposedWriteKind) proposedWriteKind.enum = ["task"];

export const klaviyoFlowArchitectJsonSchema = {
  ...baseJsonSchema,
  required: [...baseJsonSchema.required, "flow_architecture"],
  properties: {
    ...baseJsonSchema.properties,
    flow_architecture: {
      type: "object",
      additionalProperties: false,
      required: ["decision", "summary", "candidates"],
      properties: {
        decision: { type: "string", enum: ["no_change", "needs_validation", "design_proposal"] },
        summary: { type: "string" },
        candidates: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "name", "objective", "entry_trigger", "trigger_verification", "source_flow_refs", "entry_conditions", "exit_conditions", "exclusions", "sequence", "cadence", "priority", "primary_kpi", "stop_rule", "evidence", "data_gaps", "conflicts"],
            properties: {
              action: { type: "string", enum: ["create", "adjust", "retire", "measure"] },
              name: { type: "string" },
              objective: { type: "string" },
              entry_trigger: { type: "string" },
              trigger_verification: { type: "string", enum: ["verified", "unverified", "not_available"] },
              source_flow_refs: { type: "array", maxItems: 8, items: { type: "string", pattern: "^flow-[0-9]{3}$" } },
              entry_conditions: { type: "array", maxItems: 8, items: { type: "string", maxLength: 300 } },
              exit_conditions: { type: "array", maxItems: 8, items: { type: "string", maxLength: 300 } },
              exclusions: { type: "array", maxItems: 8, items: { type: "string", maxLength: 300 } },
              sequence: {
                type: "array",
                maxItems: 8,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["step", "channel", "delay", "purpose"],
                  properties: {
                    step: { type: "integer", minimum: 1, maximum: 8 },
                    channel: { type: "string", enum: ["email", "sms", "push", "wait", "branch", "other"] },
                    delay: { type: "string" },
                    purpose: { type: "string" },
                  },
                },
              },
              cadence: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              primary_kpi: { type: "string" },
              stop_rule: { type: "string" },
              evidence: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["source", "period", "sample_size", "coverage"],
                  properties: {
                    source: { type: "string" },
                    period: { type: "string" },
                    sample_size: { type: ["integer", "null"], minimum: 0 },
                    coverage: { type: "string", enum: ["complete", "partial", "insufficient", "not_available"] },
                  },
                },
              },
              data_gaps: { type: "array", maxItems: 8, items: { type: "string", maxLength: 300 } },
              conflicts: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["existing_flow_or_campaign", "conflict", "resolution"],
                  properties: {
                    existing_flow_or_campaign: { type: "string" },
                    conflict: { type: "string" },
                    resolution: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;
