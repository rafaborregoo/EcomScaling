import assert from "node:assert/strict";
import test from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { persistAgentEvalEvidence } from "./agent-eval-evidence-store.js";

const payload = {
  evaluation: {
    agent_version_id: "00000000-0000-0000-0000-000000000001",
    dataset_version: "2026-08-26.v1",
    evaluation_mode: "offline" as const,
    status: "passed" as const,
    overall_score: 1,
    scores: {},
    rates: {},
    evaluated_agent_codes: ["a01_analista_llamadas"],
    agent_eval_failures: [],
    evidence: {},
  },
  results: [],
};

test("persiste mediante la RPC y devuelve el id", async () => {
  const client = {
    rpc: async () => ({
      data: "00000000-0000-0000-0000-000000000002",
      error: null,
    }),
  } as unknown as SupabaseClient;

  assert.deepEqual(await persistAgentEvalEvidence(client, payload), {
    evaluationId: "00000000-0000-0000-0000-000000000002",
  });
});

test("no oculta errores de persistencia", async () => {
  const client = {
    rpc: async () => ({ data: null, error: { message: "permission denied" } }),
  } as unknown as SupabaseClient;

  await assert.rejects(
    persistAgentEvalEvidence(client, payload),
    /agent_eval_evidence_persist_failed:permission denied/,
  );
});
