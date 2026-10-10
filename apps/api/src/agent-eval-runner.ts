import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import type { LoadedApiEnv } from "@e-nora/config";
import {
  AGENT_EVAL_DATASET_VERSION,
  buildAgentEvalEvidencePayload,
  buildDefaultLiveEvalCases,
  buildLiveAgentEvalEvidencePayload,
  LIVE_EVAL_RELEASE_REQUIREMENTS,
  runOfflineAgentEvalSuite,
  runLiveAgentEvalSuite,
  type AgentEvalEvidencePayload,
  type AgentEvalResult,
  type LiveAgentEvalCase,
  type LiveAgentEvalProvider,
  type LiveEvalMode,
} from "@e-nora/ai";
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

async function captureCandidateFingerprint(
  supabase: SupabaseClient,
  agentVersionId: string,
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "capture_agent_version_release_manifest",
    { p_agent_version_id: agentVersionId },
  );
  if (error) throw new Error(`agent_release_manifest_capture_failed:${error.message}`);
  const manifest = data as { manifest_sha256?: unknown } | null;
  if (!manifest || typeof manifest.manifest_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(manifest.manifest_sha256)) {
    throw new Error("agent_release_manifest_fingerprint_missing");
  }
  return manifest.manifest_sha256;
}

export function buildOfflineAgentEvalPayload(
  version: ActiveAgentVersion,
  result: AgentEvalResult,
  candidateFingerprint: string | null = null,
): AgentEvalEvidencePayload {
  const payload = buildAgentEvalEvidencePayload({
    agentVersionId: version.id,
    datasetVersion: AGENT_EVAL_DATASET_VERSION,
    evaluationMode: "offline",
    results: [result],
    overallScore: result.passed ? 1 : 0,
    evidence: {
      runner: "runOfflineAgentEvalSuite",
      agent_code: version.code,
      deterministic: true,
      scope: "catalog_contract_smoke",
      release_eligible: false,
      ...(candidateFingerprint ? { candidate_fingerprint: candidateFingerprint } : {}),
    },
  });
  // The current offline matrix checks the judge/catalog contracts, not the
  // candidate's prompt, model, tools, or outputs. It must never satisfy the
  // database release gate even when those generic checks pass.
  payload.evaluation.status = result.passed ? "incomplete" : "failed";
  return payload;
}

/**
 * Runs the provider-free eval matrix for every active agent version, or for
 * the exact candidate version IDs supplied (including inactive versions), and
 * persists one idempotent evidence record per version. It deliberately does
 * not create an organization, call a model, or contact an external connector.
 */
export async function runAndPersistOfflineAgentEvals(
  supabase: SupabaseClient,
  candidateVersionIds: readonly string[] = [],
): Promise<PersistedOfflineAgentEval[]> {
  const requestedIds = [...new Set(candidateVersionIds.map((id) => id.trim()).filter(Boolean))];
  if (candidateVersionIds.length > 0 && requestedIds.length !== candidateVersionIds.length) {
    throw new Error("agent_eval_candidate_version_ids_invalid");
  }
  const query = supabase
    .from("agent_versions")
    .select("id, agent_definitions!inner(code)");
  const { data, error } = requestedIds.length > 0
    ? await query.in("id", requestedIds)
    : await query.eq("is_active", true);

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
  const loadedIds = new Set(versions.map((version) => version.id));
  const missingCandidateIds = requestedIds.filter((id) => !loadedIds.has(id));
  if (missingCandidateIds.length > 0) {
    throw new Error(`agent_eval_candidate_versions_missing:${missingCandidateIds.join(",")}`);
  }

  const resultByAgent = new Map<string, AgentEvalResult>(
    runOfflineAgentEvalSuite().map((result) => [result.agentCode, result]),
  );
  const unsupportedCandidates = versions.filter(
    (version) => requestedIds.includes(version.id) && !resultByAgent.has(version.code),
  );
  if (unsupportedCandidates.length > 0) {
    throw new Error(`agent_eval_candidate_agent_unsupported:${unsupportedCandidates.map((version) => version.code).join(",")}`);
  }
  const persisted: PersistedOfflineAgentEval[] = [];

  for (const version of versions) {
    const result = resultByAgent.get(version.code);
    if (!result) continue;
    // Offline is currently contract smoke only and cannot certify or pin a
    // release candidate. The manifest is captured immediately before an
    // actual candidate-pinned live run.
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
  candidateVersionIds: readonly string[] = [],
) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY_REQUIRED_FOR_AGENT_EVALS");
  }
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
  return runAndPersistOfflineAgentEvals(supabase, candidateVersionIds);
}

