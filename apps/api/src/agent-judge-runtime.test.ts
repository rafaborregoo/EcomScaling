import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_EVAL_AGENT_CODES, AGENT_JUDGE_RUBRICS, agentJudgeModelOutputSchema, computeExponentialBackoffMs, DEFAULT_AGENT_RESILIENCE_POLICY, setLiveModelPricing } from "@e-nora/ai";
import { candidateImagesFromFrozenJudgeEvidence, estimateJudgeCost, getAgentJudgeRuntimeStatus, judgePersistedAgentOutput, judgeProviderFailureCode, judgeProviderPreflightError, loadPersistedJudgeVisualEvidence, processAgentJudgeQueue } from "./agent-judge-runtime.js";

test("judge cost uses the configured per-million-token price", () => {
  assert.ok(Math.abs((estimateJudgeCost("gpt-6-luna", 3_737, 1_048) ?? 0) - 0.0008977) < 1e-12);
});

test("judge cost stays unknown when the model has no registered price", () => {
  assert.equal(estimateJudgeCost("unregistered-model", 3_737, 1_048), null);
});

test("judge refuses a provider call when its model price is unknown", () => {
  assert.equal(judgeProviderPreflightError("test-api-key", "unregistered-model"), "judge_model_price_unknown");
  assert.equal(judgeProviderPreflightError(undefined, "gpt-6-luna"), "judge_provider_unavailable");
  assert.equal(judgeProviderPreflightError("test-api-key", "gpt-6-luna"), null);
});

test("judge persists provider failure class without exposing raw error details", () => {
  assert.equal(judgeProviderFailureCode({ name: "APIError", status: 413, message: "sensitive request content" }), "judge_provider_http_413");
  assert.equal(judgeProviderFailureCode({ name: "APIConnectionTimeoutError" }), "judge_provider_connection_failed");
  assert.equal(judgeProviderFailureCode(new Error("sensitive request content")), "judge_provider_or_validation_failed");
});

test("judge runtime status reports mode and readiness without exposing credentials", () => {
  assert.deepEqual(getAgentJudgeRuntimeStatus({ AI_JUDGE_MODE: "off" }), {
    mode: "off", model: "gpt-6-luna", provider_ready: false, configuration_error: "judge_provider_unavailable",
  });
  assert.deepEqual(getAgentJudgeRuntimeStatus({ AI_JUDGE_MODE: "shadow", OPENAI_API_KEY: "secret" }), {
    mode: "shadow", model: "gpt-6-luna", provider_ready: true, configuration_error: null,
  });
  assert.equal(JSON.stringify(getAgentJudgeRuntimeStatus({ AI_JUDGE_MODE: "visible", OPENAI_API_KEY: "secret" })).includes("secret"), false);
});

test("judge preflight and cost estimate accept live database pricing", () => {
  const model = "judge-live-price-fixture";
  setLiveModelPricing({ [model]: { inputPerMTok: 0.5, outputPerMTok: 1 } }, "test-fixture");
  assert.equal(judgeProviderPreflightError("test-api-key", model), null);
  assert.equal(estimateJudgeCost(model, 3_000, 1_000), 0.0025);
});

test("judge queue lease outlives the provider retry window to prevent duplicate claims", async () => {
  let claimArgs: Record<string, unknown> | null = null;
  const supabase: any = {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      claimArgs = args;
      return { data: [], error: null };
    },
  };
  const { JUDGE_QUEUE_LEASE_MS, processAgentJudgeQueue } = await import("./agent-judge-runtime.js");
  await processAgentJudgeQueue({ AI_JUDGE_MODE: "shadow" } as never, supabase);
  assert.equal(JUDGE_QUEUE_LEASE_MS, 240_000);
  assert.equal((claimArgs as Record<string, unknown> | null)?.p_lease_seconds, 240);
  const providerRetryWindowMs = DEFAULT_AGENT_RESILIENCE_POLICY.timeoutMs * (DEFAULT_AGENT_RESILIENCE_POLICY.maxRetries + 1)
    + Array.from({ length: DEFAULT_AGENT_RESILIENCE_POLICY.maxRetries }, (_, index) =>
      computeExponentialBackoffMs(index + 1, DEFAULT_AGENT_RESILIENCE_POLICY, () => 1),
    ).reduce((sum, delay) => sum + delay, 0);
  assert.ok(providerRetryWindowMs < JUDGE_QUEUE_LEASE_MS);
});

