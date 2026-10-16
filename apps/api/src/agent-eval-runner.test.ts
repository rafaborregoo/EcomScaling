import assert from "node:assert/strict";
import test from "node:test";
import { AGENT_JUDGE_RUBRICS, JUDGE_RUBRIC_VERSION, finalizeAgentJudgeResult, hashLiveAgentEvalOutput, runLiveAgentEvalCase } from "@e-nora/ai";
import {
  buildOfflineAgentEvalPayload,
  runAndPersistLiveAgentEvals,
  runAndPersistOfflineAgentEvals,
} from "./agent-eval-runner.js";

test("construye evidencia offline por version sin conectores", () => {
  const payload = buildOfflineAgentEvalPayload(
    { id: "version-1", code: "a01_analista_llamadas" },
    {
      agentCode: "a01_analista_llamadas",
      passed: true,
      checks: 9,
      failed: [],
    },
    "a".repeat(64),
  );

  assert.equal(payload.evaluation.agent_version_id, "version-1");
  assert.equal(payload.evaluation.dataset_version, "2026-09-29.v2");
  assert.equal(payload.evaluation.evaluation_mode, "offline");
  assert.deepEqual(payload.evaluation.evaluated_agent_codes, [
    "a01_analista_llamadas",
  ]);
  assert.equal(payload.evaluation.status, "incomplete");
  assert.equal(payload.evaluation.evidence.release_eligible, false);
  assert.equal(payload.evaluation.evidence.scope, "catalog_contract_smoke");
  assert.equal(payload.evaluation.evidence.candidate_fingerprint, "a".repeat(64));
});

test("conserva el fallo del agente en la evidencia offline", () => {
  const payload = buildOfflineAgentEvalPayload(
    { id: "version-1", code: "a02_monitor_negocio" },
    {
      agentCode: "a02_monitor_negocio",
      passed: false,
      checks: 9,
      failed: ["tenant_leak"],
    },
  );

  assert.equal(payload.evaluation.status, "failed");
  assert.deepEqual(payload.evaluation.agent_eval_failures, [
    "a02_monitor_negocio:tenant_leak",
  ]);
});

test("evalúa una versión candidata inactiva seleccionada por ID", async () => {
  let selectedIds: string[] = [];
  let persistedVersionIds: string[] = [];
  const client: any = {
    schema: () => client,
    from: () => ({
      select: () => ({
        in: async (_column: string, ids: string[]) => {
          selectedIds = ids;
          return {
            data: [{ id: "candidate-1", agent_definitions: { code: "a05_estrategia_campanas" } }],
            error: null,
          };
        },
      }),
    }),
    rpc: async (name: string, args: { p_payload?: any; p_agent_version_id?: string }) => {
      if (name === "capture_agent_version_release_manifest") {
        return { data: { manifest_sha256: "b".repeat(64) }, error: null };
      }
      persistedVersionIds.push(args.p_payload.evaluation.agent_version_id);
      return { data: `evaluation-${persistedVersionIds.length}`, error: null };
    },
  } as any;

  const result = await runAndPersistOfflineAgentEvals(client, ["candidate-1"]);

  assert.deepEqual(selectedIds, ["candidate-1"]);
  assert.deepEqual(persistedVersionIds, ["candidate-1"]);
  assert.equal(result[0]?.agentCode, "a05_estrategia_campanas");
});

test("no persiste evaluación offline si falta una candidata solicitada", async () => {
  let rpcCalls = 0;
  const client: any = {
    schema: () => client,
    from: () => ({
      select: () => ({ in: async () => ({ data: [], error: null }) }),
    }),
    rpc: async () => { rpcCalls += 1; return { data: "unused", error: null }; },
  } as any;

  await assert.rejects(
    runAndPersistOfflineAgentEvals(client, ["missing-candidate"]),
    /agent_eval_candidate_versions_missing:missing-candidate/,
  );
  assert.equal(rpcCalls, 0);
});

test("rechaza candidatas que no pertenecen al catálogo activo", async () => {
  let rpcCalls = 0;
  const client: any = {
    schema: () => client,
    from: () => ({
      select: () => ({
        in: async () => ({
          data: [{ id: "candidate-retired", agent_definitions: { code: "a03_agente_retirado" } }],
          error: null,
        }),
      }),
    }),
    rpc: async () => { rpcCalls += 1; return { data: "unused", error: null }; },
  } as any;

  await assert.rejects(
    runAndPersistOfflineAgentEvals(client, ["candidate-retired"]),
    /agent_eval_candidate_agent_unsupported:a03_agente_retirado/,
  );
  assert.equal(rpcCalls, 0);
});

