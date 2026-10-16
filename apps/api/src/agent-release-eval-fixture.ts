import { createHash } from "node:crypto";
import { z } from "zod";
import { AGENT_EVAL_AGENT_CODES, JUDGE_RUBRIC_VERSION, caminoPlanOutputSchema, caminoWeeklyReviewSchema } from "@e-nora/ai";
import type { LiveAgentEvalCase } from "@e-nora/ai";

const hashSchema = z.string().regex(/^[0-9a-f]{64}$/);
const jsonObjectSchema = z.record(z.string(), z.unknown()).refine((value) => !Array.isArray(value));
const fixtureStatusSchema = z.enum(["available", "empty", "unavailable", "stale", "truncated", "not_requested"]);

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function canonicalSha256(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

const sourceBlockSchema = z.object({
  key: z.string().trim().min(1).max(120),
  status: fixtureStatusSchema,
  content: z.unknown().optional(),
  content_sha256: hashSchema.nullable(),
  as_of: z.string().datetime({ offset: true }).nullable(),
}).strict().superRefine((block, ctx) => {
  if (block.status === "available" && block.content === undefined) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "available_source_content_required" });
  }
  if (block.status !== "available" && block.content !== undefined) {
    ctx.addIssue({ code: "custom", path: ["content"], message: "non_available_source_must_not_carry_content" });
  }
  if (block.content === undefined && block.content_sha256 !== null) {
    ctx.addIssue({ code: "custom", path: ["content_sha256"], message: "missing_content_hash_must_be_null" });
  }
  if (block.content !== undefined && block.content_sha256 !== canonicalSha256(block.content)) {
    ctx.addIssue({ code: "custom", path: ["content_sha256"], message: "source_content_hash_mismatch" });
  }
});

const toolReplaySchema = z.object({
  sequence: z.number().int().nonnegative(),
  tool_name: z.string().trim().min(1).max(120),
  arguments: jsonObjectSchema,
  result: z.unknown(),
  result_sha256: hashSchema,
  side_effect_free: z.literal(true),
  is_error: z.boolean(),
}).strict().superRefine((tool, ctx) => {
  if (tool.result_sha256 !== canonicalSha256(tool.result)) {
    ctx.addIssue({ code: "custom", path: ["result_sha256"], message: "tool_replay_result_hash_mismatch" });
  }
});

const visualArtifactSchema = z.object({
  artifact_id: z.string().uuid(),
  entity_type: z.enum(["instagram_image_bank", "meta_creative_image", "a16_render_capture", "a26_email_render_capture"]),
  organization_id: z.string().uuid(),
  store_id: z.string().uuid().nullable(),
  period_start: z.string().date().nullable(),
  period_end: z.string().date().nullable(),
  /** For Meta: the creative asset row proven to be assigned to ad_id during the frozen period. */
  related_entity_id: z.string().uuid().nullable(),
  ad_id: z.string().uuid().nullable(),
  media_type: z.enum(["image/png", "image/jpeg", "image/webp", "text/html"]),
  sha256: hashSchema,
  /** Inline, privacy-reviewed bytes make the visual input reproducible and hash-verifiable. */
  bytes_base64: z.string().max(1_870_000).optional(),
  role: z.enum(["input", "render", "reference", "neighbor"]),
  viewport: z.enum(["desktop", "mobile"]).optional(),
}).strict().superRefine((artifact, ctx) => {
  if (artifact.period_start && artifact.period_end && artifact.period_end < artifact.period_start) {
    ctx.addIssue({ code: "custom", path: ["period_end"], message: "visual_artifact_period_invalid" });
  }
  if (artifact.entity_type === "meta_creative_image" && (!artifact.related_entity_id || !artifact.ad_id || !artifact.period_start || !artifact.period_end)) {
    ctx.addIssue({ code: "custom", path: ["related_entity_id"], message: "meta_visual_binding_incomplete" });
  }
  if (artifact.entity_type !== "meta_creative_image" && (artifact.related_entity_id || artifact.ad_id)) {
    ctx.addIssue({ code: "custom", path: ["related_entity_id"], message: "unexpected_visual_relation" });
  }
  if (artifact.media_type === "text/html" && artifact.bytes_base64 !== undefined) {
    ctx.addIssue({ code: "custom", path: ["bytes_base64"], message: "html_must_be_frozen_as_a_source_block" });
  }
  if (artifact.entity_type !== "a26_email_render_capture" && artifact.viewport !== undefined) {
    ctx.addIssue({ code: "custom", path: ["viewport"], message: "viewport_only_valid_for_a26_email_renders" });
  }
  if (artifact.media_type !== "text/html" && !artifact.bytes_base64) {
    ctx.addIssue({ code: "custom", path: ["bytes_base64"], message: "visual_artifact_bytes_required" });
  }
  if (artifact.bytes_base64) {
    const bytes = Buffer.from(artifact.bytes_base64, "base64");
    if (!bytes.length || bytes.toString("base64") !== artifact.bytes_base64
      || createHash("sha256").update(bytes).digest("hex") !== artifact.sha256) {
      ctx.addIssue({ code: "custom", path: ["bytes_base64"], message: "visual_artifact_bytes_hash_mismatch" });
    }
    const valid = artifact.media_type === "image/png"
      ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : artifact.media_type === "image/jpeg"
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : artifact.media_type === "image/webp"
          ? bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP"
          : true;
    if (!valid) ctx.addIssue({ code: "custom", path: ["media_type"], message: "visual_artifact_media_signature_mismatch" });
  }
});