test("persisted judge runtime completes and stores a result for every active agent code", async () => {
  const originalFetch = globalThis.fetch;
  const persisted: Array<Record<string, unknown>> = [];
  let currentCode: (typeof AGENT_EVAL_AGENT_CODES)[number] = AGENT_EVAL_AGENT_CODES[0]!;
  let a15JudgeRequestBody: string | null = null;
  globalThis.fetch = async (_input, init) => {
    if (currentCode === "a15_analista_imagenes") a15JudgeRequestBody = String(init?.body ?? "");
    const modelOutput = {
      summary: `Mock review for ${currentCode}`,
      criteria: AGENT_JUDGE_RUBRICS[currentCode].map((criterion) => ({
        criterion_id: criterion.id,
        score: 3,
        status: "evaluable",
        rationale: "The cited output field is present in the immutable artifact.",
        evidence_refs: ["$.output.value"],
        critical_failure: false,
      })),
    };
    agentJudgeModelOutputSchema.parse(modelOutput);
    return new Response(JSON.stringify({
      id: "chatcmpl-judge-test",
      object: "chat.completion",
      created: 1,
      model: "gpt-6-luna",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(modelOutput) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1_000, completion_tokens: 250, total_tokens: 1_250 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  function fakeSupabase() {
    return {
      from(table: string) {
        const query: any = {
          select() { return query; },
          insert(row: Record<string, unknown>) { if (table === "agent_run_judgments") persisted.push(row); return query; },
          update() { return query; },
          eq() { return query; },
          order() { return query; },
          limit() { return query; },
          like() { return query; },
          maybeSingle() {
            return Promise.resolve(table === "agent_context_snapshots"
              ? { data: { snapshot: { source: "immutable-test-snapshot" } }, error: null }
              : { data: null, error: null });
          },
          single() {
            return Promise.resolve({ data: { id: `judgment-${persisted.length}` }, error: null });
          },
          then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
            return Promise.resolve({ data: null, error: null }).then(resolve, reject);
          },
        };
        return query;
      },
    };
  }

  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
  try {
    for (const [index, code] of AGENT_EVAL_AGENT_CODES.entries()) {
      currentCode = code;
      const visual = ["a15_analista_imagenes", "a16_texto_sobre_imagen", "a23_creatividad_meta", "a26_contenido_email"].includes(code);
      const outcome = await judgePersistedAgentOutput(
        {
          AI_JUDGE_MODE: "visible",
          AI_JUDGE_MODEL: "gpt-6-luna",
          OPENAI_API_KEY: "test-key",
        } as never,
        fakeSupabase() as never,
        {
          organizationId: "00000000-0000-4000-8000-000000000001",
          actorUserId: "00000000-0000-4000-8000-000000000002",
          runId: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          outputId: null,
          agentCode: code,
          artifactKind: "agent_output",
          output: { value: "persisted test artifact" },
          generationStatus: "succeeded",
          triggerType: "manual",
          expectedToolCallCount: 0,
          ...(visual ? { visualEvidence: { images: [{ base64: png, mediaType: "image/png" as const, label: "test evidence" }], sha256: "a".repeat(64), imageSha256: ["a".repeat(64)] } } : {}),
          ...(code === "a15_analista_imagenes" ? { candidateModel: "gpt-6-luna", candidateProvider: "openai", sourceAssetId: "fixture-image-id" } : {}),
        },
      );
      assert.ok(outcome.judgment_id, `${code} must persist a judgment row`);
      assert.ok(outcome.result, `${code} must return a validated rubric result: ${JSON.stringify(outcome)}`);
      assert.ok(outcome.result.criteria.length >= 7, `${code} must evaluate its complete rubric`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(persisted.length, AGENT_EVAL_AGENT_CODES.length);
  assert.deepEqual(persisted.map((row) => row.agent_code).sort(), [...AGENT_EVAL_AGENT_CODES].sort());
  const capturedA15Body = a15JudgeRequestBody as string | null;
  assert.match(capturedA15Body ?? "", /runtime_verified_visual_lineage/);
  assert.match(capturedA15Body ?? "", /same_frozen_sha256_bytes_sent_to_candidate_and_judge/);
  assert.match(capturedA15Body ?? "", /no demuestra propiedad/);
  assert.match(capturedA15Body ?? "", /fixture-image-id/);
  assert.match(capturedA15Body ?? "", /candidate_model/);
  assert.match(capturedA15Body ?? "", /asset_version_kind/);
});

test("shadow mode enqueues judge work without waiting for the provider", async () => {
  const originalFetch = globalThis.fetch;
  let providerCalled = false;
  let insertedJob: Record<string, unknown> | null = null;
  globalThis.fetch = async () => {
    providerCalled = true;
    throw new Error("shadow_dispatch_must_not_call_provider");
  };
  const supabase: any = {
    from(table: string) {
      const query: any = {
        select() { return query; },
        insert(row: Record<string, unknown>) { if (table === "agent_judge_jobs") insertedJob = row; return query; },
        update() { return query; },
        eq() { return query; },
        maybeSingle() { return Promise.resolve({ data: null, error: null }); },
        single() { return Promise.resolve({ data: { id: "queued-judge-job" }, error: null }); },
      };
      return query;
    },
  };
  try {
    const outcome = await judgePersistedAgentOutput(
      { AI_JUDGE_MODE: "shadow", AI_JUDGE_MODEL: "gpt-6-luna", OPENAI_API_KEY: "test-key" } as never,
      supabase,
      {
        organizationId: "00000000-0000-4000-8000-000000000001",
        actorUserId: "00000000-0000-4000-8000-000000000002",
        runId: "00000000-0000-4000-8000-000000000003",
        outputId: null,
        agentCode: "a01_analista_llamadas",
        artifactKind: "agent_output",
        output: { value: "already persisted" },
        generationStatus: "succeeded",
        triggerType: "manual",
        expectedToolCallCount: 0,
      },
    );
    assert.deepEqual(outcome, { judgment_id: null, status: "queued" });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(providerCalled, false);
  const savedJob = insertedJob as Record<string, unknown> | null;
  assert.equal(savedJob?.status, "queued");
  assert.equal(savedJob?.attempts, 0);
  assert.equal(savedJob?.lease_until, null);
});

test("queue worker recovers and completes a leased multimodal judge job", async () => {
  const originalFetch = globalThis.fetch;
  const persistedJudgments: Array<Record<string, unknown>> = [];
  const queueUpdates: Array<Record<string, unknown>> = [];
  const code = "a15_analista_imagenes" as const;
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
  const payload = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    actorUserId: "00000000-0000-4000-8000-000000000002",
    runId: "00000000-0000-4000-8000-000000000003",
    outputId: null,
    agentCode: code,
    artifactKind: "agent_output",
    output: { value: "recoverable visual artifact" },
    generationStatus: "succeeded",
    triggerType: "manual" as const,
    expectedToolCallCount: 0,
    visualEvidence: {
      images: [{ base64: png, mediaType: "image/png" as const, label: "Stored render" }],
      sha256: "b".repeat(64),
    },
  };
  globalThis.fetch = async () => {
    const modelOutput = {
      summary: "Recovered visual review.",
      criteria: AGENT_JUDGE_RUBRICS[code].map((criterion) => ({
        criterion_id: criterion.id,
        score: 3,
        status: "evaluable",
        rationale: "Evidence is linked to the frozen output.",
        evidence_refs: ["$.output.value"],
        critical_failure: false,
      })),
    };
    return new Response(JSON.stringify({
      id: "chatcmpl-judge-recovery",
      object: "chat.completion",
      created: 1,
      model: "gpt-6-luna",
      choices: [{ index: 0, message: { role: "assistant", content: JSON.stringify(modelOutput) }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1_000, completion_tokens: 250, total_tokens: 1_250 },
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const supabase: any = {
    rpc: async () => ({ data: [{ id: "queue-job-1", payload, attempts: 2, max_attempts: 3, organization_id: payload.organizationId }], error: null }),
    from(table: string) {
      const query: any = {
        select() { return query; },
        insert(row: Record<string, unknown>) { if (table === "agent_run_judgments") persistedJudgments.push(row); return query; },
        update(row: Record<string, unknown>) { if (table === "agent_judge_jobs") queueUpdates.push(row); return query; },
        eq() { return query; },
        order() { return query; },
        limit() { return query; },
        like() { return query; },
        maybeSingle() {
          return Promise.resolve(table === "agent_context_snapshots"
            ? { data: { snapshot: { source: "frozen-recovery-snapshot" } }, error: null }
            : { data: null, error: null });
        },
        single() { return Promise.resolve({ data: { id: "judgment-recovered" }, error: null }); },
        then(resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };

  try {
    const stats = await processAgentJudgeQueue({
      AI_JUDGE_MODE: "shadow", AI_JUDGE_MODEL: "gpt-6-luna", OPENAI_API_KEY: "test-key",
      SUPABASE_URL: "https://project.supabase.co",
    } as never, supabase, 3);
    assert.deepEqual(stats, { claimed: 1, completed: 1, retrying: 0, failed: 0 });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(persistedJudgments.length, 1);
  assert.equal(persistedJudgments[0]?.agent_code, code);
  assert.equal(queueUpdates.at(-1)?.status, "completed");
  assert.equal(queueUpdates.at(-1)?.payload, null);
});

test("visual judge evidence hashes bounded image bytes from organization-owned storage only", async () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const evidence = await loadPersistedJudgeVisualEvidence(
    { SUPABASE_URL: "https://project.supabase.co" } as never,
    "org-123",
    [{ url: "https://project.supabase.co/storage/v1/object/sign/marketing-source-assets/org-123/item.webp?token=x", role: "original" }],
    async () => new Response(webp, { status: 200, headers: { "content-type": "image/webp", "content-length": String(webp.byteLength) } }),
  );
  assert.ok(evidence);
  assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(evidence.images[0], {
    base64: Buffer.from(webp).toString("base64"),
    mediaType: "image/webp",
    role: "original",
    label: "Evidencia visual 1",
  });
});

test("visual judge never fetches untrusted URLs", async () => {
  let fetched = false;
  const evidence = await loadPersistedJudgeVisualEvidence(
    { SUPABASE_URL: "https://project.supabase.co" } as never,
    "org-123",
    [{ url: "https://attacker.example/storage/v1/object/sign/marketing-assets/org-123/item.png" }],
    async () => { fetched = true; return new Response(); },
  );
  assert.equal(evidence, null);
  assert.equal(fetched, false);
});

test("visual judge hashes validated base64 supplied by internal render preparers", async () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const evidence = await loadPersistedJudgeVisualEvidence(
    { SUPABASE_URL: "https://project.supabase.co" } as never,
    "org-123",
    [{ base64: png.toString("base64"), mediaType: "image/png", label: "Render capturado" }],
  );
  assert.ok(evidence);
  assert.match(evidence.sha256, /^[a-f0-9]{64}$/);
  const mismatch = await loadPersistedJudgeVisualEvidence(
    { SUPABASE_URL: "https://project.supabase.co" } as never,
    "org-123",
    [{ base64: png.toString("base64"), mediaType: "image/jpeg", label: "Tipo falsificado" }],
  );
  assert.equal(mismatch, null);
});

test("visual candidate reuses the exact validated bytes that the judge will receive", () => {
  const base64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");
  const evidence = {
    images: [{ base64, mediaType: "image/png" as const, role: "imagen original evaluada", label: "activo" }],
    sha256: "a".repeat(64),
    imageSha256: ["b".repeat(64)],
  };
  const candidateImages = candidateImagesFromFrozenJudgeEvidence(evidence);
  assert.equal(candidateImages?.length, 1);
  assert.equal(candidateImages?.[0] && "base64" in candidateImages[0] ? candidateImages[0].base64 : null, base64);
  assert.equal(candidateImages?.[0]?.role, "contenido");
  assert.equal(candidateImagesFromFrozenJudgeEvidence({
    ...evidence,
    images: [{ url: "https://project.supabase.co/storage/v1/object/public/marketing-assets/org/item.png" }],
  }), null, "URLs are not frozen evidence and cannot claim candidate/judge byte parity");
});
