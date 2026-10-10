import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import {
  ACTIVE_AGENT_CODES,
  AGENT_EVAL_DATASET_VERSION,
} from "@e-nora/ai";
import type { LoadedApiEnv } from "@e-nora/config";

export type AgentEvalReadinessResponse = {
  coveredAgents: number;
  totalAgents: number;
  offlineRunRecorded: boolean;
  liveVerified: boolean;
  datasetVersion: string;
  source: "persisted" | "local_prepared";
};

export function isMissingAgentEvalEvidenceTableError(error: {
  code?: string | null;
  message?: string | null;
}): boolean {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /relation .*agent_version_evaluations.*does not exist/i.test(
      error.message ?? "",
    ) ||
    /could not find the table ['\"](?:public\.)?agent_version_evaluations['\"] in the schema cache/i.test(
      error.message ?? "",
    )
  );
}

export function buildAgentEvalReadinessResponse({
  persistedOfflineAgents,
  persistedLiveAgents,
  remoteEvidenceAvailable,
}: {
  persistedOfflineAgents: readonly string[];
  persistedLiveAgents: readonly string[];
  remoteEvidenceAvailable: boolean;
}): AgentEvalReadinessResponse {
  const active = new Set<string>(ACTIVE_AGENT_CODES);
  const offline = new Set(
    persistedOfflineAgents.filter((agent) => active.has(agent)),
  );
  const live = new Set(persistedLiveAgents.filter((agent) => active.has(agent)));
  return {
    coveredAgents: remoteEvidenceAvailable ? offline.size : active.size,
    totalAgents: active.size,
    offlineRunRecorded: remoteEvidenceAvailable && offline.size === active.size,
    liveVerified: remoteEvidenceAvailable && live.size === active.size,
    datasetVersion: AGENT_EVAL_DATASET_VERSION,
    source: remoteEvidenceAvailable ? "persisted" : "local_prepared",
  };
}

function releaseEvidenceMatchesVersion(
  evidence: unknown,
  manifestRelation: unknown,
  mode: "offline" | "live",
): boolean {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) return false;
  const record = evidence as Record<string, unknown>;
  const fingerprint = record.candidate_fingerprint;
  if (record.release_eligible !== true || typeof fingerprint !== "string" || !/^[0-9a-f]{64}$/.test(fingerprint)) {
    return false;
  }
  const relation = Array.isArray(manifestRelation) ? manifestRelation[0] : manifestRelation;
  if (!relation || typeof relation !== "object" || (relation as Record<string, unknown>).manifest_sha256 !== fingerprint) {
    return false;
  }
  if (mode === "live") {
    return Number.isInteger(record.gold_cases) && Number(record.gold_cases) >= 10
      && Number.isInteger(record.holdout_cases) && Number(record.holdout_cases) >= 3;
  }
  return true;
}

export async function getAgentEvalReadiness(
  env: Pick<LoadedApiEnv, "SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY">,
): Promise<AgentEvalReadinessResponse> {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    return buildAgentEvalReadinessResponse({
      persistedOfflineAgents: [],
      persistedLiveAgents: [],
      remoteEvidenceAvailable: false,
    });
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
  return getAgentEvalReadinessFromClient(supabase);
}

export async function getAgentEvalReadinessFromClient(
  supabase: SupabaseClient,
): Promise<AgentEvalReadinessResponse> {
  const query = (supabase as SupabaseClient).from("agent_version_evaluations");
  const { data, error } = await query
    .select(
      "evaluation_mode, status, evidence, evaluated_agent_codes, evaluated_at, agent_versions!inner(is_active, agent_version_release_manifests(manifest_sha256))",
    )
    .eq("dataset_version", AGENT_EVAL_DATASET_VERSION)
    .eq("status", "passed");

  // AI-26 may not have reached the remote project yet. This is a valid
  // prepared state, not an API failure or a claim of live validation.
  if (error) {
    if (!isMissingAgentEvalEvidenceTableError(error)) {
      throw new Error(`agent_eval_readiness_load_failed:${error.message}`);
    }
    return buildAgentEvalReadinessResponse({
      persistedOfflineAgents: [],
      persistedLiveAgents: [],
      remoteEvidenceAvailable: false,
    });
  }

  const offline = new Set<string>();
  const live = new Set<string>();
  for (const row of data ?? []) {
    const version = row.agent_versions as
      | { is_active?: unknown; agent_version_release_manifests?: unknown }
      | Array<{ is_active?: unknown; agent_version_release_manifests?: unknown }>
      | null;
    const activeVersion = Array.isArray(version) ? version[0] : version;
    if (activeVersion?.is_active !== true) continue;
    const agents = Array.isArray(row.evaluated_agent_codes)
      ? row.evaluated_agent_codes
      : [];
    for (const agent of agents) {
      if (typeof agent !== "string") continue;
      const manifests = activeVersion.agent_version_release_manifests;
      if (row.evaluation_mode === "offline" && releaseEvidenceMatchesVersion(row.evidence, manifests, "offline")) offline.add(agent);
      if (row.evaluation_mode === "live" && releaseEvidenceMatchesVersion(row.evidence, manifests, "live")) live.add(agent);
    }
  }
  return buildAgentEvalReadinessResponse({
    persistedOfflineAgents: [...offline],
    persistedLiveAgents: [...live],
    remoteEvidenceAvailable: true,
  });
}