export async function runAndPersistLiveAgentEvals(
  supabase: SupabaseClient,
  version: ActiveAgentVersion,
  mode: LiveEvalMode,
  provider: LiveAgentEvalProvider,
  cases: readonly LiveAgentEvalCase[] = buildDefaultLiveEvalCases().filter(
    (testCase) => testCase.agentCode === version.code,
  ),
  datasetVersion = AGENT_EVAL_DATASET_VERSION,
) {
  // The evaluation record belongs to exactly one immutable candidate. Reject
  // malformed suites before pinning a manifest or making provider calls so a
  // mixed-agent/duplicated dataset cannot be counted toward its release gate.
  if (cases.length === 0) throw new Error("agent_eval_live_cases_required");
  const caseIds = new Set<string>();
  for (const testCase of cases) {
    if (testCase.agentCode !== version.code) {
      throw new Error("agent_eval_live_case_agent_mismatch");
    }
    const caseId = testCase.id.trim();
    if (!caseId || caseIds.has(caseId)) {
      throw new Error("agent_eval_live_case_id_invalid_or_duplicate");
    }
    caseIds.add(caseId);
  }

  const candidateFingerprint = mode === "live"
    ? await captureCandidateFingerprint(supabase, version.id)
    : null;
  const candidate = candidateFingerprint ? {
    agentVersionId: version.id,
    agentCode: version.code as LiveAgentEvalCase["agentCode"],
    candidateFingerprint,
  } : undefined;
  const results = await runLiveAgentEvalSuite(
    cases,
    mode,
    provider,
    2,
    candidate ? { candidate } : {},
  );
  // The manifest must remain unchanged for the whole suite. This closes the
  // window where a version could be edited after the initial pin while cases
  // are still executing.
  const finalCandidateFingerprint = mode === "live"
    ? await captureCandidateFingerprint(supabase, version.id)
    : null;
  const candidateManifestStable = mode !== "live"
    || finalCandidateFingerprint === candidateFingerprint;
  const payload = buildLiveAgentEvalEvidencePayload({
    agentVersionId: version.id,
    datasetVersion,
    mode,
    results,
  });
  const goldCases = cases.filter((testCase) => testCase.datasetSplit === "gold").length;
  const holdoutCases = cases.filter((testCase) => testCase.datasetSplit === "holdout").length;
  const certificationReady =
    goldCases >= LIVE_EVAL_RELEASE_REQUIREMENTS.goldCasesPerAgent
    && holdoutCases >= LIVE_EVAL_RELEASE_REQUIREMENTS.holdoutCasesPerAgent;
  const candidatePinnedCases = candidate
    ? results.filter((result) => result.executedAgentCode === candidate.agentCode
      && result.executedAgentVersionId === candidate.agentVersionId
      && result.executedCandidateFingerprint === candidate.candidateFingerprint).length
    : 0;
  const candidatePinVerified = Boolean(candidate) && candidateManifestStable && candidatePinnedCases === results.length;
  payload.evaluation.evidence = {
    ...payload.evaluation.evidence,
    ...(candidateFingerprint ? { candidate_fingerprint: candidateFingerprint } : {}),
    candidate_pin_verified: candidatePinVerified,
    candidate_manifest_stable: candidateManifestStable,
    candidate_pinned_cases: candidatePinnedCases,
    requested_candidate_version_id: version.id,
    gold_cases: goldCases,
    holdout_cases: holdoutCases,
    required_gold_cases: LIVE_EVAL_RELEASE_REQUIREMENTS.goldCasesPerAgent,
    required_holdout_cases: LIVE_EVAL_RELEASE_REQUIREMENTS.holdoutCasesPerAgent,
    release_eligible: mode === "live" && certificationReady && candidatePinVerified && results.every((result) => result.passed),
  };
  if (!certificationReady) {
    payload.evaluation.status = "incomplete";
    payload.evaluation.evidence = {
      ...payload.evaluation.evidence,
      scope: "insufficient_adjudicated_dataset",
    };
  }
  if (!candidateManifestStable) {
    payload.evaluation.status = "failed";
    payload.evaluation.evidence = {
      ...payload.evaluation.evidence,
      release_eligible: false,
      scope: "candidate_manifest_changed_during_eval",
    };
  }
  const { evaluationId } = await persistAgentEvalEvidence(supabase, payload);
  return { evaluationId, results, payload };
}