test("conecta live con el writer AI-26 y fija huella exacta del candidato", async () => {
  let captured: unknown = null;
  const client: any = {
    schema: () => client,
    rpc: async (name: string, args: { p_payload?: unknown }) => {
      if (name === "capture_agent_version_release_manifest") {
        return { data: { manifest_sha256: "c".repeat(64) }, error: null };
      }
      captured = args.p_payload;
      return { data: "00000000-0000-0000-0000-000000000003", error: null };
    },
  } as any;
  const result = await runAndPersistLiveAgentEvals(
    client,
    { id: "version-1", code: "a14_operativa_meta" },
    "live",
    async (_testCase, _signal, candidate) => {
      const output = {
        answer: "No hay datos suficientes.",
        sources: [],
        confidence: "low",
        warnings: ["meta_not_connected"],
      };
      const candidateJudgment = finalizeAgentJudgeResult("a14_operativa_meta", {
        summary: "La salida respeta la evidencia disponible.",
        criteria: AGENT_JUDGE_RUBRICS.a14_operativa_meta.map((criterion) => ({
          criterion_id: criterion.id, score: 4, status: "evaluable" as const,
          rationale: "El artefacto contiene evidencia suficiente para este criterio.",
          evidence_refs: ["$.output.answer"], critical_failure: false,
        })),
      }, () => true);
      return {
        output,
        latencyMs: 25,
        costUsd: 0.01,
        traceId: "trace-shadow",
        executedAgentCode: candidate!.agentCode,
        executedAgentVersionId: candidate!.agentVersionId,
        executedCandidateFingerprint: candidate!.candidateFingerprint,
        candidateJudgment,
        candidateJudgedOutputSha256: hashLiveAgentEvalOutput(output),
      };
    },
    [
      {
        id: "case-1",
        agentCode: "a14_operativa_meta",
        objective: "Analiza Meta Ads",
        expectedAbstention: true,
        evidenceContext: { organizationId: "eval-org", availableSources: [] },
      },
    ],
  );

  assert.equal(result.evaluationId, "00000000-0000-0000-0000-000000000003");
  assert.equal(result.results[0]?.passed, true);
  assert.equal(result.payload.evaluation.status, "incomplete");
  assert.equal(result.payload.evaluation.evidence.release_eligible, false);
  assert.equal(result.payload.evaluation.evidence.scope, "insufficient_adjudicated_dataset");
  assert.equal(result.payload.evaluation.evidence.gold_cases, 0);
  assert.equal(result.payload.evaluation.evidence.holdout_cases, 0);
  assert.equal(result.payload.evaluation.evidence.candidate_fingerprint, "c".repeat(64));
  assert.equal(result.payload.evaluation.evidence.candidate_pin_verified, true);
  assert.equal(result.payload.evaluation.evidence.candidate_pinned_cases, 1);
  assert.equal((result.payload.evaluation.evidence.cases as Array<Record<string, unknown>>)[0]?.candidate_judge_status, "passed");
  assert.equal((result.payload.evaluation.evidence.cases as Array<Record<string, unknown>>)[0]?.candidate_judge_rubric_version, JUDGE_RUBRIC_VERSION);
  assert.equal((result.payload.evaluation.evidence.cases as Array<Record<string, unknown>>)[0]?.candidate_judged_output_sha256, hashLiveAgentEvalOutput({
    answer: "No hay datos suficientes.", sources: [], confidence: "low", warnings: ["meta_not_connected"],
  }));
  assert.equal((captured as any).evaluation.evaluation_mode, "live");
});

test("live no certifica si el provider no demuestra la huella realmente ejecutada", async () => {
  let payload: any;
  const client: any = {
    schema: () => client,
    rpc: async (name: string, args: { p_payload?: unknown }) => {
      if (name === "capture_agent_version_release_manifest") {
        return { data: { manifest_sha256: "d".repeat(64) }, error: null };
      }
      payload = args.p_payload;
      return { data: "evaluation-unpinned", error: null };
    },
  } as any;
  const result = await runAndPersistLiveAgentEvals(
    client,
    { id: "candidate-unpinned", code: "a14_operativa_meta" },
    "live",
    async () => ({
      output: { answer: "No hay datos suficientes.", sources: [], confidence: "low", warnings: ["missing_data"] },
      latencyMs: 20,
      costUsd: 0.01,
      traceId: "unbound-run",
    }),
    [{
      id: "case-unpinned",
      agentCode: "a14_operativa_meta",
      datasetSplit: "gold",
      objective: "Comprueba abstención con evidencia vacía",
      expectedAbstention: true,
      evidenceContext: { organizationId: "eval-org", availableSources: [] },
    }],
  );
  assert.equal(result.results[0]?.passed, false);
  assert.ok(result.results[0]?.failures.includes("candidate_agent_code_mismatch"));
  assert.ok(result.results[0]?.failures.includes("candidate_version_mismatch"));
  assert.ok(result.results[0]?.failures.includes("candidate_fingerprint_mismatch"));
  assert.equal(result.payload.evaluation.evidence.candidate_pin_verified, false);
  assert.equal(result.payload.evaluation.evidence.release_eligible, false);
  assert.equal(payload.evaluation.status, "incomplete");
});

