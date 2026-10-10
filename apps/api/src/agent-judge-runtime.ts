import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  AGENT_EVAL_AGENT_CODES,
  AGENT_JUDGE_RUBRICS,
  JUDGE_RUBRIC_VERSION,
  agentJudgeModelOutputSchema,
  agentJudgeOutputJsonSchema,
  buildAgentJudgeSystemPrompt,
  finalizeAgentJudgeResult,
  isExistingAgentJudgeJsonPath,
  prepareAgentJudgeRequest,
  pricingFor,
  runAgentTurnOpenAI,
  type AgentImageAttachment,
  type AgentInput,
  type AgentJudgeResult,
} from "@e-nora/ai";

const JUDGE_MAX_COST_USD = 0.03;

export type PersistedJudgeOutcome = {
  judgment_id: string | null;
  status: AgentJudgeResult["status"] | "error" | "disabled" | "queued";
  result?: AgentJudgeResult;
  error_code?: string;
};

type JudgeInput = {
  organizationId: string;
  actorUserId: string;
  runId: string;
  outputId: string | null;
  agentCode: string;
  artifactKind: string;
  output: unknown;
  generationStatus: string;
  triggerType: AgentInput["trigger_type"];
  expectedToolCallCount: number;
  visualEvidenceAvailable?: boolean;
  visualEvidence?: PersistedJudgeVisualEvidence | null;
};

type AgentJudgeQueuePayload = JudgeInput;

// Una llamada al juez puede agotar el timeout de resiliencia (45 s) tres
// veces, además de los backoffs (máximo 1,8 s). Deja margen para las lecturas
// y persistencias que rodean al proveedor y evita que otra instancia reclame
// el mismo job mientras sigue ejecutándose.
export const JUDGE_QUEUE_LEASE_MS = 240_000;
const JUDGE_QUEUE_MAX_ATTEMPTS = 3;

function judgeQueueRetryDelayMs(attempt: number): number {
  return Math.min(5 * 60_000, 30_000 * 2 ** Math.max(0, attempt - 1));
}

function validJudgeQueuePayload(value: unknown): value is AgentJudgeQueuePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return typeof input.organizationId === "string"
    && typeof input.actorUserId === "string"
    && typeof input.runId === "string"
    && (typeof input.outputId === "string" || input.outputId === null)
    && typeof input.agentCode === "string"
    && typeof input.artifactKind === "string"
    && typeof input.generationStatus === "string"
    && typeof input.triggerType === "string"
    && typeof input.expectedToolCallCount === "number";
}

export type PersistedJudgeVisualEvidence = {
  images: AgentImageAttachment[];
  sha256: string;
};

const MAX_JUDGE_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_JUDGE_IMAGES = 4;

