import { z } from "zod";
import { agentOutputJsonSchema, agentOutputSchema } from "@e-nora/ai";

const flowArchitectureSchema = z.object({
  decision: z.enum(["no_change", "needs_validation", "design_proposal"]),
  summary: z.string().trim().min(1).max(1200),
  candidates: z.array(z.object({
    action: z.enum(["create", "adjust", "retire", "measure"]),
    name: z.string().trim().min(1).max(160),
    objective: z.string().trim().min(1).max(500),
    entry_trigger: z.string().trim().min(1).max(500),
    trigger_verification: z.enum(["verified", "unverified", "not_available"]),
    entry_conditions: z.array(z.string().trim().min(1).max(300)).max(8),
    exit_conditions: z.array(z.string().trim().min(1).max(300)).max(8),
    exclusions: z.array(z.string().trim().min(1).max(300)).max(8),
    sequence: z.array(z.object({
      step: z.number().int().min(1).max(8),
      channel: z.enum(["email", "sms", "push", "wait", "branch", "other"]),
      delay: z.string().trim().min(1).max(120),
      purpose: z.string().trim().min(1).max(300),
    })),
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
});

export const klaviyoFlowArchitectOutputSchema = agentOutputSchema.extend({
  flow_architecture: flowArchitectureSchema,
});

export type KlaviyoFlowArchitectOutput = z.infer<typeof klaviyoFlowArchitectOutputSchema>;

/** Keep approved A28 designs useful to sibling agents without passing arbitrary output JSON. */
export function summarizeKlaviyoFlowArchitecture(value: unknown) {
  const parsed = flowArchitectureSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    decision: parsed.data.decision,
    summary: parsed.data.summary.slice(0, 500),
    candidates: parsed.data.candidates.slice(0, 3).map((candidate) => ({
      action: candidate.action,
      name: candidate.name.slice(0, 100),
      objective: candidate.objective.slice(0, 240),
      entry_trigger: candidate.entry_trigger.slice(0, 240),
      trigger_verification: candidate.trigger_verification,
      entry_conditions: candidate.entry_conditions.slice(0, 4),
      exit_conditions: candidate.exit_conditions.slice(0, 4),
      exclusions: candidate.exclusions.slice(0, 4),
      sequence: candidate.sequence.slice(0, 5),
      cadence: candidate.cadence.slice(0, 160),
      priority: candidate.priority,
      primary_kpi: candidate.primary_kpi.slice(0, 120),
      stop_rule: candidate.stop_rule.slice(0, 240),
      evidence: candidate.evidence.slice(0, 4),
      data_gaps: candidate.data_gaps.slice(0, 5),
      conflicts: candidate.conflicts.slice(0, 4),
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
          items: {
            type: "object",
            additionalProperties: false,
            required: ["action", "name", "objective", "entry_trigger", "trigger_verification", "entry_conditions", "exit_conditions", "exclusions", "sequence", "cadence", "priority", "primary_kpi", "stop_rule", "evidence", "data_gaps", "conflicts"],
            properties: {
              action: { type: "string", enum: ["create", "adjust", "retire", "measure"] },
              name: { type: "string" },
              objective: { type: "string" },
              entry_trigger: { type: "string" },
              trigger_verification: { type: "string", enum: ["verified", "unverified", "not_available"] },
              entry_conditions: { type: "array", items: { type: "string" } },
              exit_conditions: { type: "array", items: { type: "string" } },
              exclusions: { type: "array", items: { type: "string" } },
              sequence: {
                type: "array",
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
              data_gaps: { type: "array", items: { type: "string" } },
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
