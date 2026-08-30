import assert from "node:assert/strict";
import test from "node:test";
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
  assert.equal(response.coveredAgents, 11);
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