/** Congela en hash+bytes activos visuales propios: URL de buckets de E-NORA o bytes ya validados por un preparador interno. */
export async function loadPersistedJudgeVisualEvidence(
  env: LoadedApiEnv,
  organizationId: string,
  attachments: AgentImageAttachment[],
  fetchImpl: typeof fetch = fetch,
): Promise<PersistedJudgeVisualEvidence | null> {
  if (attachments.length === 0 || attachments.length > MAX_JUDGE_IMAGES) return null;
  let storageOrigin: string;
  try { storageOrigin = new URL(env.SUPABASE_URL).origin; } catch { return null; }
  const loaded: Array<{ image: AgentImageAttachment; hash: string }> = [];
  let totalBytes = 0;
  for (let index = 0; index < attachments.length; index += 1) {
    const attachment = attachments[index]!;
    let bytes: Buffer;
    let mediaType: "image/png" | "image/jpeg" | "image/webp";
    if ("base64" in attachment) {
      if (attachment.base64.length > Math.ceil(MAX_JUDGE_IMAGE_BYTES * 4 / 3) + 8) return null;
      bytes = Buffer.from(attachment.base64, "base64");
      if (bytes.toString("base64") !== attachment.base64) return null;
      mediaType = attachment.mediaType;
    } else {
      let url: URL;
      try { url = new URL(attachment.url); } catch { return null; }
      let decodedPath: string;
      try { decodedPath = decodeURIComponent(url.pathname); } catch { return null; }
      const safePath = new RegExp(`^/storage/v1/object/(?:public|sign)/(?:marketing-assets|marketing-source-assets)/${organizationId}/`);
      if (url.origin !== storageOrigin || !safePath.test(decodedPath)) return null;
      let response: Response;
      try {
        response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(8_000) });
      } catch { return null; }
      if (!response.ok || !response.body) return null;
      const headerMediaType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
      if (headerMediaType !== "image/png" && headerMediaType !== "image/jpeg" && headerMediaType !== "image/webp") return null;
      const declaredBytes = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredBytes) && declaredBytes > MAX_JUDGE_IMAGE_BYTES) return null;
      mediaType = headerMediaType;
      try {
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let imageBytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          imageBytes += value.byteLength;
          if (imageBytes > MAX_JUDGE_IMAGE_BYTES) {
            await reader.cancel();
            return null;
          }
          chunks.push(value);
        }
        bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
      } catch { return null; }
    }
    totalBytes += bytes.byteLength;
    if (!bytes.byteLength || bytes.byteLength > MAX_JUDGE_IMAGE_BYTES || totalBytes > 2 * MAX_JUDGE_IMAGE_BYTES) return null;
    const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isWebp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if ((mediaType === "image/png" && !isPng) || (mediaType === "image/jpeg" && !isJpeg) || (mediaType === "image/webp" && !isWebp)) return null;
    const hash = createHash("sha256").update(bytes).digest("hex");
    loaded.push({
      image: {
        base64: bytes.toString("base64"),
        mediaType,
        ...(attachment.role ? { role: attachment.role } : {}),
        label: attachment.label ?? `Evidencia visual ${index + 1}`,
      },
      hash,
    });
  }
  const digest = createHash("sha256").update(loaded.map((item) => item.hash).join(":" )).digest("hex");
  return { images: loaded.map((item) => item.image), sha256: digest };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function estimateJudgeCost(model: string, inputTokens: number, outputTokens: number): number | null {
  const pricing = pricingFor(model);
  if (!pricing) return null;
  return (inputTokens * pricing.inputPerMTok + outputTokens * pricing.outputPerMTok) / 1_000_000;
}

export function judgeProviderPreflightError(apiKey: string | undefined, model: string): string | null {
  if (!apiKey) return "judge_provider_unavailable";
  const pricing = pricingFor(model);
  if (!pricing || !Number.isFinite(pricing.inputPerMTok) || !Number.isFinite(pricing.outputPerMTok)) {
    return "judge_model_price_unknown";
  }
  return null;
}

