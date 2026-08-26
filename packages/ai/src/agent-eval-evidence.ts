import type { AgentEvalResult } from "./agent-evals.js";

export type AgentEvaluationMode = "offline" | "shadow" | "live";
export type AgentEvaluationStatus = "passed" | "failed" | "incomplete";

export type AgentEvalEvidenceInput = {
  agentVersionId: string;
  datasetVersion: string;
  evaluationMode: AgentEvaluationMode;
  results: readonly AgentEvalResult[];
  overallScore?: number | null;
  scores?: Record<string, number>;
  rates?: Record<string, number>;
  evidence?: Record<string, unknown>;
};

export type AgentEvalEvidencePayload = {
  evaluation: {
    agent_version_id: string;
    dataset_version: string;
    evaluation_mode: AgentEvaluationMode;
    status: AgentEvaluationStatus;
    overall_score: number | null;
    scores: Record<string, number>;
    rates: Record<string, number>;
    evaluated_agent_codes: string[];
    agent_eval_failures: string[];
    evidence: Record<string, unknown>;
  };
  results: Array<{
    agent_code: string;
    passed: boolean;
    checks: number;
    failed: string[];
    metrics: Record<string, unknown>;
  }>;
};

function requireNonEmpty(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label}_required`);
  return normalized;
}

/**
 * Converts deterministic eval output into the AI-26 persistence contract.
 * It is pure: the caller decides when and with which privileged client to
 * persist the returned rows.
 */
export function buildAgentEvalEvidencePayload(
  input: AgentEvalEvidenceInput,
): AgentEvalEvidencePayload {
  const agentVersionId = requireNonEmpty(input.agentVersionId, "agent_version_id");
  const datasetVersion = requireNonEmpty(input.datasetVersion, "dataset_version");
  if (input.results.length === 0) throw new Error("agent_eval_results_required");

  const seen = new Set<string>();
  const results = input.results.map((result) => {
    const agentCode = requireNonEmpty(result.agentCode, "agent_code");
    if (seen.has(agentCode)) throw new Error(`agent_eval_duplicate:${agentCode}`);
    seen.add(agentCode);
    return {
      agent_code: agentCode,
      passed: result.passed,
      checks: Math.max(0, Math.trunc(result.checks)),
      failed: [...result.failed],
      metrics: {},
    };
  });

  const failures = results.flatMap((result) =>
    result.failed.map((failure) => `${result.agent_code}:${failure}`),
  );

  return {
    evaluation: {
      agent_version_id: agentVersionId,
      dataset_version: datasetVersion,
      evaluation_mode: input.evaluationMode,
      status: results.some((result) => result.failed.length > 0)
        ? "failed"
        : "passed",
      overall_score: input.overallScore ?? null,
      scores: { ...(input.scores ?? {}) },
      rates: { ...(input.rates ?? {}) },
      evaluated_agent_codes: results.map((result) => result.agent_code),
      agent_eval_failures: failures,
      evidence: { ...(input.evidence ?? {}) },
    },
    results,
  };
}