/** Inputs required to replay the read-only A19 weekly review without live DB queries. */
export const a19ReviewFixtureContextSchema = z.object({
  schema_version: z.literal("a19-weekly-review-fixture-v1"),
  plan_status: z.literal("approved"),
  plan_version: z.number().int().positive(),
  plan_started_at: z.string().datetime({ offset: true }).nullable(),
  approved_plan: caminoPlanOutputSchema,
  review_window: z.object({ start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }) }).strict()
    .refine((window) => window.end > window.start, "a19_review_window_invalid"),
  goal_progress: caminoWeeklyReviewSchema.shape.goal_progress,
  progress_snapshot: z.object({
    tasks: z.array(z.object({
      id: z.string().min(1), title: z.string().min(1), status: z.string().min(1),
      due_at: z.string().datetime({ offset: true }).nullable(),
      updated_at: z.string().datetime({ offset: true }).nullable(), evidence: z.string(),
    }).strict()),
    milestone_statuses: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), status: z.string().min(1), evidence: z.string() }).strict()),
  }).strict(),
  metric_source_keys: z.object({
    current_window: z.array(z.string().min(1)).min(1),
    comparison_window: z.array(z.string().min(1)).min(1),
    integration_coverage: z.string().min(1),
  }).strict(),
  previous_review: caminoWeeklyReviewSchema.nullable(),
}).strict();

