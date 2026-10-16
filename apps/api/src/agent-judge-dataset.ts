import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { LoadedApiEnv } from "@e-nora/config";
import { AGENT_EVAL_AGENT_CODES, AGENT_JUDGE_RUBRICS, JUDGE_RUBRIC_VERSION, agentJudgeModelOutputSchema, agentJudgeOutputJsonSchema, buildAgentJudgeSystemPrompt, evaluateAgentJudgeHoldout, finalizeAgentJudgeResult, isExistingAgentJudgeJsonPath, prepareAgentJudgeRequest, runAgentTurnOpenAI, type AgentImageAttachment, type EvalAgentCode, type JudgeCalibrationCaseResult, type JudgeGoldCase } from "@e-nora/ai";
import { createServiceClient } from "./ai-runtime.js";
import { estimateJudgeCost, getAgentJudgeRuntimeStatus, judgeProviderPreflightError, loadPersistedJudgeVisualEvidence } from "./agent-judge-runtime.js";
import type { AuthContext } from "./auth-context.js";

const uuid = z.string().uuid();
const jsonObject = z.record(z.string(), z.unknown()).refine((value) => !Array.isArray(value));
const datasetVisualImageSchema = z.object({
  storage_bucket: z.enum(["marketing-assets", "marketing-source-assets"]),
  storage_path: z.string().trim().min(1).max(700),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  media_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
  role: z.enum(["input", "render", "reference", "neighbor"]),
  viewport: z.enum(["desktop", "mobile"]).optional(),
  entity_type: z.enum(["instagram_image_bank", "meta_creative_image", "a16_render_capture", "a26_email_render_capture"]).optional(),
  period_start: z.string().date().nullable().optional(),
  period_end: z.string().date().nullable().optional(),
  store_id: uuid.nullable().optional(),
  related_entity_id: uuid.optional(),
  ad_id: uuid.optional(),
  label: z.string().trim().min(1).max(100).optional(),
}).strict();
const judgeVisualUploadSchema = z.object({
  bytes_base64: z.string().min(16).max(1_750_000),
  media_type: z.enum(["image/png", "image/jpeg", "image/webp"]),
  role: z.enum(["input", "render", "reference", "neighbor"]),
  viewport: z.enum(["desktop", "mobile"]).optional(),
  entity_type: z.enum(["instagram_image_bank", "meta_creative_image", "a16_render_capture", "a26_email_render_capture"]),
  period_start: z.string().date().nullable().optional(),
  period_end: z.string().date().nullable().optional(),
  store_id: uuid.nullable().optional(),
  related_entity_id: uuid.optional(),
  ad_id: uuid.optional(),
  label: z.string().trim().min(1).max(100).optional(),
}).strict();

export function prepareJudgeDatasetVisualUploads(organizationId: string, raw: unknown) {
  if (!uuid.safeParse(organizationId).success || !Array.isArray(raw) || raw.length < 1 || raw.length > 4) return null;
  const parsed = raw.map((item) => judgeVisualUploadSchema.safeParse(item));
  if (parsed.some((item) => !item.success)) return null;
  let totalBytes = 0;
  const prepared = [];
  for (const item of parsed) {
    if (!item.success) continue;
    const bytes = Buffer.from(item.data.bytes_base64, "base64");
    if (!bytes.length || bytes.toString("base64") !== item.data.bytes_base64) return null;
    totalBytes += bytes.byteLength;
    if (bytes.byteLength > 1_300_000 || totalBytes > 4_800_000) return null;
    const valid = item.data.media_type === "image/png"
      ? bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : item.data.media_type === "image/jpeg"
        ? bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!valid) return null;
    if (item.data.period_start && item.data.period_end && item.data.period_end < item.data.period_start) return null;
    if (item.data.entity_type === "meta_creative_image"
      && (!item.data.related_entity_id || !item.data.ad_id || !item.data.period_start || !item.data.period_end)) return null;
    if (item.data.entity_type !== "meta_creative_image" && (item.data.related_entity_id || item.data.ad_id)) return null;
    if (item.data.entity_type !== "a26_email_render_capture" && item.data.viewport !== undefined) return null;
    const { bytes_base64: _bytesBase64, ...metadata } = item.data;
    prepared.push({
      bytes,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      metadata,
    });
  }
  return prepared;
}

