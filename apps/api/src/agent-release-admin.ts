import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { ACTIVE_AGENT_CODES, AGENT_EVAL_DATASET_VERSION, JUDGE_RUBRIC_VERSION } from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";
import { runAndPersistOfflineAgentEvals } from "./agent-eval-runner.js";

export type AgentReleaseCandidate = {
  id: string;
  code: string;
  name: string;
  version: string;
  model: string;
  is_active: boolean;
  evaluations: {
    offline: { status: string; evaluated_at: string | null } | null;
    live: { status: string; evaluated_at: string | null } | null;
  };
  judge_calibration: { status: string; dataset_version: string; evaluated_at: string | null } | null;
  can_promote: boolean;
};

function serviceClient(env: Pick<LoadedApiEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">) {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY_REQUIRED");
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

export async function listAgentReleaseCandidatesFromClient(
  supabase: SupabaseClient,
): Promise<AgentReleaseCandidate[]> {
  const { data, error } = await supabase
    .from("agent_versions")
    .select("id, version, model, is_active, created_at, agent_definitions!inner(code, name)")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(`agent_release_candidates_load_failed:${error.message}`);

  const activeCodes = new Set<string>(ACTIVE_AGENT_CODES);
  const versions = (data ?? []).flatMap((row) => {
    const relation = row.agent_definitions as
      | { code?: unknown; name?: unknown }
      | Array<{ code?: unknown; name?: unknown }>
      | null;
    const definition = Array.isArray(relation) ? relation[0] : relation;
    if (
      typeof row.id !== "string"
      || typeof row.version !== "string"
      || typeof row.model !== "string"
      || typeof row.is_active !== "boolean"
      || typeof definition?.code !== "string"
      || !activeCodes.has(definition.code)
    ) return [];
    return [{
      id: row.id,
      code: definition.code,
      name: typeof definition.name === "string" ? definition.name : definition.code,
      version: row.version,
      model: row.model,
      is_active: row.is_active,
    }];
  });
  if (versions.length === 0) return [];

  const { data: evaluations, error: evaluationsError } = await supabase
    .from("agent_version_evaluations")
    .select("id, agent_version_id, evaluation_mode, status, evaluated_at, evaluated_agent_codes, evidence")
    .in("agent_version_id", versions.map((version) => version.id))
    .eq("dataset_version", AGENT_EVAL_DATASET_VERSION)
    .in("evaluation_mode", ["offline", "live"])
    .order("evaluated_at", { ascending: false });
  if (evaluationsError) {
    throw new Error(`agent_release_evaluations_load_failed:${evaluationsError.message}`);
  }

  const { data: manifests, error: manifestsError } = await supabase
    .from("agent_version_release_manifests")
    .select("agent_version_id, manifest_sha256")
    .in("agent_version_id", versions.map((version) => version.id));
  if (manifestsError) throw new Error(`agent_release_manifests_load_failed:${manifestsError.message}`);
  const fingerprintByVersion = new Map<string, string>((manifests ?? []).flatMap((row) =>
    typeof row.agent_version_id === "string" && typeof row.manifest_sha256 === "string"
      ? [[row.agent_version_id, row.manifest_sha256] as [string, string]]
      : [],
  ));

  const [{ data: calibrationRuns, error: calibrationError }, { data: freezes, error: freezesError }] = await Promise.all([
    supabase.from("agent_judge_calibration_runs").select("dataset_version, rubric_version, evaluation_split, status, report, created_at").eq("rubric_version", "judge-rubrics-v1").eq("evaluation_split", "holdout").order("created_at", { ascending: false }).limit(100),
    supabase.from("agent_judge_eval_dataset_freezes").select("dataset_version, manifest_sha256"),
  ]);
  if (calibrationError || freezesError) throw new Error("agent_release_judge_calibration_load_failed");
  const manifestByDataset = new Map<string, string>((freezes ?? []).flatMap((row: any) => typeof row.dataset_version === "string" && typeof row.manifest_sha256 === "string" ? [[row.dataset_version, row.manifest_sha256] as [string, string]] : []));
  const latestByDataset = new Map<string, any>();
  for (const run of calibrationRuns ?? []) if (run.evaluation_split === "holdout" && typeof run.dataset_version === "string" && !latestByDataset.has(run.dataset_version)) latestByDataset.set(run.dataset_version, run);
  const approvedCalibration = [...latestByDataset.values()].find((run: any) => run.status === "passed" && run.report?.allowed === true && run.report?.holdout_manifest_sha256 === manifestByDataset.get(run.dataset_version));
  const judgeCalibration = approvedCalibration ? { status: "passed", dataset_version: approvedCalibration.dataset_version, evaluated_at: typeof approvedCalibration.created_at === "string" ? approvedCalibration.created_at : null } : null;

  const byVersion = new Map<string, AgentReleaseCandidate["evaluations"]>();
  const releaseEvidenceByVersion = new Map<string, { offline: boolean; live: boolean }>();
  for (const row of evaluations ?? []) {
    if (typeof row.agent_version_id !== "string") continue;
    const candidate = versions.find((version) => version.id === row.agent_version_id);
    const fingerprint = fingerprintByVersion.get(row.agent_version_id);
    const evidence = row.evidence && typeof row.evidence === "object" && !Array.isArray(row.evidence)
      ? row.evidence as Record<string, unknown>
      : {};
    const codes = Array.isArray(row.evaluated_agent_codes) ? row.evaluated_agent_codes : [];
    const commonEvidenceValid = Boolean(candidate && fingerprint)
      && evidence.candidate_fingerprint === fingerprint
      && evidence.release_eligible === true
      && codes.includes(candidate?.code);
    let modeEligible = commonEvidenceValid;
    if (row.evaluation_mode === "live") {
      const cases = Array.isArray(evidence.cases) ? evidence.cases as Array<Record<string, unknown>> : [];
      const gold = cases.filter((item) => item.dataset_split === "gold").length;
      const holdout = cases.filter((item) => item.dataset_split === "holdout").length;
      modeEligible = commonEvidenceValid
        && evidence.candidate_pin_verified === true
        && evidence.candidate_pinned_cases === cases.length
        && gold >= 10
        && holdout >= 3
        && cases.length >= 13
        && cases.every((item) => item.executed_agent_code === candidate?.code
          && item.executed_agent_version_id === candidate?.id
          && item.executed_candidate_fingerprint === fingerprint
          && item.candidate_judge_status === "passed"
          && item.candidate_judge_rubric_version === JUDGE_RUBRIC_VERSION
          && typeof item.candidate_judge_score === "number"
          && item.candidate_judge_score >= 3.2
          && typeof item.candidate_judged_output_sha256 === "string"
          && /^[0-9a-f]{64}$/.test(item.candidate_judged_output_sha256));
    }
    const eligibility = releaseEvidenceByVersion.get(row.agent_version_id) ?? { offline: false, live: false };
    if (row.evaluation_mode === "offline" && row.status === "passed" && modeEligible) eligibility.offline = true;
    if (row.evaluation_mode === "live" && row.status === "passed" && modeEligible) eligibility.live = true;
    releaseEvidenceByVersion.set(row.agent_version_id, eligibility);

    const evaluation = byVersion.get(row.agent_version_id) ?? { offline: null, live: null };
    const slot = row.evaluation_mode === "offline" ? "offline" : row.evaluation_mode === "live" ? "live" : null;
    if (!slot || evaluation[slot]) continue;
    evaluation[slot] = {
      status: typeof row.status === "string" ? row.status : "incomplete",
      evaluated_at: typeof row.evaluated_at === "string" ? row.evaluated_at : null,
    };
    byVersion.set(row.agent_version_id, evaluation);
  }

  return versions.map((version) => {
    const versionEvaluations = byVersion.get(version.id) ?? { offline: null, live: null };
    return {
      ...version,
      evaluations: versionEvaluations,
      judge_calibration: judgeCalibration,
      can_promote: releaseEvidenceByVersion.get(version.id)?.offline === true
        && releaseEvidenceByVersion.get(version.id)?.live === true
        && judgeCalibration?.status === "passed",
    };
  });
}

export async function listAgentReleaseCandidates(env: LoadedApiEnv) {
  return listAgentReleaseCandidatesFromClient(serviceClient(env));
}

export async function evaluateAgentReleaseCandidateOffline(
  env: LoadedApiEnv,
  agentVersionId: string,
) {
  const rows = await runAndPersistOfflineAgentEvals(serviceClient(env), [agentVersionId]);
  return rows[0] ?? null;
}

export async function promoteAgentReleaseCandidate(
  env: LoadedApiEnv,
  agentVersionId: string,
) {
  const { error } = await serviceClient(env).rpc("promote_agent_version", {
    p_agent_version_id: agentVersionId,
  });
  if (error) throw new Error(error.message || "agent_release_promotion_failed");
}