export const agentReleaseEvalFixtureSchema = z.object({
  schema_version: z.literal("agent-release-replay-v1"),
  agent_code: z.enum(AGENT_EVAL_AGENT_CODES),
  dataset_version: z.string().trim().min(1).max(80),
  rubric_version: z.literal(JUDGE_RUBRIC_VERSION),
  split: z.enum(["development", "calibration", "release"]),
  provenance: z.enum(["synthetic", "anonymized_production"]),
  privacy_reviewed: z.boolean(),
  scenario: z.string().trim().min(1).max(300),
  input: z.object({
    objective: z.string().trim().min(1).max(4000),
    parameters: jsonObjectSchema,
  }).strict(),
  scope: z.object({
    organization_ref: z.string().trim().min(1).max(120),
    store_ref: z.string().trim().min(1).max(120).nullable(),
    timezone: z.string().trim().min(1).max(80),
    period_start: z.string().date().nullable(),
    period_end: z.string().date().nullable(),
  }).strict().superRefine((scope, ctx) => {
    if (scope.period_start && scope.period_end && scope.period_end < scope.period_start) {
      ctx.addIssue({ code: "custom", path: ["period_end"], message: "fixture_period_end_before_start" });
    }
  }),
  sources: z.array(sourceBlockSchema).min(1).max(80),
  tool_replay: z.array(toolReplaySchema).max(100),
  visual_artifacts: z.array(visualArtifactSchema).max(8),
  constraints: z.object({
    expected_abstention: z.boolean(),
    required_output_paths: z.array(z.string().trim().min(1).max(180)).max(40),
    forbidden_output_paths: z.array(z.string().trim().min(1).max(180)).max(40),
  }).strict(),
}).strict().superRefine((fixture, ctx) => {
  if (fixture.provenance === "synthetic" && fixture.split !== "development") {
    ctx.addIssue({ code: "custom", path: ["split"], message: "synthetic_release_fixture_forbidden" });
  }
  if (fixture.provenance === "anonymized_production" && !fixture.privacy_reviewed) {
    ctx.addIssue({ code: "custom", path: ["privacy_reviewed"], message: "privacy_review_required" });
  }
  if (fixture.agent_code === "a19_revision_camino") {
    const review = a19ReviewFixtureContextSchema.safeParse(fixture.input.parameters.a19_review_context);
    if (!review.success) {
      ctx.addIssue({ code: "custom", path: ["input", "parameters", "a19_review_context"], message: "a19_review_context_incomplete" });
    } else {
      const sourceKeys = new Set(fixture.sources.map((source) => source.key));
      for (const key of [...review.data.metric_source_keys.current_window,
        ...review.data.metric_source_keys.comparison_window, review.data.metric_source_keys.integration_coverage]) {
        if (!sourceKeys.has(key)) ctx.addIssue({ code: "custom", path: ["sources"], message: `a19_review_metric_source_missing:${key}` });
      }
    }
  }
  for (const [index, artifact] of fixture.visual_artifacts.entries()) {
    if (artifact.organization_id !== fixture.scope.organization_ref) {
      ctx.addIssue({ code: "custom", path: ["visual_artifacts", index, "organization_id"], message: "visual_artifact_scope_mismatch" });
    }
    if (artifact.period_start !== fixture.scope.period_start || artifact.period_end !== fixture.scope.period_end) {
      ctx.addIssue({ code: "custom", path: ["visual_artifacts", index, "period_start"], message: "visual_artifact_period_scope_mismatch" });
    }
    if (fixture.agent_code === "a15_analista_imagenes" && artifact.entity_type !== "instagram_image_bank") {
      ctx.addIssue({ code: "custom", path: ["visual_artifacts", index, "entity_type"], message: "a15_requires_instagram_image_bank_asset" });
    }
    if (fixture.agent_code === "a23_creatividad_meta" && artifact.entity_type !== "meta_creative_image") {
      ctx.addIssue({ code: "custom", path: ["visual_artifacts", index, "entity_type"], message: "a23_requires_meta_creative_image" });
    }
  }
  if (["a15_analista_imagenes", "a16_texto_sobre_imagen", "a23_creatividad_meta", "a26_contenido_email"].includes(fixture.agent_code)) {
    const roles = new Set(fixture.visual_artifacts.map((artifact) => artifact.role));
    if (!roles.has("input") && fixture.agent_code !== "a26_contenido_email") {
      ctx.addIssue({ code: "custom", path: ["visual_artifacts"], message: "visual_input_artifact_required" });
    }
    if (fixture.agent_code === "a16_texto_sobre_imagen" && (!roles.has("render") || !roles.has("neighbor"))) {
      ctx.addIssue({ code: "custom", path: ["visual_artifacts"], message: "a16_input_render_and_neighbor_required" });
    }
    if (fixture.agent_code === "a26_contenido_email") {
      const renderViewports = fixture.visual_artifacts.filter((item) => item.role === "render").map((item) => item.viewport);
      if (!renderViewports.includes("desktop") || !renderViewports.includes("mobile")) {
        ctx.addIssue({ code: "custom", path: ["visual_artifacts"], message: "a26_desktop_and_mobile_renders_required" });
      }
    }
  }
  const artifactIds = fixture.visual_artifacts.map((artifact) => artifact.artifact_id);
  if (new Set(artifactIds).size !== artifactIds.length) {
    ctx.addIssue({ code: "custom", path: ["visual_artifacts"], message: "duplicate_visual_artifact_id" });
  }
  const imageArtifacts = fixture.visual_artifacts.filter((artifact) => artifact.media_type !== "text/html");
  if (imageArtifacts.length > 4 || imageArtifacts.reduce((sum, artifact) => sum + Buffer.from(artifact.bytes_base64 ?? "", "base64").byteLength, 0) > 5 * 1024 * 1024) {
    ctx.addIssue({ code: "custom", path: ["visual_artifacts"], message: "visual_fixture_image_budget_exceeded" });
  }
  const sourceKeys = fixture.sources.map((source) => source.key);
  if (new Set(sourceKeys).size !== sourceKeys.length) {
    ctx.addIssue({ code: "custom", path: ["sources"], message: "duplicate_fixture_source_key" });
  }
  const toolSequences = fixture.tool_replay.map((tool) => tool.sequence);
  if (new Set(toolSequences).size !== toolSequences.length) {
    ctx.addIssue({ code: "custom", path: ["tool_replay"], message: "duplicate_tool_replay_sequence" });
  }
  if (toolSequences.some((sequence, index) => sequence !== index)) {
    ctx.addIssue({ code: "custom", path: ["tool_replay"], message: "tool_replay_sequence_must_be_contiguous" });
  }
  const paths = [...fixture.constraints.required_output_paths, ...fixture.constraints.forbidden_output_paths];
  if (new Set(paths).size !== paths.length) {
    ctx.addIssue({ code: "custom", path: ["constraints"], message: "duplicate_or_conflicting_output_constraint" });
  }
  const serialized = JSON.stringify(fixture);
  if (Buffer.byteLength(serialized, "utf8") > 8 * 1024 * 1024) {
    ctx.addIssue({ code: "custom", path: ["sources"], message: "release_fixture_payload_too_large" });
  }
  const privacyScan = serialized
    .replace(/\b[0-9a-f]{64}\b/gi, " ")
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?\b/g, " ");
  if (/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d ().-]{8,}\d)/i.test(privacyScan)) {
    ctx.addIssue({ code: "custom", path: ["input"], message: "possible_personal_data_detected" });
  }
});