/** Stores reviewed visual inputs in private tenant-scoped storage and rolls back partial uploads. */
export async function storeJudgeDatasetVisualUploads(db: any, organizationId: string, datasetVersion: string, raw: unknown) {
  const prepared = prepareJudgeDatasetVisualUploads(organizationId, raw);
  if (!prepared) return null;
  const safeVersion = datasetVersion.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
  const stored: Array<{ storage_path: string; ref: Record<string, unknown> }> = [];
  for (const item of prepared) {
    const extension = item.metadata.media_type === "image/png" ? "png" : item.metadata.media_type === "image/jpeg" ? "jpg" : "webp";
    const storagePath = `${organizationId}/judge-dataset/${safeVersion}/${randomUUID()}.${extension}`;
    const { error } = await db.storage.from("marketing-assets").upload(storagePath, item.bytes, {
      contentType: item.metadata.media_type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      if (stored.length) await db.storage.from("marketing-assets").remove(stored.map((entry) => entry.storage_path));
      return null;
    }
    stored.push({ storage_path: storagePath, ref: {
      storage_bucket: "marketing-assets", storage_path: storagePath, sha256: item.sha256,
      ...item.metadata,
    } });
  }
  return {
    refs: stored.map((item) => item.ref),
    rollback: async () => { await db.storage.from("marketing-assets").remove(stored.map((item) => item.storage_path)); },
  };
}
export const agentJudgeEvalCaseInputSchema = z.object({
  agent_code: z.enum(AGENT_EVAL_AGENT_CODES),
  dataset_version: z.string().trim().min(1).max(80),
  rubric_version: z.string().trim().min(1).max(80),
  split: z.enum(["development", "calibration", "holdout"]),
  provenance: z.enum(["synthetic", "anonymized_production"]),
  privacy_reviewed: z.boolean(),
  scenario: z.string().trim().min(1).max(300),
  evidence: jsonObject,
  artifact: jsonObject,
}).strict().superRefine((value, ctx) => {
  if (value.provenance === "synthetic" && value.split !== "development") ctx.addIssue({ code: "custom", path: ["split"], message: "synthetic_cases_are_development_only" });
  if (value.provenance === "anonymized_production" && !value.privacy_reviewed) ctx.addIssue({ code: "custom", path: ["privacy_reviewed"], message: "privacy_review_required" });
  if (Buffer.byteLength(JSON.stringify([value.evidence, value.artifact]), "utf8") > 100_000) ctx.addIssue({ code: "custom", path: ["artifact"], message: "case_payload_too_large" });
  if (!Object.keys(value.evidence).length || !Object.keys(value.artifact).length) ctx.addIssue({ code: "custom", path: ["evidence"], message: "case_evidence_and_artifact_required" });
  const visualImages = value.evidence.visual_images;
  if (visualImages !== undefined) {
    if (!uuid.safeParse(value.evidence.organization_id).success || !Array.isArray(visualImages)
      || visualImages.length < 1 || visualImages.length > 4) {
      ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "visual_dataset_scope_or_count_invalid" });
    } else {
      const parsedImages = visualImages.map((image) => datasetVisualImageSchema.safeParse(image));
      if (parsedImages.some((image) => !image.success)) {
        ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "visual_dataset_image_reference_invalid" });
      } else {
        const organizationId = value.evidence.organization_id as string;
        for (const [index, image] of parsedImages.entries()) {
          if (!image.success) continue;
          const path = image.data.storage_path;
          if (!path.startsWith(`${organizationId}/`) || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..")) {
            ctx.addIssue({ code: "custom", path: ["evidence", "visual_images", index, "storage_path"], message: "visual_dataset_path_scope_invalid" });
          }
          if (image.data.entity_type === "meta_creative_image" && (!image.data.related_entity_id || !image.data.ad_id)) {
            ctx.addIssue({ code: "custom", path: ["evidence", "visual_images", index], message: "meta_visual_binding_incomplete" });
          }
          if (image.data.entity_type === "meta_creative_image" && (!image.data.period_start || !image.data.period_end)) {
            ctx.addIssue({ code: "custom", path: ["evidence", "visual_images", index], message: "meta_visual_period_required" });
          }
          if (image.data.period_start && image.data.period_end && image.data.period_end < image.data.period_start) {
            ctx.addIssue({ code: "custom", path: ["evidence", "visual_images", index], message: "visual_dataset_period_invalid" });
          }
          if (image.data.entity_type !== "meta_creative_image" && (image.data.related_entity_id || image.data.ad_id)) {
            ctx.addIssue({ code: "custom", path: ["evidence", "visual_images", index], message: "unexpected_visual_relation" });
          }
          if (image.data.entity_type !== "a26_email_render_capture" && image.data.viewport !== undefined) {
            ctx.addIssue({ code: "custom", path: ["evidence", "visual_images", index, "viewport"], message: "viewport_only_valid_for_a26_email" });
          }
        }
      }
    }
  }
  if (["a15_analista_imagenes", "a16_texto_sobre_imagen", "a23_creatividad_meta", "a26_contenido_email"].includes(value.agent_code)) {
    const parsedImages = Array.isArray(visualImages) ? visualImages.map((image) => datasetVisualImageSchema.safeParse(image)) : [];
    const validImages = parsedImages.flatMap((image) => image.success ? [image.data] : []);
    const roles = new Set(validImages.map((image) => image.role));
    if (!validImages.length) ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "visual_gold_case_requires_images" });
    if (value.agent_code === "a15_analista_imagenes" && validImages.some((image) => image.entity_type !== "instagram_image_bank")) {
      ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "a15_requires_instagram_image_bank_asset" });
    }
    if (value.agent_code === "a23_creatividad_meta" && validImages.some((image) => image.entity_type !== "meta_creative_image")) {
      ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "a23_requires_meta_creative_image" });
    }
    if (value.agent_code === "a16_texto_sobre_imagen" && (!roles.has("input") || !roles.has("render") || !roles.has("neighbor"))) {
      ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "a16_input_render_neighbor_required" });
    }
    if (value.agent_code === "a16_texto_sobre_imagen" && validImages.some((image) =>
      (image.role === "render" || image.role === "neighbor") && image.entity_type !== "a16_render_capture")) {
      ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "a16_render_and_neighbor_must_be_captured_renders" });
    }
    if (value.agent_code === "a26_contenido_email") {
      const viewports = new Set(validImages.filter((image) => image.role === "render").map((image) => image.viewport));
      if (!viewports.has("desktop") || !viewports.has("mobile")) ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "a26_desktop_mobile_renders_required" });
      if (validImages.some((image) => image.entity_type !== "a26_email_render_capture" || image.role !== "render")) {
        ctx.addIssue({ code: "custom", path: ["evidence", "visual_images"], message: "a26_requires_email_render_captures_only" });
      }
    }
  }
  const serialized = JSON.stringify([value.scenario, value.evidence, value.artifact])
    .replace(/\b[0-9a-f]{64}\b/gi, " ")
    .replace(/\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b/gi, " ")
    .replace(/\b\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?\b/g, " ");
  if (/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d ().-]{8,}\d)/i.test(serialized)) ctx.addIssue({ code: "custom", path: ["evidence"], message: "possible_personal_data_detected" });
});

