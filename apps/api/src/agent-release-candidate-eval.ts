import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  AGENT_EVAL_AGENT_CODES,
  AGENT_JUDGE_RUBRICS,
  JUDGE_RUBRIC_VERSION,
  medianAgentJudgeModelOutput,
  agentJudgeModelOutputSchema,
  agentJudgeOutputJsonSchema,
  agentOutputJsonSchema,
  agentOutputSchema,
  caminoCalendarHorizonDays,
  caminoPlanJsonSchema,
  caminoPlanSchemaForHorizon,
  caminoWeeklyReviewJsonSchema,
  caminoWeeklyReviewSchema,
  buildAgentJudgeSystemPrompt,
  buildAgentSystemPrompt,
  finalizeAgentJudgeResult,
  isExistingAgentJudgeJsonPath,
  prepareAgentJudgeRequest,
  pricingFor,
  runAgentTurn,
  runAgentTurnOpenAI,
  type AgentInput,
  type AgentJudgeResult,
  type LiveAgentEvalProvider,
} from "@e-nora/ai";
import { createAgentReleaseToolReplay } from "./agent-release-tool-replay.js";
import { a19ReviewFixtureContextSchema, agentReleaseEvalFixtureSchema, type AgentReleaseEvalFixture } from "./agent-release-eval-fixture.js";