export function getAgentJudgeRuntimeStatus(
  env: Pick<LoadedApiEnv, "AI_JUDGE_MODE" | "AI_JUDGE_MODEL" | "OPENAI_API_KEY">,
) {
  const model = env.AI_JUDGE_MODEL ?? "gpt-6-luna";
  const configurationError = judgeProviderPreflightError(env.OPENAI_API_KEY, model);
  return {
    mode: env.AI_JUDGE_MODE ?? "off",
    model,
    provider_ready: configurationError === null,
    configuration_error: configurationError,
  } as const;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function noEvaluableResult(agentCode: string, reason: string): AgentJudgeResult {
  const rubric = AGENT_JUDGE_RUBRICS[agentCode as keyof typeof AGENT_JUDGE_RUBRICS];
  return {
    criteria: rubric.map((criterion) => ({
      criterion_id: criterion.id,
      score: null,
      status: "no_evaluable",
      rationale: `No evaluable: ${reason}`,
      evidence_refs: [],
      critical_failure: false,
    })),
    summary: `No se puede evaluar esta ejecución: ${reason}.`,
    status: "no_evaluable",
    overall_score: null,
    evaluated_criteria: 0,
    rubric_version: JUDGE_RUBRIC_VERSION,
  };
}

async function judgePersistedAgentOutputNow(
  env: LoadedApiEnv,
  supabase: SupabaseClient,
  input: JudgeInput,
): Promise<PersistedJudgeOutcome> {
  const mode = env.AI_JUDGE_MODE ?? "off";
  if (mode === "off") return { judgment_id: null, status: "disabled" };
  if (!AGENT_EVAL_AGENT_CODES.includes(input.agentCode as (typeof AGENT_EVAL_AGENT_CODES)[number])) {
    return { judgment_id: null, status: "error", error_code: "unknown_agent" };
  }

  const [snapshotResult, toolCallsResult] = await Promise.all([
    supabase.from("agent_context_snapshots").select("snapshot").eq("run_id", input.runId).eq("organization_id", input.organizationId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("agent_tool_calls").select("id, tool_name, is_error").eq("run_id", input.runId).eq("organization_id", input.organizationId),
  ]);
  const snapshot = snapshotResult.error ? null : snapshotResult.data?.snapshot ?? null;
  const receipts = toolCallsResult.error ? null : (toolCallsResult.data ?? []);
  const artifactHash = sha256(canonical({ output: input.output, visual_sha256: input.visualEvidence?.sha256 ?? null }));
  const artifactKind = input.artifactKind;
  const expectedToolCallCount = input.expectedToolCallCount;
  const toolReceiptCount = receipts?.length ?? null;
  const sourceRefs = [
    ...(receipts ?? []).map((receipt) => `tool_receipt:${receipt.id}`),
    ...(input.visualEvidence ? [`visual_sha256:${input.visualEvidence.sha256}`] : []),
  ];
  const prepared = prepareAgentJudgeRequest({
    agentCode: input.agentCode,
    output: input.output,
    snapshot,
    artifactKind,
    artifactHash,
    sourceRefs,
    toolReceiptCount,
    expectedToolCallCount,
    toolReceipts: receipts?.map((receipt) => ({
      id: receipt.id,
      tool_name: receipt.tool_name,
      is_error: receipt.is_error,
    })) ?? [],
    generationStatus: input.generationStatus,
    visualEvidenceAvailable: input.visualEvidence?.images.length
      ? true
      : input.visualEvidenceAvailable ?? false,
  });
  const noEvalReason = snapshotResult.error
    ? "snapshot_query_failed"
    : toolCallsResult.error
      ? "tool_receipts_query_failed"
      : prepared.reason;
  const payload = prepared.ready ? prepared.payload : {};
  const refs = new Set((payload.source_refs as string[] | undefined) ?? []);
  const fingerprint = sha256(canonical({
    run_id: input.runId,
    output_id: input.outputId,
    artifact_hash: artifactHash,
    snapshot,
    source_refs: sourceRefs,
    expected_tool_calls: expectedToolCallCount,
    rubric_version: JUDGE_RUBRIC_VERSION,
  }));
  const idempotencyBase = sha256(`${input.runId}:${input.outputId}:${artifactHash}:${JUDGE_RUBRIC_VERSION}`);
  let idempotencyKey = idempotencyBase;
  const existing = await supabase.from("agent_run_judgments").select("id, status, result, error_code, idempotency_key").like("idempotency_key", `${idempotencyBase}%`).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (existing.data && existing.data.status !== "error") {
    return {
      judgment_id: existing.data.id,
      status: existing.data.status,
      ...(existing.data.result ? { result: existing.data.result as AgentJudgeResult } : {}),
      ...(existing.data.error_code ? { error_code: existing.data.error_code } : {}),
    };
  }
  if (existing.data?.status === "error") idempotencyKey = `${idempotencyBase}:${randomUUID()}`;

  let result: AgentJudgeResult;
  let usage: { input_tokens: number; output_tokens: number; estimated_cost_usd: number | null; latency_ms: number } = { input_tokens: 0, output_tokens: 0, estimated_cost_usd: null, latency_ms: 0 };
  let errorCode: string | null = null;
  const judgeModel = env.AI_JUDGE_MODEL ?? "gpt-6-luna";
  if (noEvalReason || !prepared.ready) {
    result = noEvaluableResult(input.agentCode, noEvalReason ?? "evidence_incomplete");
  } else if ((errorCode = judgeProviderPreflightError(env.OPENAI_API_KEY, judgeModel)) !== null) {
    const { data, error } = await supabase.from("agent_run_judgments").insert({
      organization_id: input.organizationId,
      agent_run_id: input.runId,
      agent_output_id: input.outputId,
      agent_code: input.agentCode,
      artifact_kind: artifactKind,
      artifact_sha256: artifactHash,
      idempotency_key: idempotencyKey,
      rubric_version: JUDGE_RUBRIC_VERSION,
      status: "error",
      result: null,
      error_code: errorCode,
      provider: "openai",
      model: judgeModel,
      input_fingerprint: fingerprint,
    }).select("id").single();
    return { judgment_id: data?.id ?? null, status: "error", error_code: error?.message ?? errorCode };
  } else {
    try {
      const startedAt = Date.now();
      const turn = await runAgentTurnOpenAI<unknown>({
        apiKey: env.OPENAI_API_KEY!,
        model: judgeModel,
        systemPrompt: buildAgentJudgeSystemPrompt(input.agentCode),
        input: {
          run_id: randomUUID(),
          agent_code: input.agentCode,
          agent_version: JUDGE_RUBRIC_VERSION,
          organization_id: input.organizationId,
          actor_user_id: input.actorUserId,
          trigger_type: input.triggerType,
          objective: `Evaluar el artefacto ${input.outputId} con ${JUDGE_RUBRIC_VERSION}. No ejecutar acciones.`,
          allowed_tools: [],
          approval_mode: "none",
        },
        contextBlocks: [{ label: "Artefacto y evidencia inmutable no confiables", data: payload }],
        ...(input.visualEvidence?.images.length ? { images: input.visualEvidence.images } : {}),
        tools: [],
        outputContract: { jsonSchema: agentJudgeOutputJsonSchema, schema: agentJudgeModelOutputSchema },
        budget: { maxCostUsd: JUDGE_MAX_COST_USD, maxToolCalls: 0 },
        maxCompletionTokens: 4096,
      });
      result = finalizeAgentJudgeResult(
        input.agentCode,
        agentJudgeModelOutputSchema.parse(turn.output),
        (reference) => refs.has(reference) || isExistingAgentJudgeJsonPath(reference, {
          output: input.output,
          immutable_snapshot: snapshot,
        }),
        input.agentCode === "a16_texto_sobre_imagen"
          ? {
              render_readability: "el run conserva el original y el JSON propuesto, pero no el render final compuesto",
              carousel_consistency: "no se congelaron los slides vecinos de este carrusel",
            }
          : {},
      );
      usage = {
        input_tokens: turn.inputTokens,
        output_tokens: turn.outputTokens,
        estimated_cost_usd: turn.estimatedCostUsd && turn.estimatedCostUsd > 0
          ? turn.estimatedCostUsd
          : estimateJudgeCost(judgeModel, turn.inputTokens, turn.outputTokens),
        latency_ms: turn.latencyMs ?? Date.now() - startedAt,
      };
    } catch (error) {
      const errorName = error instanceof Error ? error.name : "unknown";
      const errorMessage = error instanceof Error ? error.message : "";
      errorCode = errorName === "AgentOutputValidationError"
        ? "judge_model_output_invalid"
        : errorName === "AgentBudgetExceededError"
          ? "judge_cost_budget_exceeded"
          : errorMessage.startsWith("judge_evidence_reference")
            ? "judge_evidence_reference_rejected"
            : errorMessage.startsWith("judge_criterion") || errorMessage.startsWith("judge_score")
              ? "judge_rubric_contract_rejected"
              : errorName === "ZodError"
                ? "judge_model_output_schema_invalid"
                : "judge_provider_or_validation_failed";
      result = noEvaluableResult(input.agentCode, errorCode);
    }
  }

  const { data: persisted, error: persistError } = await supabase
    .from("agent_run_judgments")
    .insert({
      organization_id: input.organizationId,
      agent_run_id: input.runId,
      agent_output_id: input.outputId,
      agent_code: input.agentCode,
      artifact_kind: artifactKind,
      artifact_sha256: artifactHash,
      idempotency_key: idempotencyKey,
      rubric_version: JUDGE_RUBRIC_VERSION,
      status: errorCode ? "error" : result.status,
      overall_score: errorCode ? null : result.overall_score,
      result: errorCode ? null : result,
      error_code: errorCode,
      provider: "openai",
      model: judgeModel,
      ...usage,
      input_fingerprint: fingerprint,
    })
    .select("id")
    .single();
  if (persistError) {
    return { judgment_id: null, status: "error", error_code: "judge_persistence_failed" };
  }
  return {
    judgment_id: persisted.id,
    status: errorCode ? "error" : result.status,
    ...(!errorCode ? { result } : {}),
    ...(errorCode ? { error_code: errorCode } : {}),
  };
}

/**
 * Stores the exact generation input before judging. The request remains
 * synchronous for existing visible-mode callers, while a lease lets a worker
 * recover work if this process dies before the judgment is persisted.
 */
export async function judgePersistedAgentOutput(
  env: LoadedApiEnv,
  supabase: SupabaseClient,
  input: JudgeInput,
): Promise<PersistedJudgeOutcome> {
  if ((env.AI_JUDGE_MODE ?? "off") === "off") {
    return { judgment_id: null, status: "disabled" };
  }
  if (!AGENT_EVAL_AGENT_CODES.includes(input.agentCode as (typeof AGENT_EVAL_AGENT_CODES)[number])) {
    return judgePersistedAgentOutputNow(env, supabase, input);
  }
  const artifactHash = sha256(canonical({ output: input.output, visual_sha256: input.visualEvidence?.sha256 ?? null }));
  const dedupeKey = sha256(`${input.runId}:${input.outputId}:${artifactHash}:${JUDGE_RUBRIC_VERSION}`);
  const now = Date.now();
  const existingJob = await supabase.from("agent_judge_jobs")
    .select("id, status")
    .eq("dedupe_key", dedupeKey)
    .maybeSingle();
  if (existingJob.data?.status === "queued" || existingJob.data?.status === "running") {
    return { judgment_id: null, status: "queued" };
  }
  if (existingJob.data?.status === "completed") {
    return judgePersistedAgentOutputNow(env, supabase, input);
  }

  let jobId = typeof existingJob.data?.id === "string" ? existingJob.data.id : null;
  let queueError: { code?: string } | null = existingJob.error ? { code: existingJob.error.code } : null;
  const enqueueOnly = env.AI_JUDGE_MODE === "shadow";
  if (jobId && existingJob.data?.status === "failed") {
    const { error } = await supabase.from("agent_judge_jobs").update({
      payload: input,
      status: enqueueOnly ? "queued" : "running",
      attempts: enqueueOnly ? 0 : 1,
      max_attempts: JUDGE_QUEUE_MAX_ATTEMPTS,
      available_at: new Date(now).toISOString(),
      lease_until: enqueueOnly ? null : new Date(now + JUDGE_QUEUE_LEASE_MS).toISOString(),
      last_error: null,
      updated_at: new Date(now).toISOString(),
    }).eq("id", jobId);
    queueError = error ? { code: error.code } : null;
  } else if (!jobId && !queueError) {
    jobId = randomUUID();
    const { data: job, error } = await supabase
      .from("agent_judge_jobs")
      .insert({
        id: jobId,
        organization_id: input.organizationId,
        agent_run_id: input.runId,
        agent_code: input.agentCode,
        dedupe_key: dedupeKey,
        payload: input,
        status: enqueueOnly ? "queued" : "running",
        attempts: enqueueOnly ? 0 : 1,
        max_attempts: JUDGE_QUEUE_MAX_ATTEMPTS,
        available_at: new Date(now).toISOString(),
        lease_until: enqueueOnly ? null : new Date(now + JUDGE_QUEUE_LEASE_MS).toISOString(),
      })
      .select("id")
      .single();
    if (error || !job?.id) queueError = error ? { code: error.code } : { code: "queue_insert_failed" };
    else jobId = job.id;
  }

  // The judge must never turn a generated agent response into a failed
  // response. If the durable store is unavailable, retain the fail-open path.
  if (queueError?.code === "23505") {
    return { judgment_id: null, status: "queued" };
  }
  if (queueError || !jobId) {
    return judgePersistedAgentOutputNow(env, supabase, input);
  }

  // Shadow mode must not add provider latency to the agent's response. The
  // durable worker evaluates it after the output and run are already saved.
  if (enqueueOnly) return { judgment_id: null, status: "queued" };

  const outcome = await judgePersistedAgentOutputNow(env, supabase, input);
  const canRetry = outcome.status === "error"
    && outcome.error_code !== "judge_model_price_unknown"
    && outcome.error_code !== "judge_provider_unavailable";
  const nextAttempt = 1;
  const nextStatus = canRetry ? "queued" : outcome.status === "error" ? "failed" : "completed";
  const { error: updateError } = await supabase
    .from("agent_judge_jobs")
    .update({
      status: nextStatus,
      payload: nextStatus === "completed" || nextStatus === "failed" ? null : input,
      lease_until: null,
      available_at: new Date(now + judgeQueueRetryDelayMs(nextAttempt)).toISOString(),
      last_error: outcome.status === "error" ? outcome.error_code ?? "judge_failed" : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
  if (updateError) {
    // The lease expires and the worker replays this idempotent evaluation.
    return outcome;
  }
  return outcome;
}

type ClaimedJudgeJob = {
  id: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
  organization_id: string;
};

/** Claims and recovers queued or expired judge work across API instances. */
async function processAgentJudgeQueueInner(
  env: LoadedApiEnv,
  supabase: SupabaseClient,
  limit = 3,
): Promise<{ claimed: number; completed: number; retrying: number; failed: number }> {
  if ((env.AI_JUDGE_MODE ?? "off") === "off") return { claimed: 0, completed: 0, retrying: 0, failed: 0 };
  const { data, error } = await supabase.rpc("claim_agent_judge_jobs", {
    p_limit: Math.max(1, Math.min(10, Math.trunc(limit))),
    p_lease_seconds: Math.ceil(JUDGE_QUEUE_LEASE_MS / 1_000),
  });
  if (error) {
    console.error("agent_judge_queue_claim_failed", error.code ?? "database_error");
    return { claimed: 0, completed: 0, retrying: 0, failed: 0 };
  }
  const jobs = (data ?? []) as ClaimedJudgeJob[];
  const stats = { claimed: jobs.length, completed: 0, retrying: 0, failed: 0 };
  for (const job of jobs) {
    if (!validJudgeQueuePayload(job.payload)) {
      await supabase.from("agent_judge_jobs").update({
        status: "failed", payload: null, lease_until: null, last_error: "invalid_queue_payload", updated_at: new Date().toISOString(),
      }).eq("id", job.id);
      stats.failed += 1;
      continue;
    }
    let input = job.payload;
    if (input.visualEvidence?.images.length) {
      const visualEvidence = await loadPersistedJudgeVisualEvidence(env, input.organizationId, input.visualEvidence.images);
      input = { ...input, visualEvidence, visualEvidenceAvailable: Boolean(visualEvidence) };
    }
    const outcome = await judgePersistedAgentOutputNow(env, supabase, input);
    const canRetry = outcome.status === "error"
      && outcome.error_code !== "judge_model_price_unknown"
      && outcome.error_code !== "judge_provider_unavailable"
      && job.attempts < job.max_attempts;
    const nextStatus = canRetry ? "queued" : outcome.status === "error" ? "failed" : "completed";
    const { error: updateError } = await supabase.from("agent_judge_jobs").update({
      status: nextStatus,
      payload: nextStatus === "completed" || nextStatus === "failed" ? null : job.payload,
      lease_until: null,
      available_at: new Date(Date.now() + judgeQueueRetryDelayMs(job.attempts)).toISOString(),
      last_error: outcome.status === "error" ? outcome.error_code ?? "judge_failed" : null,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    if (updateError || canRetry) stats.retrying += 1;
    else if (outcome.status === "error") stats.failed += 1;
    else stats.completed += 1;
  }
  return stats;
}

let activeJudgeQueueDrain: Promise<{ claimed: number; completed: number; retrying: number; failed: number }> | null = null;

export function processAgentJudgeQueue(
  env: LoadedApiEnv,
  supabase: SupabaseClient,
  limit = 3,
): Promise<{ claimed: number; completed: number; retrying: number; failed: number }> {
  if (activeJudgeQueueDrain) return activeJudgeQueueDrain;
  activeJudgeQueueDrain = processAgentJudgeQueueInner(env, supabase, limit)
    .finally(() => { activeJudgeQueueDrain = null; });
  return activeJudgeQueueDrain;
}