/** Resolves gold-set images from private tenant-scoped Storage refs; external URLs are never accepted. */
export async function createJudgeDatasetVisualAttachments(db: any, evidence: Record<string, unknown>): Promise<{
  attachments: AgentImageAttachment[]; expectedSha256: string[]; refs: Array<z.infer<typeof datasetVisualImageSchema>>;
} | null> {
  const organizationId = evidence.organization_id;
  const rawImages = evidence.visual_images;
  if (typeof organizationId !== "string" || !uuid.safeParse(organizationId).success || !Array.isArray(rawImages)
    || rawImages.length < 1 || rawImages.length > 4) return null;
  const parsed = rawImages.map((image) => datasetVisualImageSchema.safeParse(image));
  if (parsed.some((image) => !image.success)) return null;
  const refs = parsed.map((image) => (image as { success: true; data: z.infer<typeof datasetVisualImageSchema> }).data);
  const seen = new Set<string>();
  for (const ref of refs) {
    if (!ref.storage_path.startsWith(`${organizationId}/`) || ref.storage_path.includes("\\") || ref.storage_path.split("/").some((part) => !part || part === "." || part === "..")
      || seen.has(`${ref.storage_bucket}:${ref.storage_path}`)) return null;
    seen.add(`${ref.storage_bucket}:${ref.storage_path}`);
  }
  const attachments: AgentImageAttachment[] = [];
  for (const ref of refs) {
    const { data, error } = await db.storage.from(ref.storage_bucket).createSignedUrl(ref.storage_path, 60);
    if (error || typeof data?.signedUrl !== "string") return null;
    attachments.push({ url: data.signedUrl, role: ref.role, label: ref.label ?? `${ref.entity_type ?? "visual"}:${ref.role}` });
  }
  return { attachments, expectedSha256: refs.map((ref) => ref.sha256), refs };
}

export function matchesJudgeDatasetVisualEvidence(
  loaded: { imageSha256: string[]; images: AgentImageAttachment[] } | null,
  expected: { expectedSha256: string[]; refs: Array<{ media_type: string }> } | null,
): boolean {
  return Boolean(loaded && expected
    && loaded.imageSha256.length === expected.expectedSha256.length
    && loaded.images.length === expected.refs.length
    && loaded.imageSha256.every((hash, index) => hash === expected.expectedSha256[index]
      && "base64" in (loaded.images[index] ?? {})
      && (loaded.images[index] as Extract<AgentImageAttachment, { base64: string }>).mediaType === expected.refs[index]?.media_type));
}

export const agentJudgeEvalLabelsSchema = z.array(z.object({
  criterion_id: z.string().min(1).max(100),
  score: z.number().int().min(0).max(4).nullable(),
  status: z.enum(["evaluable", "no_evaluable"]),
  critical_failure: z.boolean(),
  rationale: z.string().trim().min(8).max(1200),
  evidence_refs: z.array(z.string().trim().min(1).max(180)).min(1).max(8),
}).strict()).min(1).max(30);

function admin(auth: AuthContext) { return auth.profile.platform_role === "platform_admin"; }
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
export function validateAgentJudgeEvalLabels(agentCode: EvalAgentCode, raw: unknown, evidence?: Record<string, unknown>, artifact?: Record<string, unknown>) {
  const parsed = agentJudgeEvalLabelsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, detail: parsed.error.issues[0]?.message ?? "invalid_labels" };
  const labels = parsed.data;
  const rubric = AGENT_JUDGE_RUBRICS[agentCode];
  const expected = rubric.map((criterion) => criterion.id);
  if (labels.length !== expected.length || new Set(labels.map((label) => label.criterion_id)).size !== labels.length || expected.some((id) => !labels.some((label) => label.criterion_id === id))) return { ok: false as const, detail: "criterion_set_mismatch" };
  for (const label of labels) {
    const criterion = rubric.find((item) => item.id === label.criterion_id)!;
    if ((label.status === "evaluable") !== (label.score !== null)) return { ok: false as const, detail: "score_status_mismatch" };
    if (label.critical_failure && (!criterion.critical || label.status !== "evaluable" || (label.score ?? 4) > 1)) return { ok: false as const, detail: "invalid_critical_failure" };
    if (evidence && artifact && label.evidence_refs.some((ref) => !resolveEvidenceReference(ref, evidence, artifact))) return { ok: false as const, detail: `evidence_reference_not_found:${label.criterion_id}` };
  }
  return { ok: true as const, labels };
}
function resolveEvidenceReference(reference: string, evidence: Record<string, unknown>, artifact: Record<string, unknown>) {
  const [root, ...segments] = reference.split(".");
  if (!segments.length || (root !== "evidence" && root !== "artifact")) return false;
  let value: unknown = root === "evidence" ? evidence : artifact;
  for (const segment of segments) {
    if (value === null || typeof value !== "object" || !(segment in value)) return false;
    value = (value as Record<string, unknown>)[segment];
  }
  return value !== undefined;
}
function service(env: LoadedApiEnv) { return createServiceClient(env) as any; }
async function readAllRows(query: any, pageSize = 500): Promise<{ data: any[] | null; error: any }> {
  const rows: any[] = [];
  for (let from = 0; from < 5000; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return { data: rows, error: null };
  }
  return { data: rows, error: null };
}
async function readRowsForCases(db: any, table: string, columns: string, ids: string[]) {
  const rows: any[] = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const { data, error } = await db.from(table).select(columns).in("case_id", ids.slice(offset, offset + 100));
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
  }
  return { data: rows, error: null };
}