export type AgentReleaseEvalFixture = z.infer<typeof agentReleaseEvalFixtureSchema>;

/** Convert stored, validated fixture rows to the live evaluator's immutable input contract. */
export function buildAgentReleaseFixtureLiveEvalCases(
  rows: readonly { id: string; fixture: AgentReleaseEvalFixture }[],
): LiveAgentEvalCase[] {
  return rows.map(({ id, fixture }) => ({
    id,
    agentCode: fixture.agent_code,
    datasetSplit: fixture.split === "development" ? "smoke" : fixture.split === "calibration" ? "gold" : "holdout",
    objective: fixture.input.objective,
    expectedAbstention: fixture.constraints.expected_abstention,
    evidenceContext: {
      organizationId: fixture.scope.organization_ref,
      availableSources: fixture.sources
        .filter((source) => source.status === "available")
        .map((source) => ({ reference: source.key, organizationId: fixture.scope.organization_ref })),
    },
    outputConstraints: {
      requiredPaths: fixture.constraints.required_output_paths,
      forbiddenPaths: fixture.constraints.forbidden_output_paths,
    },
    fixture: structuredClone(fixture) as unknown as Readonly<Record<string, unknown>>,
  }));
}

export function validateAgentReleaseEvalFixture(raw: unknown) {
  const parsed = agentReleaseEvalFixtureSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, detail: parsed.error.issues[0]?.message ?? "invalid_release_fixture" };
  const { split: _split, dataset_version: _datasetVersion, rubric_version: _rubricVersion, ...content } = parsed.data;
  const contentSha256 = canonicalSha256(content);
  return { ok: true as const, fixture: parsed.data, contentSha256 };
}
