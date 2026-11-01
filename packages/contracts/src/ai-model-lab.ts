import { z } from "zod";

const count = z.number().int().nonnegative();
const modelId = z.string().regex(/^(?:claude-|gpt-)[a-z0-9.-]+$/);
const agentCode = z.string().regex(/^a\d{2}_[a-z0-9_]+$/);
const sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export const aiModelLabReviewSchema = z.object({
  status: z.enum(["pending", "reviewed"]),
  method: z.enum(["pending", "automated", "manual"]).default("pending"),
  reviewer: z.string().nullable().default(null),
  verdict: z.string().nullable(),
  notes: z.array(z.string()),
});
export const aiModelLabMeetingAssessmentSchema = z.object({
  rubric_version: z.string().optional(),
  reference_hash: sha256,
  output_hash: sha256,
  judges: z.array(
    z.object({
      id: modelId,
      status: z.enum(["completed", "failed", "blocked"]),
      error: z.string().nullable(),
    }),
  ),
  checks: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      status: z.enum(["pass", "fail", "uncertain"]),
      adjudication: z
        .object({
          original_status: z.enum(["pass", "fail", "uncertain"]),
          method: z.literal("source_and_arithmetic_check"),
          note: z.string(),
        })
        .optional(),
      reference_quote: z.string(),
      judgments: z.array(
        z.object({
          reviewer: modelId,
          status: z.enum(["pass", "fail", "uncertain"]),
          output_quote: z.string(),
          note: z.string(),
        }),
      ),
    }),
  ),
});
export const aiModelLabReportSchema = z.object({
  version: z.literal(1),
  updated_at: z.string().datetime(),
  target: z.object({
    project_ref: z.string(),
    organization_id: z.string().uuid(),
    owner: z.string().email(),
    consultant: z.string().email(),
    assignment_verified: z.boolean(),
    stores: z.array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        active: z.boolean(),
      }),
    ),
  }),
  models: z.array(
    z.object({
      id: modelId,
      label: z.string(),
      provider: z.enum(["anthropic", "openai"]),
    }),
  ),
  cases: z.array(
    z.object({
      id: z.string(),
      agent_code: agentCode,
      agent_name: z.string(),
      model_ids: z.array(modelId).optional(),
      store_id: z.string().uuid().nullable(),
      snapshot_at: z.string().nullable(),
      source_run_id: z.string().uuid().nullable(),
      source: z.enum([
        "snapshot_replay",
        "call_transcript",
        "synthetic_transcript",
        "synthetic_snapshot",
        "read_only_query",
        "missing_data",
      ]),
      prompt_hash: sha256,
      context_hash: sha256,
      prompt_version: z.string(),
      context_labels: z.array(z.string()),
      allowed_tools: z.array(z.string()),
      limitations: z.array(z.string()),
      input_characters: count,
      label: z.string().optional(),
      timeout_ms: z.number().int().min(1000).max(600_000).optional(),
      schema_file: z
        .string()
        .regex(/^[a-z0-9._-]+\.json$/)
        .optional(),
      schema_hash: sha256.optional(),
      meeting_benchmark: z
        .object({
          simulated_minutes: z.number().int().positive(),
          transcript_words: count,
          speaker_count: count,
          turn_count: count,
          reference_hash: sha256,
          database_call_id: z.string().uuid().optional(),
        })
        .optional(),
      monitor_benchmark: z
        .object({
          dashboard_scope: z.enum([
            "overview",
            "shopify",
            "meta",
            "klaviyo",
            "panel",
          ]),
          reference_hash: sha256,
        })
        .optional(),
      task_benchmark: z
        .object({ scenario: z.string(), reference_hash: sha256 })
        .optional(),
      campaign_benchmark: z
        .object({ scenario: z.string(), reference_hash: sha256 })
        .optional(),
      stock_benchmark: z
        .object({ scenario: z.string(), reference_hash: sha256 })
        .optional(),
    }),
  ),
  results: z.array(
    z.object({
      id: z.string(),
      case_id: z.string(),
      model_id: modelId,
      actual_model: z.string().nullable(),
      model_verified: z.boolean(),
      status: z.enum([
        "pending",
        "running",
        "completed",
        "failed",
        "blocked",
        "skipped",
      ]),
      started_at: z.string().nullable(),
      duration_ms: count.nullable(),
      cli_version: z.string().nullable(),
      error: z.string().nullable(),
      raw_response: z.string(),
      normalized: z.object({
        summary: z.string(),
        findings: z.array(z.string()),
        recommendations: z.array(z.string()),
        warnings: z.array(z.string()),
      }),
      checks: z.object({
        json_valid: z.boolean().nullable(),
        nonempty: z.boolean().nullable(),
        native_contract: z.boolean().nullable(),
      }),
      usage: z.object({
        input: count.nullable(),
        cached: count.nullable(),
        cache_creation: count.nullable(),
        output: count.nullable(),
      }),
      provider_reported_cost: z.number().nonnegative().nullable(),
      review: aiModelLabReviewSchema,
      meeting_assessment: aiModelLabMeetingAssessmentSchema.optional(),
      field_assessment: aiModelLabMeetingAssessmentSchema.optional(),
    }),
  ),
  issues: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(["high", "medium", "low"]),
      title: z.string(),
      detail: z.string(),
      status: z.enum(["open", "fixed", "limited"]),
      agent_code: agentCode.nullable(),
      evidence: z.string(),
      resolution: z.string().nullable(),
    }),
  ),
});
export type AiModelLabReport = z.infer<typeof aiModelLabReportSchema>;
export type AiModelLabResult = AiModelLabReport["results"][number];