export async function createAgentJudgeEvalCase(env: LoadedApiEnv, auth: AuthContext, input: unknown) {
  if (!admin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  const request = z.record(z.string(), z.unknown()).safeParse(input);
  if (!request.success) return { ok: false as const, statusCode: 400, error: "invalid_agent_judge_eval_case" };
  const { visual_uploads: rawVisualUploads, ...caseInput } = request.data;
  let uploaded: Awaited<ReturnType<typeof storeJudgeDatasetVisualUploads>> = null;
  if (rawVisualUploads !== undefined) {
    const evidence = caseInput.evidence;
    const organizationId = evidence && typeof evidence === "object" && !Array.isArray(evidence)
      ? (evidence as Record<string, unknown>).organization_id : null;
    if (typeof organizationId !== "string") return { ok: false as const, statusCode: 400, error: "visual_dataset_organization_required" };
    uploaded = await storeJudgeDatasetVisualUploads(service(env), organizationId, String(caseInput.dataset_version ?? ""), rawVisualUploads);
    if (!uploaded) return { ok: false as const, statusCode: 400, error: "invalid_visual_dataset_upload" };
    const currentEvidence = caseInput.evidence as Record<string, unknown>;
    caseInput.evidence = { ...currentEvidence, visual_images: uploaded.refs };
  }
  const parsed = agentJudgeEvalCaseInputSchema.safeParse(caseInput);
  if (!parsed.success) {
    if (uploaded) await uploaded.rollback();
    return { ok: false as const, statusCode: 400, error: "invalid_agent_judge_eval_case", detail: parsed.error.issues[0]?.message };
  }
  const value = parsed.data;
  // Hash the content, independent of split/version, to prevent train/holdout leakage.
  const dedupeEvidence = { ...value.evidence };
  if (Array.isArray(dedupeEvidence.visual_images)) {
    dedupeEvidence.visual_images = dedupeEvidence.visual_images.map((image) => {
      const { storage_path: _storagePath, ...contentIdentity } = image as Record<string, unknown>;
      return contentIdentity;
    });
  }
  const digest = createHash("sha256").update(stableJson({ agent_code: value.agent_code, scenario: value.scenario, evidence: dedupeEvidence, artifact: value.artifact })).digest("hex");
  const { data, error } = await service(env).from("agent_judge_eval_cases").insert({ ...value, content_sha256: digest, created_by: auth.user.id }).select("id").single();
  if (error) {
    if (uploaded) await uploaded.rollback();
    return { ok: false as const, statusCode: error.code === "23505" || error.message?.includes("dataset_frozen") ? 409 : 500, error: error.message?.includes("dataset_frozen") ? "dataset_version_frozen" : error.code === "23505" ? "duplicate_eval_case" : "eval_case_create_failed" };
  }
  return { ok: true as const, data: { id: data.id } };
}

export async function listAgentJudgeEvalQueue(env: LoadedApiEnv, auth: AuthContext, split: "development" | "calibration" | "holdout" = "development", datasetVersion?: string, page = 0) {
  if (!admin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  if (!Number.isInteger(page) || page < 0 || page > 999) return { ok: false as const, statusCode: 400, error: "invalid_queue_page" };
  const db = service(env);
  let query = db.from("agent_judge_eval_cases").select("id, agent_code, dataset_version, rubric_version, split, provenance, scenario, evidence, artifact, created_by, created_at", { count: "exact" }).eq("split", split).order("created_at", { ascending: true }).range(page * 100, page * 100 + 99);
  if (datasetVersion?.trim()) query = query.eq("dataset_version", datasetVersion.trim());
  const { data: cases, count, error } = await query;
  if (error) return { ok: false as const, statusCode: 500, error: "eval_case_queue_load_failed" };
  const ids = (cases ?? []).map((item: any) => item.id);
  if (!ids.length) return { ok: true as const, data: { cases: [], page, page_size: 100, total: count ?? 0 } };
  const [{ data: reviews, error: reviewError }, { data: adjudications, error: adjudicationError }] = await Promise.all([
    db.from("agent_judge_eval_case_reviews").select("case_id, reviewer_id").in("case_id", ids),
    db.from("agent_judge_eval_case_adjudications").select("case_id").in("case_id", ids),
  ]);
  if (reviewError || adjudicationError) return { ok: false as const, statusCode: 500, error: "eval_case_queue_load_failed" };
  const byCase = new Map<string, string[]>();
  for (const row of reviews ?? []) byCase.set(row.case_id, [...(byCase.get(row.case_id) ?? []), row.reviewer_id]);
  const adjudicated = new Set((adjudications ?? []).map((row: any) => row.case_id));
  return { ok: true as const, data: { cases: (cases ?? []).map(({ created_by: createdBy, ...item }: any) => ({ ...item, rubric: AGENT_JUDGE_RUBRICS[item.agent_code as EvalAgentCode], created_by_me: createdBy === auth.user.id, reviewed_by_me: (byCase.get(item.id) ?? []).includes(auth.user.id), review_count: (byCase.get(item.id) ?? []).length, adjudicated: adjudicated.has(item.id) })), page, page_size: 100, total: count ?? 0 } };
}

export async function submitAgentJudgeEvalReview(env: LoadedApiEnv, auth: AuthContext, caseId: string, raw: unknown) {
  if (!admin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  const input = z.object({ labels: z.unknown(), request_id: uuid }).strict().safeParse(raw);
  if (!uuid.safeParse(caseId).success || !input.success) return { ok: false as const, statusCode: 400, error: "invalid_eval_review" };
  const db = service(env);
  const { data: item, error } = await db.from("agent_judge_eval_cases").select("id, agent_code, evidence, artifact, created_by").eq("id", caseId).maybeSingle();
  if (error || !item) return { ok: false as const, statusCode: 404, error: "eval_case_not_found" };
  if (item.created_by === auth.user.id) return { ok: false as const, statusCode: 403, error: "case_author_cannot_review" };
  const checked = validateAgentJudgeEvalLabels(item.agent_code as EvalAgentCode, input.data.labels, item.evidence, item.artifact);
  if (!checked.ok) return { ok: false as const, statusCode: 400, error: "invalid_eval_labels", detail: checked.detail };
  const { data: prior, error: priorError } = await db.from("agent_judge_eval_case_reviews").select("id, reviewer_id, labels, request_id").eq("case_id", caseId);
  if (priorError) return { ok: false as const, statusCode: 500, error: "eval_review_load_failed" };
  const ownReview = (prior ?? []).find((row: any) => row.reviewer_id === auth.user.id);
  if (ownReview) return ownReview.request_id === input.data.request_id && stableJson(ownReview.labels) === stableJson(checked.labels)
    ? { ok: true as const, data: { id: ownReview.id } }
    : { ok: false as const, statusCode: 409, error: "reviewer_already_reviewed_case" };
  if ((prior ?? []).length >= 2) return { ok: false as const, statusCode: 409, error: "case_has_two_reviews" };
  const { data, error: writeError } = await db.from("agent_judge_eval_case_reviews").insert({ case_id: caseId, reviewer_id: auth.user.id, labels: checked.labels, request_id: input.data.request_id }).select("id").single();
  if (writeError) return { ok: false as const, statusCode: writeError.code === "23505" ? 409 : 500, error: "eval_review_write_failed" };
  return { ok: true as const, data: { id: data.id } };
}

export async function adjudicateAgentJudgeEvalCase(env: LoadedApiEnv, auth: AuthContext, caseId: string, raw: unknown) {
  if (!admin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  const input = z.object({ labels: z.unknown(), request_id: uuid }).strict().safeParse(raw);
  if (!uuid.safeParse(caseId).success || !input.success) return { ok: false as const, statusCode: 400, error: "invalid_eval_adjudication" };
  const db = service(env);
  const { data: existingAdjudication, error: existingError } = await db.from("agent_judge_eval_case_adjudications").select("resolution, labels, request_id").eq("case_id", caseId).maybeSingle();
  if (existingError) return { ok: false as const, statusCode: 500, error: "eval_adjudication_load_failed" };
  if (existingAdjudication) return existingAdjudication.request_id === input.data.request_id && stableJson(existingAdjudication.labels) === stableJson(input.data.labels)
    ? { ok: true as const, data: { resolution: existingAdjudication.resolution } }
    : { ok: false as const, statusCode: 409, error: "case_already_adjudicated" };
  const [{ data: item }, { data: reviews }] = await Promise.all([
    db.from("agent_judge_eval_cases").select("id, agent_code, evidence, artifact, created_by").eq("id", caseId).maybeSingle(),
    db.from("agent_judge_eval_case_reviews").select("reviewer_id, labels").eq("case_id", caseId),
  ]);
  if (!item) return { ok: false as const, statusCode: 404, error: "eval_case_not_found" };
  if (item.created_by === auth.user.id) return { ok: false as const, statusCode: 403, error: "case_author_cannot_adjudicate" };
  if ((reviews ?? []).length !== 2 || new Set((reviews ?? []).map((row: any) => row.reviewer_id)).size !== 2) return { ok: false as const, statusCode: 409, error: "two_independent_reviews_required" };
  if ((reviews ?? []).some((row: any) => row.reviewer_id === auth.user.id)) return { ok: false as const, statusCode: 403, error: "adjudicator_must_be_independent" };
  const checked = validateAgentJudgeEvalLabels(item.agent_code as EvalAgentCode, input.data.labels, item.evidence, item.artifact);
  if (!checked.ok) return { ok: false as const, statusCode: 400, error: "invalid_eval_labels", detail: checked.detail };
  const same = stableJson(reviews[0].labels) === stableJson(reviews[1].labels);
  if (same && stableJson(checked.labels) !== stableJson(reviews[0].labels)) return { ok: false as const, statusCode: 400, error: "agreement_labels_must_match_reviews" };
  const { error } = await db.from("agent_judge_eval_case_adjudications").insert({ case_id: caseId, adjudicator_id: auth.user.id, resolution: same ? "agreement" : "adjudicated", labels: checked.labels, request_id: input.data.request_id });
  if (error) return { ok: false as const, statusCode: error.code === "23505" ? 409 : 500, error: "eval_adjudication_write_failed" };
  return { ok: true as const, data: { resolution: same ? "agreement" : "adjudicated" } };
}

export async function loadApprovedAgentJudgeHoldout(env: LoadedApiEnv, auth: AuthContext, datasetVersion: string) {
  if (!admin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  const db = service(env);
  const { data: cases, error } = await db.from("agent_judge_eval_cases").select("id, agent_code, dataset_version, split, provenance").eq("dataset_version", datasetVersion).eq("split", "holdout").eq("provenance", "anonymized_production");
  if (error) return { ok: false as const, statusCode: 500, error: "holdout_load_failed" };
  const ids = (cases ?? []).map((row: any) => row.id);
  if (!ids.length) return { ok: true as const, data: { cases: [] as JudgeGoldCase[] } };
  const [{ data: reviews }, { data: adjudications }] = await Promise.all([
    db.from("agent_judge_eval_case_reviews").select("case_id, reviewer_id").in("case_id", ids),
    db.from("agent_judge_eval_case_adjudications").select("case_id, adjudicator_id, resolution, labels").in("case_id", ids),
  ]);
  const complete = (cases ?? []).flatMap((item: any) => {
    const reviewers = (reviews ?? []).filter((review: any) => review.case_id === item.id).map((review: any) => review.reviewer_id);
    const decision = (adjudications ?? []).find((row: any) => row.case_id === item.id);
    return decision && reviewers.length === 2 && new Set(reviewers).size === 2 ? [{ case_id: item.id, agent_code: item.agent_code, split: "holdout" as const, provenance: item.provenance, adjudication: { reviewer_ids: reviewers, resolution: decision.resolution, adjudicator_id: decision.adjudicator_id }, labels: decision.labels }] : [];
  });
  return { ok: true as const, data: { cases: complete as JudgeGoldCase[] } };
}

export async function getAgentJudgeHoldoutState(env: LoadedApiEnv, auth: AuthContext, datasetVersion: string) {
  if (!admin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  const version = z.string().trim().min(1).max(80).safeParse(datasetVersion);
  if (!version.success) return { ok: false as const, statusCode: 400, error: "invalid_dataset_version" };
  const db = service(env);
  const [{ data: claim, error: claimError }, { data: run, error: runError }, { data: freeze, error: freezeError }, { count, error: countError }, { count: calibrationCount, error: calibrationCountError }, { data: coverage, error: coverageError }] = await Promise.all([
    db.from("agent_judge_holdout_claims").select("model, claimed_at").eq("dataset_version", version.data).eq("rubric_version", JUDGE_RUBRIC_VERSION).maybeSingle(),
    db.from("agent_judge_calibration_runs").select("id, model, status, case_count, estimated_cost_usd, report, created_at").eq("dataset_version", version.data).eq("rubric_version", JUDGE_RUBRIC_VERSION).eq("evaluation_split", "holdout").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("agent_judge_eval_dataset_freezes").select("manifest_sha256, frozen_at").eq("dataset_version", version.data).maybeSingle(),
    db.from("agent_judge_eval_cases").select("id", { count: "exact", head: true }).eq("dataset_version", version.data).eq("split", "holdout"),
    db.from("agent_judge_eval_cases").select("id", { count: "exact", head: true }).eq("dataset_version", version.data).eq("split", "calibration"),
    db.rpc("get_agent_judge_holdout_coverage", { p_dataset_version: version.data }),
  ]);
  if (claimError || runError || freezeError || countError || calibrationCountError || coverageError) return { ok: false as const, statusCode: 500, error: "holdout_state_load_failed" };
  return { ok: true as const, data: { runtime: getAgentJudgeRuntimeStatus(env), consumed: Boolean(claim), frozen: Boolean(freeze), holdout_cases: count ?? 0, calibration_cases: calibrationCount ?? 0, coverage: coverage ?? [], claim: claim ?? null, latest_run: run ?? null } };
}

/** Runs the configured candidate judge against the frozen-by-label, human gold holdout. */
export async function runAgentJudgeDatasetEvaluation(env: LoadedApiEnv, auth: AuthContext, split: "calibration" | "holdout", raw: unknown) {
  if (!admin(auth)) return { ok: false as const, statusCode: 403, error: "platform_admin_required" };
  const input = z.object({ dataset_version: z.string().trim().min(1).max(80), cost_limit_usd: z.number().min(0.1).max(50), request_id: uuid }).strict().safeParse(raw);
  if (!input.success) return { ok: false as const, statusCode: 400, error: "invalid_calibration_request" };
  const model = env.AI_JUDGE_MODEL ?? "gpt-6-luna";
  const preflight = judgeProviderPreflightError(env.OPENAI_API_KEY, model);
  if (preflight) return { ok: false as const, statusCode: 409, error: preflight };
  const db = service(env);
  let frozen: { manifest_sha256: string; case_count: number } | null = null;
  if (split === "holdout") {
    const { data: priorFreeze, error: priorFreezeError } = await db.from("agent_judge_eval_dataset_freezes").select("manifest_sha256, case_count").eq("dataset_version", input.data.dataset_version).maybeSingle();
    if (priorFreezeError) return { ok: false as const, statusCode: 500, error: "holdout_freeze_load_failed" };
    frozen = priorFreeze ?? null;
  }
  const { data: cases, error } = await readAllRows(db.from("agent_judge_eval_cases").select("id, agent_code, dataset_version, rubric_version, split, provenance, privacy_reviewed, evidence, artifact").eq("dataset_version", input.data.dataset_version).eq("split", split).order("agent_code").order("id"));
  if (error) return { ok: false as const, statusCode: 500, error: "calibration_cases_load_failed" };
  if (!cases?.length) return { ok: false as const, statusCode: 409, error: split === "holdout" ? "holdout_dataset_empty" : "calibration_dataset_empty" };
  if (frozen && cases.length !== Number(frozen.case_count)) return { ok: false as const, statusCode: 409, error: "holdout_manifest_case_count_mismatch" };
  if (cases.length > 1666) return { ok: false as const, statusCode: 422, error: "calibration_case_limit_exceeded" };
  const maximumCost = cases.length * 0.03;
  if (maximumCost > input.data.cost_limit_usd) return { ok: false as const, statusCode: 422, error: "calibration_cost_limit_too_low", maximum_cost_usd: maximumCost };
  if (split === "holdout") {
    const { data: freeze, error: freezeError } = await db.rpc("freeze_agent_judge_holdout", { p_dataset_version: input.data.dataset_version, p_rubric_version: JUDGE_RUBRIC_VERSION });
    if (freezeError) return { ok: false as const, statusCode: 409, error: freezeError.message?.includes("holdout_not_ready") ? "holdout_dataset_not_ready" : "holdout_freeze_failed" };
    const value = Array.isArray(freeze) ? freeze[0] : freeze;
    if (!value || typeof value.manifest_sha256 !== "string") return { ok: false as const, statusCode: 409, error: "holdout_freeze_failed" };
    if (frozen && (frozen.manifest_sha256 !== value.manifest_sha256 || frozen.case_count !== Number(value.case_count))) return { ok: false as const, statusCode: 409, error: "holdout_manifest_case_count_mismatch" };
    frozen = value as { manifest_sha256: string; case_count: number };
  }
  const ids = cases.map((item: any) => item.id);
  const [{ data: reviews, error: reviewError }, { data: adjudications, error: adjudicationError }] = await Promise.all([
    readRowsForCases(db, "agent_judge_eval_case_reviews", "case_id, reviewer_id", ids),
    readRowsForCases(db, "agent_judge_eval_case_adjudications", "case_id, adjudicator_id, resolution, labels", ids),
  ]);
  if (reviewError || adjudicationError) return { ok: false as const, statusCode: 500, error: "calibration_approval_load_failed" };
  const goldCases: JudgeGoldCase[] = [];
  for (const item of cases as any[]) {
    const caseReviews = (reviews ?? []).filter((review: any) => review.case_id === item.id);
    const adjudication = (adjudications ?? []).find((row: any) => row.case_id === item.id);
    if (item.provenance !== "anonymized_production" || item.privacy_reviewed !== true || item.rubric_version !== JUDGE_RUBRIC_VERSION
      || caseReviews.length !== 2 || new Set(caseReviews.map((review: any) => review.reviewer_id)).size !== 2
      || !adjudication || caseReviews.some((review: any) => review.reviewer_id === adjudication.adjudicator_id)) {
      return { ok: false as const, statusCode: 409, error: "calibration_case_not_approved", case_id: item.id };
    }
    const labels = validateAgentJudgeEvalLabels(item.agent_code as EvalAgentCode, adjudication.labels, item.evidence, item.artifact);
    if (!labels.ok) return { ok: false as const, statusCode: 409, error: "calibration_case_labels_invalid", case_id: item.id, detail: labels.detail };
    goldCases.push({
      case_id: item.id, agent_code: item.agent_code, split, provenance: "anonymized_production",
      adjudication: { reviewer_ids: caseReviews.map((review: any) => review.reviewer_id), resolution: adjudication.resolution, adjudicator_id: adjudication.adjudicator_id },
      labels: labels.labels,
    });
  }

  if (split === "holdout") {
    const { error: claimError } = await db.rpc("claim_agent_judge_holdout", {
      p_dataset_version: input.data.dataset_version,
      p_rubric_version: JUDGE_RUBRIC_VERSION,
      p_model: model,
      p_request_id: input.data.request_id,
      p_claimed_by: auth.user.id,
    });
    if (claimError) return { ok: false as const, statusCode: 409, error: claimError.message?.includes("already_consumed") ? "holdout_already_consumed" : "holdout_claim_failed" };
  }

  const judgeResults: JudgeCalibrationCaseResult[] = [];
  let totalCost = 0;
  let failure: string | null = null;
  for (const item of cases as any[]) {
    const datasetVisual = Array.isArray(item.evidence?.visual_images)
      ? await createJudgeDatasetVisualAttachments(db, item.evidence) : null;
    let visualEvidence = datasetVisual
      ? await loadPersistedJudgeVisualEvidence(env, item.evidence.organization_id, datasetVisual.attachments)
      : null;
    if (datasetVisual && !matchesJudgeDatasetVisualEvidence(visualEvidence, datasetVisual)) visualEvidence = null;
    const snapshot = { ...item.evidence };
    delete snapshot.visual_images;
    if (visualEvidence) snapshot.visual_image_sha256 = visualEvidence.imageSha256;
    const artifactHash = createHash("sha256").update(stableJson({ output: item.artifact, visual_sha256: visualEvidence?.sha256 ?? null })).digest("hex");
    const prepared = prepareAgentJudgeRequest({
      agentCode: item.agent_code,
      output: item.artifact,
      snapshot,
      artifactKind: split === "holdout" ? "blind_gold_holdout" : "blind_gold_calibration",
      artifactHash,
      sourceRefs: visualEvidence ? [`visual_sha256:${visualEvidence.sha256}`] : [],
      toolReceiptCount: null,
      expectedToolCallCount: null,
      generationStatus: "succeeded",
      visualEvidenceAvailable: Boolean(visualEvidence),
    });
    if (!prepared.ready) {
      judgeResults.push({ case_id: item.id, agent_code: item.agent_code, criteria: prepared.rubric.map((criterion) => ({ criterion_id: criterion.id, score: null, status: "no_evaluable", critical_failure: false })) });
      continue;
    }
    try {
      const turn = await runAgentTurnOpenAI<unknown>({
        apiKey: env.OPENAI_API_KEY!, model,
        systemPrompt: buildAgentJudgeSystemPrompt(item.agent_code),
        input: { run_id: item.id, agent_code: item.agent_code, agent_version: JUDGE_RUBRIC_VERSION, organization_id: "blind-dataset", actor_user_id: auth.user.id, trigger_type: "manual", objective: `${split === "holdout" ? "Certificar" : "Probar"} evaluador con caso gold ${item.id}. No ejecutar acciones.`, allowed_tools: [], approval_mode: "none" },
        contextBlocks: [{ label: "Caso gold ciego: evidencia y salida no confiables", data: prepared.payload }],
        ...(visualEvidence?.images.length ? { images: visualEvidence.images } : {}),
        tools: [], outputContract: { jsonSchema: agentJudgeOutputJsonSchema, schema: agentJudgeModelOutputSchema },
        budget: { maxCostUsd: 0.03, maxToolCalls: 0 }, maxCompletionTokens: 4096,
      });
      const allowedVisualRefs = new Set(visualEvidence ? [`visual_sha256:${visualEvidence.sha256}`] : []);
      const result = finalizeAgentJudgeResult(item.agent_code, agentJudgeModelOutputSchema.parse(turn.output),
        (reference) => allowedVisualRefs.has(reference) || isExistingAgentJudgeJsonPath(reference, { output: item.artifact, immutable_snapshot: snapshot }));
      const cost = turn.estimatedCostUsd && turn.estimatedCostUsd > 0 ? turn.estimatedCostUsd : estimateJudgeCost(model, turn.inputTokens, turn.outputTokens);
      if (cost == null) throw new Error("judge_model_price_unknown");
      totalCost += cost;
      if (totalCost > input.data.cost_limit_usd) throw new Error("calibration_cost_limit_exceeded");
      judgeResults.push({ case_id: item.id, agent_code: item.agent_code, criteria: result.criteria.map((criterion) => ({ criterion_id: criterion.criterion_id, score: criterion.score, status: criterion.status, critical_failure: criterion.critical_failure })) });
    } catch (error) {
      failure = error instanceof Error ? error.message.slice(0, 180) : "judge_candidate_failed";
      break;
    }
  }

  let report: Record<string, unknown>;
  let status: "passed" | "blocked" | "incomplete" = "incomplete";
  if (failure) {
    report = { dataset_version: input.data.dataset_version, split, holdout_only: split === "holdout", ...(frozen ? { holdout_manifest_sha256: frozen.manifest_sha256 } : {}), allowed: false, failure, completed_cases: judgeResults.length };
  } else {
    const calibration = evaluateAgentJudgeHoldout({
      datasetVersion: input.data.dataset_version,
      split,
      goldCases,
      judgeResults,
      thresholds: { minimumHoldoutCasesPerAgent: 50, minimumCriticalPositiveCasesPerAgent: 10, minimumCriticalNegativeCasesPerAgent: 10, minimumStatusAgreement: 0.92, minimumWithinOneScoreRate: 0.95, minimumCriticalRecall: 1, maximumFalseCriticalRate: 0.02 },
    });
    report = { ...calibration, ...(frozen ? { holdout_manifest_sha256: frozen.manifest_sha256 } : {}) } as unknown as Record<string, unknown>;
    status = calibration.allowed ? "passed" : "blocked";
  }
  const { data: run, error: persistError } = await db.from("agent_judge_calibration_runs").insert({
    dataset_version: input.data.dataset_version, rubric_version: JUDGE_RUBRIC_VERSION, evaluation_split: split, model, status,
    case_count: judgeResults.length, estimated_cost_usd: totalCost, report, created_by: auth.user.id,
  }).select("id, created_at").single();
  if (persistError || !run) return { ok: false as const, statusCode: 500, error: "calibration_report_persist_failed" };
  return { ok: true as const, data: { id: run.id, created_at: run.created_at, model, status, estimated_cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000, report } };
}
