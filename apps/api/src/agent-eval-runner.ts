import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@ecomscaling/config";
import {
  AGENT_EVAL_DATASET_VERSION,
  buildAgentEvalEvidencePayload,
  buildDefaultLiveEvalCases,
  buildLiveAgentEvalEvidencePayload,
  runOfflineAgentEvalSuite,
  runLiveAgentEvalSuite,
  type AgentEvalEvidencePayload,
  type AgentEvalResult,
  type LiveAgentEvalCase,
  type LiveAgentEvalProvider,
  type LiveEvalMode,
} from "@ecomscaling/ai";
import { persistAgentEvalEvidence } from "./agent-eval-evidence-store.js";

type ActiveAgentVersion = {
  id: string;
  code: string;
};

export type PersistedOfflineAgentEval = {
  agentVersionId: string;
  agentCode: string;
  evaluationId: string;
  passed: boolean;
};

export function buildOfflineAgentEvalPayload(
  version: ActiveAgentVersion,
  result: AgentEvalResult,
): AgentEvalEvidencePayload {
  return buildAgentEvalEvidencePayload({
    agentVersionId: version.id,
    datasetVersion: AGENT_EVAL_DATASET_VERSION,
    evaluationMode: "offline",
    results: [result],
    overallScore: result.passed ? 1 : 0,
    evidence: {
      runner: "runOfflineAgentEvalSuite",
      agent_code: version.code,
      deterministic: true,
    },
  });
}

/**
 * Runs the provider-free eval matrix for every active agent version and
 * persists one idempotent evidence record per version. It deliberately does
 * not create an organization, call a model, or contact an external connector.
 */
export async function runAndPersistOfflineAgentEvals(
  supabase: SupabaseClient,
): Promise<PersistedOfflineAgentEval[]> {
  const { data, error } = await supabase
    .from("agent_versions")
    .select("id, agent_definitions!inner(code)")
    .eq("is_active", true);

  if (error) throw new Error(`agent_eval_versions_load_failed:${error.message}`);

  const versions = (data ?? []).flatMap((row) => {
    const relation = row.agent_definitions as
      | { code?: unknown }
      | Array<{ code?: unknown }>
      | null;
    const definition = Array.isArray(relation) ? relation[0] : relation;
    return typeof row.id === "string" && typeof definition?.code === "string"
      ? [{ id: row.id, code: definition.code }]
      : [];
  });

  const resultByAgent = new Map<string, AgentEvalResult>(
    runOfflineAgentEvalSuite().map((result) => [result.agentCode, result]),
  );
  const persisted: PersistedOfflineAgentEval[] = [];

  for (const version of versions) {
    const result = resultByAgent.get(version.code);
    if (!result) continue;
    const payload = buildOfflineAgentEvalPayload(version, result);
    const { evaluationId } = await persistAgentEvalEvidence(supabase, payload);
    persisted.push({
      agentVersionId: version.id,
      agentCode: version.code,
      evaluationId,
      passed: result.passed,
    });
  }

  return persisted;
}

export async function runAndPersistOfflineAgentEvalsForEnv(
  env: Pick<LoadedApiEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">,
) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY_REQUIRED_FOR_AGENT_EVALS");
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
  return runAndPersistOfflineAgentEvals(supabase);
}

export async function runAndPersistLiveAgentEvals(
  supabase: SupabaseClient,
  version: ActiveAgentVersion,
  mode: LiveEvalMode,
  provider: LiveAgentEvalProvider,
  cases: readonly LiveAgentEvalCase[] = buildDefaultLiveEvalCases().filter(
    (testCase) => testCase.agentCode === version.code,
  ),
) {
  const results = await runLiveAgentEvalSuite(cases, mode, provider);
  const payload = buildLiveAgentEvalEvidencePayload({
    agentVersionId: version.id,
    datasetVersion: AGENT_EVAL_DATASET_VERSION,
    mode,
    results,
  });
  const { evaluationId } = await persistAgentEvalEvidence(supabase, payload);
  return { evaluationId, results, payload };
}
