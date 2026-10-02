import assert from "node:assert/strict";
import test from "node:test";
import { buildOfflineAgentEvalPayload } from "./agent-eval-runner.js";
import { runAndPersistLiveAgentEvals } from "./agent-eval-runner.js";

test("construye evidencia offline por version sin conectores", () => {
  const payload = buildOfflineAgentEvalPayload(
    { id: "version-1", code: "a01_analista_llamadas" },
    {
      agentCode: "a01_analista_llamadas",
      passed: true,
      checks: 9,
      failed: [],
    },
  );

  assert.equal(payload.evaluation.agent_version_id, "version-1");
  assert.equal(payload.evaluation.dataset_version, "2026-09-29.v2");
  assert.equal(payload.evaluation.evaluation_mode, "offline");
  assert.deepEqual(payload.evaluation.evaluated_agent_codes, [
    "a01_analista_llamadas",
  ]);
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

test("conecta shadow/live con el writer AI-26 mediante provider inyectado", async () => {
  let captured: unknown = null;
  const client = {
    rpc: async (_name: string, args: { p_payload: unknown }) => {
      captured = args.p_payload;
      return {
        data: "00000000-0000-0000-0000-000000000003",
        error: null,
      };
    },
  } as any;
  const result = await runAndPersistLiveAgentEvals(
    client,
    { id: "version-1", code: "a14_operativa_meta" },
    "shadow",
    async () => ({
      output: {
        answer: "No hay datos suficientes.",
        sources: [],
        confidence: "low",
        warnings: ["meta_not_connected"],
      },
      latencyMs: 25,
      costUsd: 0.01,
      traceId: "trace-shadow",
    }),
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
  assert.equal((captured as any).evaluation.evaluation_mode, "shadow");
});