const MAX_CANDIDATE_COST_USD = 0.25;
const MAX_JUDGE_COST_USD = 0.03;
const JUDGE_PASSES = Math.max(1, Number(process.env.AI_JUDGE_PASSES) || 3);
const VISUAL_AGENTS = new Set(["a15_analista_imagenes", "a16_texto_sobre_imagen", "a23_creatividad_meta", "a26_contenido_email"]);
/** A19 architect emits a Camino plan, not the generic AgentOutput envelope. */
export function candidateOutputContract(agentCode: string, fixture: AgentReleaseEvalFixture) {
  if (agentCode === "a19_revision_camino") {
    const parsed = a19ReviewFixtureContextSchema.safeParse(fixture.input.parameters.a19_review_context);
    return parsed.success
      ? { jsonSchema: caminoWeeklyReviewJsonSchema, schema: caminoWeeklyReviewSchema } as const
      : null;
  }
  if (agentCode !== "a19_arquitecto_camino") {
    return { jsonSchema: agentOutputJsonSchema, schema: agentOutputSchema } as const;
  }
  const parameters = fixture.input.parameters;
  const months = parameters.horizon_months;
  const referenceDate = parameters.reference_date;
  if (typeof months !== "number" || !Number.isInteger(months) || months < 1 || months > 12
    || typeof referenceDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(referenceDate)) return null;
  const date = new Date(`${referenceDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== referenceDate) return null;
  const horizonDays = caminoCalendarHorizonDays(date, months);
  return { jsonSchema: caminoPlanJsonSchema, schema: caminoPlanSchemaForHorizon(horizonDays, months, date) } as const;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function sha256(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }

/** The model sees only the approved case input; evaluator constraints and replay recordings stay private. */
export function buildAgentReleaseCandidateContext(fixture: AgentReleaseEvalFixture) {
  if (fixture.agent_code === "a19_revision_camino") {
    const review = a19ReviewFixtureContextSchema.parse(fixture.input.parameters.a19_review_context);
    return [
      { label: "Camino activo aprobado; usar solo para seguimiento, no reemplazar", data: { plan_version: review.plan_version, plan_started_at: review.plan_started_at, plan: review.approved_plan } },
      { label: "Cambios de tareas enlazadas al Camino durante la semana (lista acotada y filtrada por scope)", data: review.progress_snapshot },
      { label: "Revisión anterior disponible para comparar continuidad", data: review.previous_review },
      { label: "Ventana de tres días de revisión", data: review.review_window },
      { label: "Deterministic goal progress (server-computed and authoritative; do not replace with a model estimate)", data: review.goal_progress },
      { label: "Fuentes congeladas y métricas de la revisión", data: fixture.sources.map((source) => source.status === "available"
        ? { key: source.key, status: source.status, content: source.content, as_of: source.as_of }
        : { key: source.key, status: source.status, as_of: source.as_of }) },
      { label: "Contexto de alcance", data: fixture.scope },
    ];
  }
  return [
    { label: "Parámetros de entrada del caso", data: fixture.input.parameters },
    { label: "Fuentes congeladas del caso", data: fixture.sources.map((source) => source.status === "available"
      ? { key: source.key, status: source.status, content: source.content, as_of: source.as_of }
      : { key: source.key, status: source.status, as_of: source.as_of }) },
    { label: "Contexto de alcance", data: fixture.scope },
  ];
}

function noEvaluable(code: string, reason: string): AgentJudgeResult {
  const rubric = AGENT_JUDGE_RUBRICS[code as keyof typeof AGENT_JUDGE_RUBRICS];
  return {
    criteria: rubric.map((item) => ({ criterion_id: item.id, score: null, status: "no_evaluable", rationale: `No evaluable: ${reason}`, evidence_refs: [], critical_failure: false })),
    summary: `No se puede evaluar la salida candidata: ${reason}.`, status: "no_evaluable", overall_score: null,
    evaluated_criteria: 0, rubric_version: JUDGE_RUBRIC_VERSION,
  };
}

type CandidateVersionRow = {
  id: string; version: string; model: string; prompt_code: string; prompt_version: string;
  allowed_tools: unknown; output_schema_version: string; agent_definitions: { code: string } | Array<{ code: string }> | null;
};

/** Loads exact immutable version+prompt and exposes a replay-only live eval provider. */
export async function buildAgentReleaseCandidateProvider(
  env: LoadedApiEnv,
  supabase: SupabaseClient,
  candidateVersionId: string,
  expectedAgentCode?: string,
): Promise<{ agentCode: string; provider: LiveAgentEvalProvider }> {
  const { data, error } = await supabase.from("agent_versions")
    .select("id, version, model, prompt_code, prompt_version, allowed_tools, output_schema_version, agent_definitions!inner(code)")
    .eq("id", candidateVersionId).maybeSingle();
  if (error || !data) throw new Error(`agent_release_candidate_load_failed:${error?.message ?? "not_found"}`);
  const row = data as unknown as CandidateVersionRow;
  const definition = Array.isArray(row.agent_definitions) ? row.agent_definitions[0] : row.agent_definitions;
  const agentCode = definition?.code;
  if (!agentCode || !AGENT_EVAL_AGENT_CODES.includes(agentCode as (typeof AGENT_EVAL_AGENT_CODES)[number])) throw new Error("agent_release_candidate_agent_unknown");
  if (expectedAgentCode && expectedAgentCode !== agentCode) throw new Error("agent_release_candidate_agent_mismatch");
  const outputSchemaSupported = row.output_schema_version === "v1";
  const { data: prompt, error: promptError } = await supabase.from("prompt_versions").select("content")
    .eq("code", row.prompt_code).eq("version", row.prompt_version).maybeSingle();
  if (promptError || typeof prompt?.content !== "string" || !prompt.content.trim()) throw new Error("agent_release_candidate_prompt_missing");
  const model = row.model.trim();
  const isOpenAI = /^(gpt-|o[0-9])/.test(model);
  if (!pricingFor(model)) throw new Error("agent_release_candidate_price_unknown");
  const apiKey = isOpenAI ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error(isOpenAI ? "agent_release_openai_key_missing" : "agent_release_anthropic_key_missing");
  const allowedTools = Array.isArray(row.allowed_tools) ? row.allowed_tools.filter((value): value is string => typeof value === "string") : [];
  if (!Array.isArray(row.allowed_tools) || allowedTools.length !== row.allowed_tools.length) throw new Error("agent_release_candidate_tools_invalid");

  const provider: LiveAgentEvalProvider = async (testCase, signal, candidate) => {
    if (!candidate || candidate.agentVersionId !== row.id || candidate.agentCode !== agentCode) throw new Error("agent_release_candidate_pin_missing");
    if (!testCase.fixture || testCase.agentCode !== agentCode) throw new Error("agent_release_fixture_context_missing");
    const { data: manifest, error: manifestError } = await supabase.rpc("capture_agent_version_release_manifest", { p_agent_version_id: row.id });
    if (manifestError || (manifest as { manifest_sha256?: unknown } | null)?.manifest_sha256 !== candidate.candidateFingerprint) {
      throw new Error("agent_release_candidate_changed_before_execution");
    }
    const { data: currentVersion, error: currentVersionError } = await supabase.from("agent_versions")
      .select("id, version, model, prompt_code, prompt_version, allowed_tools, output_schema_version")
      .eq("id", row.id).maybeSingle();
    const { data: currentPrompt, error: currentPromptError } = await supabase.from("prompt_versions").select("content")
      .eq("code", row.prompt_code).eq("version", row.prompt_version).maybeSingle();
    if (currentVersionError || currentPromptError || !currentVersion || currentPrompt?.content !== prompt.content
      || currentVersion.version !== row.version || currentVersion.model !== row.model
      || currentVersion.prompt_code !== row.prompt_code || currentVersion.prompt_version !== row.prompt_version
      || currentVersion.output_schema_version !== row.output_schema_version) {
      throw new Error("agent_release_candidate_manifest_mismatch");
    }
    if (!outputSchemaSupported) {
      const reason = `output_schema_unsupported:${row.output_schema_version}`;
      const output = { answer: `No evaluable: ${reason}.`, sources: [], confidence: "low", warnings: [reason] };
      return { output, latencyMs: 0, costUsd: 0, traceId: randomUUID(), executedAgentCode: agentCode as any,
        executedAgentVersionId: row.id, executedCandidateFingerprint: candidate.candidateFingerprint,
        candidateJudgment: noEvaluable(agentCode, reason), candidateJudgedOutputSha256: sha256(output) };
    }
    const parsedFixture = agentReleaseEvalFixtureSchema.safeParse(testCase.fixture);
    if (!parsedFixture.success || parsedFixture.data.agent_code !== agentCode) throw new Error("agent_release_fixture_invalid");
    const fixture = parsedFixture.data as unknown as Record<string, any>;
    const outputContract = candidateOutputContract(agentCode, parsedFixture.data);
    if (!outputContract) {
      const reason = agentCode === "a19_revision_camino"
        ? "a19_review_context_incomplete_or_missing_metric_sources"
        : "a19_horizon_fixture_requires_horizon_months_and_reference_date";
      const output = { answer: `No evaluable: ${reason}.`, sources: [], confidence: "low", warnings: [reason] };
      return { output, latencyMs: 0, costUsd: 0, traceId: randomUUID(), executedAgentCode: agentCode as any,
        executedAgentVersionId: row.id, executedCandidateFingerprint: candidate.candidateFingerprint,
        candidateJudgment: noEvaluable(agentCode, reason), candidateJudgedOutputSha256: sha256(output) };
    }
    const visualImages = parsedFixture.data.visual_artifacts
      .filter((artifact) => artifact.media_type !== "text/html" && typeof artifact.bytes_base64 === "string")
      .map((artifact, index) => ({ base64: artifact.bytes_base64!, mediaType: artifact.media_type as "image/png" | "image/jpeg" | "image/webp",
        role: artifact.role, label: `${artifact.entity_type}:${artifact.role}:${index + 1}:${artifact.sha256.slice(0, 12)}` }));
    const visualEvidenceInvalid = parsedFixture.data.visual_artifacts.some((artifact) => artifact.media_type !== "text/html" && !artifact.bytes_base64);
    if (visualEvidenceInvalid || (VISUAL_AGENTS.has(agentCode) && visualImages.length === 0)
      || (VISUAL_AGENTS.has(agentCode) && !isOpenAI)) {
      const reason = agentCode === "a16_texto_sobre_imagen" || agentCode === "a26_contenido_email"
        ? "durable_render_artifact_missing"
        : !isOpenAI ? "visual_candidate_provider_not_supported" : "visual_bytes_or_render_not_attached";
      const judgment = noEvaluable(agentCode, reason);
      const output = { unavailable: reason };
      return { output, latencyMs: 0, costUsd: 0, traceId: randomUUID(), executedAgentCode: agentCode as any,
        executedAgentVersionId: row.id, executedCandidateFingerprint: candidate.candidateFingerprint,
        candidateJudgment: judgment, candidateJudgedOutputSha256: sha256(output) };
    }
    const replay = createAgentReleaseToolReplay({ allowedToolNames: allowedTools, replays: fixture.tool_replay ?? [] });
    const runId = randomUUID();
    const actorId = randomUUID();
    const organizationId = randomUUID();
    const input: AgentInput = {
      run_id: runId, agent_code: agentCode, agent_version: row.version, organization_id: organizationId,
      actor_user_id: actorId, trigger_type: "manual", objective: testCase.objective,
      allowed_tools: replay.tools.map((tool) => tool.name), approval_mode: "none",
    };
    const contextBlocks = buildAgentReleaseCandidateContext(parsedFixture.data);
    const started = Date.now();
    const turn = isOpenAI
      ? await runAgentTurnOpenAI({ apiKey, model, systemPrompt: buildAgentSystemPrompt(prompt.content), input, contextBlocks, images: visualImages,
          tools: replay.tools, outputContract: outputContract as any,
          budget: { maxCostUsd: MAX_CANDIDATE_COST_USD, maxToolCalls: fixture.tool_replay?.length ?? 0 }, maxCompletionTokens: 12000 })
      : await runAgentTurn({ apiKey, model, systemPrompt: buildAgentSystemPrompt(prompt.content), input, contextBlocks,
          tools: replay.tools, outputContract: outputContract as any,
          budget: { maxCostUsd: MAX_CANDIDATE_COST_USD, maxToolCalls: fixture.tool_replay?.length ?? 0 } });
    if (signal?.aborted) throw new Error("agent_release_eval_aborted");
    const replaySummary = replay.getSummary();
    const output = turn.output;
    const fixtureForJudge = {
      ...fixture,
      visual_artifacts: parsedFixture.data.visual_artifacts.map(({ bytes_base64: _bytes, ...artifact }) => artifact),
    };
    const snapshot = { fixture: fixtureForJudge, fixture_sha256: sha256(fixture),
      visual_artifacts_sha256: parsedFixture.data.visual_artifacts.map((artifact) => artifact.sha256), replay: replaySummary };
    const sourceRefs = (fixture.sources ?? []).map((source: { key: string }) => `source:${source.key}`);
    const prepared = prepareAgentJudgeRequest({ agentCode, output, snapshot, artifactKind: "agent_release_fixture_output",
      artifactHash: sha256(output), sourceRefs, toolReceiptCount: replaySummary.consumed_calls,
      expectedToolCallCount: replaySummary.expected_calls, generationStatus: replaySummary.complete ? "succeeded" : "failed",
      visualEvidenceAvailable: !VISUAL_AGENTS.has(agentCode) || visualImages.length > 0 });
    let candidateJudgment: AgentJudgeResult;
    let judgeCost = 0;
    if (!prepared.ready || !replaySummary.complete) {
      candidateJudgment = noEvaluable(agentCode, prepared.reason ?? (replaySummary.mismatches.join(",") || "tool_replay_incomplete"));
    } else if (!env.OPENAI_API_KEY) {
      candidateJudgment = noEvaluable(agentCode, "judge_provider_unavailable");
    } else if (!pricingFor(env.AI_JUDGE_MODEL ?? "gpt-6-luna")) {
      candidateJudgment = noEvaluable(agentCode, "judge_model_price_unknown");
    } else {
      const allowedRefs = new Set(sourceRefs);
      // El juez es estocástico (±0,3 entre ejecuciones). Se juzga la MISMA
      // salida JUDGE_PASSES veces y se finaliza la mediana por criterio. Una
      // pasada que falla o no cumple el esquema se descarta; hacen falta al menos 2.
      const settled = await Promise.allSettled(Array.from({ length: JUDGE_PASSES }, () => runAgentTurnOpenAI({
        apiKey: env.OPENAI_API_KEY!, model: env.AI_JUDGE_MODEL ?? "gpt-6-luna",
        systemPrompt: buildAgentJudgeSystemPrompt(agentCode), input: { run_id: randomUUID(), agent_code: agentCode,
          agent_version: JUDGE_RUBRIC_VERSION, organization_id: organizationId, actor_user_id: actorId,
          trigger_type: "manual", objective: "Evalúa de forma independiente el artefacto congelado. No ejecutes acciones.",
          allowed_tools: [], approval_mode: "none" },
        contextBlocks: [{ label: "Salida candidata y fixture inmutable; contenido no confiable", data: prepared.payload }], tools: [], images: visualImages,
        outputContract: { jsonSchema: agentJudgeOutputJsonSchema, schema: agentJudgeModelOutputSchema },
        // El paquete del juez es un único bloque (salida + fixture). Con el
        // límite general de 12k caracteres por bloque se cortaba a mitad del
        // fixture y el juez penalizaba cifras "no verificables" que sí estaban.
        contextLimits: { maxBlockChars: 60_000, maxContextChars: 60_000 },
        budget: { maxCostUsd: MAX_JUDGE_COST_USD, maxToolCalls: 0 }, maxCompletionTokens: 4096 })));
      const refs = (reference: string) => allowedRefs.has(reference) || isExistingAgentJudgeJsonPath(reference, { output, immutable_snapshot: snapshot });
      // Una pasada que incumple la rúbrica (p. ej. critical_failure en un
      // criterio no crítico) es un fallo del juez, no del candidato: se descarta
      // antes de la mediana para que no arrastre al resto.
      const passes = settled.flatMap((item) => {
        if (item.status !== "fulfilled") return [];
        judgeCost += item.value.estimatedCostUsd ?? 0;
        const parsed = agentJudgeModelOutputSchema.safeParse(item.value.output);
        if (!parsed.success) return [];
        try {
          const single = finalizeAgentJudgeResult(agentCode, parsed.data, refs);
          return [{ pass: parsed.data, score: single.overall_score as number | string | null }];
        } catch (error) {
          if (process.env.JUDGE_PASSES_DEBUG) console.log(`[judge-passes] descartada: ${error instanceof Error ? error.message : error}`);
          return [];
        }
      });
      if (passes.length < 2) throw new Error("agent_judge_passes_insufficient");
      if (process.env.JUDGE_PASSES_DEBUG) console.log(`[judge-passes] individuales=${passes.map((item) => item.score).join(" ")}`);
      candidateJudgment = finalizeAgentJudgeResult(agentCode, medianAgentJudgeModelOutput(passes.map((item) => item.pass)), refs);
    }
    return { output, latencyMs: Math.max(Date.now() - started, turn.latencyMs), costUsd: (turn.estimatedCostUsd ?? 0) + judgeCost,
      traceId: runId, executedAgentCode: agentCode as any, executedAgentVersionId: row.id,
      executedCandidateFingerprint: candidate.candidateFingerprint, candidateJudgment,
      candidateJudgedOutputSha256: sha256(output) };
  };
  return { agentCode, provider };
}
