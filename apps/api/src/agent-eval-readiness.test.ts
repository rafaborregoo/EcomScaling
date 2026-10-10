import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVE_AGENT_CODES } from "@e-nora/ai";
import {
  buildAgentEvalReadinessResponse,
  getAgentEvalReadinessFromClient,
  isMissingAgentEvalEvidenceTableError,
} from "./agent-eval-readiness.js";

test("reconoce solo la ausencia esperada de la tabla AI-26", () => {
  assert.equal(
    isMissingAgentEvalEvidenceTableError({
      code: "42P01",
      message: "relation agent_version_evaluations does not exist",
    }),
    true,
  );
  assert.equal(
    isMissingAgentEvalEvidenceTableError({
      code: "42501",
      message: "permission denied",
    }),
    false,
  );
  assert.equal(
    isMissingAgentEvalEvidenceTableError({
      code: "PGRST205",
      message: "Could not find the table 'public.agent_version_evaluations' in the schema cache",
    }),
    true,
  );
});

test("fallback local preparado no simula evidencia remota", () => {
  const response = buildAgentEvalReadinessResponse({
    persistedOfflineAgents: [],
    persistedLiveAgents: [],
    remoteEvidenceAvailable: false,
  });
  assert.equal(response.source, "local_prepared");
  // Sin evidencia remota se declaran cubiertos todos los activos, sean cuantos sean.
  assert.equal(response.coveredAgents, response.totalAgents);
  assert.ok(response.totalAgents > 0);
  assert.equal(response.offlineRunRecorded, false);
  assert.equal(response.liveVerified, false);
});

test("calcula readiness persistido solo con agentes conocidos", () => {
  const response = buildAgentEvalReadinessResponse({
    persistedOfflineAgents: ["a01_analista_llamadas", "not_real"],
    persistedLiveAgents: [],
    remoteEvidenceAvailable: true,
  });
  assert.equal(response.coveredAgents, 1);
  assert.equal(response.offlineRunRecorded, false);
});

test("las evaluaciones de versiones inactivas no cuentan como readiness", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: [
              {
                evaluation_mode: "offline",
                status: "passed",
                evaluated_agent_codes: ["a01_analista_llamadas"],
                agent_versions: { is_active: false },
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  } as any;
  const response = await getAgentEvalReadinessFromClient(client);
  assert.equal(response.coveredAgents, 0);
  assert.equal(response.offlineRunRecorded, false);
});

test("no trata una evaluación antigua aprobada como release verificado", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: [
              {
                evaluation_mode: "offline",
                status: "passed",
                evaluated_agent_codes: ["a17_plan_semanal"],
                evidence: { runner: "old-smoke" },
                agent_versions: { is_active: true, agent_version_release_manifests: null },
              },
              {
                evaluation_mode: "live",
                status: "passed",
                evaluated_agent_codes: ["a17_plan_semanal"],
                evidence: { scope: "single_missing_data_smoke", release_eligible: false },
                agent_versions: { is_active: true, agent_version_release_manifests: null },
              },
            ],
            error: null,
          }),
        }),
      }),
    }),
  } as any;
  const response = await getAgentEvalReadinessFromClient(client);
  assert.equal(response.coveredAgents, 0);
  assert.equal(response.offlineRunRecorded, false);
  assert.equal(response.liveVerified, false);
});

test("readiness solo acepta evidencia con fingerprint y suite live gold/holdout", async () => {
  const fingerprint = "a".repeat(64);
  const data = ACTIVE_AGENT_CODES.flatMap((agentCode) => [
    {
      evaluation_mode: "offline",
      status: "passed",
      evaluated_agent_codes: [agentCode],
      evidence: { candidate_fingerprint: fingerprint, release_eligible: true },
      agent_versions: { is_active: true, agent_version_release_manifests: { manifest_sha256: fingerprint } },
    },
    {
      evaluation_mode: "live",
      status: "passed",
      evaluated_agent_codes: [agentCode],
      evidence: {
        candidate_fingerprint: fingerprint,
        release_eligible: true,
        gold_cases: 10,
        holdout_cases: 3,
      },
      agent_versions: { is_active: true, agent_version_release_manifests: { manifest_sha256: fingerprint } },
    },
  ]);
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data, error: null }),
        }),
      }),
    }),
  } as any;
  const response = await getAgentEvalReadinessFromClient(client);
  assert.equal(response.coveredAgents, ACTIVE_AGENT_CODES.length);
  assert.equal(response.offlineRunRecorded, true);
  assert.equal(response.liveVerified, true);
});

test("degrada a preparado cuando AI-26 aún no existe en Supabase", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({
            data: null,
            error: {
              code: "42P01",
              message: 'relation "agent_version_evaluations" does not exist',
            },
          }),
        }),
      }),
    }),
  } as any;
  const response = await getAgentEvalReadinessFromClient(client);
  assert.equal(response.source, "local_prepared");
  assert.equal(response.liveVerified, false);
});

test("no oculta errores de permisos como estado preparado", async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: null, error: { code: "42501", message: "permission denied" } }),
        }),
      }),
    }),
  } as any;
  await assert.rejects(
    getAgentEvalReadinessFromClient(client),
    /agent_eval_readiness_load_failed:permission denied/,
  );
});