test("rechaza una suite live vacía antes de capturar la candidata", async () => {
  let rpcCalls = 0;
  const client = { rpc: async () => { rpcCalls += 1; return { data: null, error: null }; } } as any;
  await assert.rejects(
    runAndPersistLiveAgentEvals(client, { id: "version-1", code: "a14_operativa_meta" }, "live", async () => {
      throw new Error("provider_should_not_run");
    }, []),
    /agent_eval_live_cases_required/,
  );
  assert.equal(rpcCalls, 0);
});

test("rechaza casos de otros agentes antes de capturar la candidata", async () => {
  let rpcCalls = 0;
  const client = { rpc: async () => { rpcCalls += 1; return { data: null, error: null }; } } as any;
  await assert.rejects(
    runAndPersistLiveAgentEvals(client, { id: "version-1", code: "a14_operativa_meta" }, "live", async () => {
      throw new Error("provider_should_not_run");
    }, [{
      id: "cross-agent-case",
      agentCode: "a05_estrategia_campanas",
      objective: "Caso de prueba",
      expectedAbstention: true,
      evidenceContext: { organizationId: "eval-org", availableSources: [] },
    }]),
    /agent_eval_live_case_agent_mismatch/,
  );
  assert.equal(rpcCalls, 0);
});

test("rechaza IDs duplicados en la suite live", async () => {
  let rpcCalls = 0;
  const client = { rpc: async () => { rpcCalls += 1; return { data: null, error: null }; } } as any;
  const duplicate = {
    id: "same-case",
    agentCode: "a14_operativa_meta" as const,
    objective: "Caso de prueba",
    expectedAbstention: true,
    evidenceContext: { organizationId: "eval-org", availableSources: [] },
  };
  await assert.rejects(
    runAndPersistLiveAgentEvals(client, { id: "version-1", code: "a14_operativa_meta" }, "live", async () => {
      throw new Error("provider_should_not_run");
    }, [duplicate, { ...duplicate }]),
    /agent_eval_live_case_id_invalid_or_duplicate/,
  );
  assert.equal(rpcCalls, 0);
});

test("live eval exige campos estructurales del fixture y prohíbe artefactos de creación", async () => {
  const result = await runLiveAgentEvalCase({
    id: "fixture-constraints",
    agentCode: "a14_operativa_meta",
    objective: "Diagnostica el resultado.",
    expectedAbstention: true,
    evidenceContext: { organizationId: "eval-org", availableSources: [] },
    outputConstraints: { requiredPaths: ["$.answer"], forbiddenPaths: ["$.email_draft"] },
  }, "shadow", async () => ({
    output: { answer: "Faltan datos suficientes.", confidence: "low", warnings: ["missing_data"], email_draft: "x" },
    latencyMs: 1, costUsd: 0, traceId: null,
  }));
  assert.equal(result.passed, false);
  assert.deepEqual(result.failures, ["evidence_contract", "forbidden_output_path_present:$.email_draft"]);
});

test("marca fallida una evaluación si cambia el manifest mientras se ejecuta la suite", async () => {
  let captures = 0;
  let payload: any;
  const client: any = {
    schema: () => client,
    rpc: async (name: string, args: { p_payload?: unknown }) => {
      if (name === "capture_agent_version_release_manifest") {
        captures += 1;
        return { data: { manifest_sha256: captures === 1 ? "e".repeat(64) : "f".repeat(64) }, error: null };
      }
      payload = args.p_payload;
      return { data: "evaluation-mutated", error: null };
    },
  } as any;
  const result = await runAndPersistLiveAgentEvals(
    client,
    { id: "candidate-mutated", code: "a14_operativa_meta" },
    "live",
    async () => ({
      output: { answer: "Faltan datos suficientes.", sources: [], confidence: "low", warnings: ["missing_data"] },
      latencyMs: 1, costUsd: 0, traceId: null,
    }),
    [{ id: "mutation-case", agentCode: "a14_operativa_meta", expectedAbstention: true,
      objective: "Evalúa con datos vacíos.", evidenceContext: { organizationId: "eval-org", availableSources: [] } }],
  );
  assert.equal(captures, 2);
  assert.equal(result.payload.evaluation.status, "failed");
  assert.equal(result.payload.evaluation.evidence.candidate_manifest_stable, false);
  assert.equal(result.payload.evaluation.evidence.release_eligible, false);
  assert.equal(payload.evaluation.status, "failed");
});
