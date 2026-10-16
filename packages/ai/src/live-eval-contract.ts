import { createHash } from "node:crypto";
import {
  evaluateAgentEvidenceContract,
} from "./evidence-evals.js";
import { ACTIVE_AGENT_CODES, type ActiveAgentCode } from "./agent-evals.js";
import { agentJudgeResultSchema, finalizeAgentJudgeResult, JUDGE_RUBRIC_VERSION, type AgentJudgeResult } from "./agent-judge.js";
import {
  buildAgentEvalEvidencePayload,
  type AgentEvalEvidencePayload,
} from "./agent-eval-evidence.js";
import {
  DEFAULT_AGENT_RESILIENCE_POLICY,
  withAgentResilience,
  type AgentResiliencePolicy,
} from "./resilience.js";

export type EvidenceEvaluationContext = Parameters<
  typeof evaluateAgentEvidenceContract
>[1];

export type LiveEvalMode = "shadow" | "live";

export type LiveAgentEvalCase = {
  id: string;
  agentCode: ActiveAgentCode;
  /** Only adjudicated gold/holdout cases count toward release certification. */
  datasetSplit?: "smoke" | "gold" | "holdout";
  objective: string;
  expectedAbstention: boolean;
  evidenceContext: EvidenceEvaluationContext;
  /** Fixture constraints are checked against the exact candidate artifact. */
  outputConstraints?: {
    requiredPaths: readonly string[];
    forbiddenPaths: readonly string[];
  };
  /** Immutable scenario material made available to a fixture-backed provider. */
  fixture?: Readonly<Record<string, unknown>>;
};

function readFixtureJsonPath(value: unknown, path: string): { exists: boolean; value?: unknown } {
  if (!/^\$((\.[A-Za-z_][A-Za-z0-9_]*)|(\[\d+\]))+$/.test(path)) return { exists: false };
  const segments = [...path.matchAll(/\.([A-Za-z_][A-Za-z0-9_]*)|\[(\d+)\]/g)];
  let current: unknown = value;
  for (const segment of segments) {
    const key = segment[1] ?? segment[2];
    if (Array.isArray(current) && segment[2] !== undefined) {
      const index = Number(key);
      if (index >= current.length) return { exists: false };
      current = current[index];
    } else if (current && typeof current === "object" && key !== undefined && segment[1] !== undefined
      && Object.prototype.hasOwnProperty.call(current, key)) {
      current = (current as Record<string, unknown>)[key!];
    } else return { exists: false };
  }
  return { exists: true, value: current };
}

export type LiveAgentEvalInvocation = {
  output: unknown;
  latencyMs: number;
  costUsd: number;
  traceId: string | null;
  /** Values observed from the completed agent run, never copied from the request. */
  executedAgentCode?: ActiveAgentCode;
  executedAgentVersionId?: string;
  executedCandidateFingerprint?: string;
  /** Required for release runs: the judge result over this exact output. */
  candidateJudgment?: AgentJudgeResult;
  candidateJudgedOutputSha256?: string;
};

export type LiveEvalCandidate = {
  agentVersionId: string;
  agentCode: ActiveAgentCode;
  candidateFingerprint: string;
};

export type LiveAgentEvalProvider = (
  testCase: LiveAgentEvalCase,
  signal?: AbortSignal,
  candidate?: LiveEvalCandidate,
) => Promise<LiveAgentEvalInvocation>;

/** Minimum per-agent release suite; smoke cases never count toward these totals. */
export const LIVE_EVAL_RELEASE_REQUIREMENTS = {
  goldCasesPerAgent: 10,
  holdoutCasesPerAgent: 3,
} as const;

/** Baseline missing-data case for every agent in the catalog. */
export function buildDefaultLiveEvalCases(): LiveAgentEvalCase[] {
  return ACTIVE_AGENT_CODES.map((agentCode) => ({
    id: `${agentCode}:missing-data-abstention`,
    agentCode,
    datasetSplit: "smoke",
    objective:
      "Responde usando solo evidencia disponible y declara los datos que faltan.",
    expectedAbstention: true,
    evidenceContext: {
      organizationId: "live-eval-org",
      availableSources: [],
    },
  }));
}

export type LiveAgentEvalResult = {
  caseId: string;
  agentCode: ActiveAgentCode;
  datasetSplit: LiveAgentEvalCase["datasetSplit"] | null;
  mode: LiveEvalMode;
  passed: boolean;
  failures: string[];
  latencyMs: number;
  costUsd: number;
  traceId: string | null;
  executedAgentCode: ActiveAgentCode | null;
  executedAgentVersionId: string | null;
  executedCandidateFingerprint: string | null;
  candidateJudgeStatus: AgentJudgeResult["status"] | null;
  candidateJudgeScore: number | null;
  candidateJudgeRubricVersion: string | null;
  candidateJudgedOutputSha256: string | null;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function hashLiveAgentEvalOutput(output: unknown): string {
  return createHash("sha256").update(canonicalJson(output)).digest("hex");
}

/** Maps provider-backed results to the durable AI-26 evidence contract. */
export function buildLiveAgentEvalEvidencePayload({
  agentVersionId,
  datasetVersion,
  mode,
  results,
}: {
  agentVersionId: string;
  datasetVersion: string;
  mode: LiveEvalMode;
  results: readonly LiveAgentEvalResult[];
}): AgentEvalEvidencePayload {
  if (results.length === 0) throw new Error("live_eval_results_required");
  const passed = results.filter((result) => result.passed).length;
  // El registro guarda un resultado por agente: una suite de release trae 13+
  // casos del MISMO agente, y mapearlos uno a uno tropezaba con
  // agent_eval_duplicate, así que ninguna evaluación live podía persistirse.
  const byAgent = new Map<LiveAgentEvalResult["agentCode"], { passed: boolean; checks: number; failed: string[] }>();
  for (const result of results) {
    const entry = byAgent.get(result.agentCode) ?? { passed: true, checks: 0, failed: [] };
    entry.passed &&= result.passed;
    entry.checks += 1;
    entry.failed.push(...result.failures.map((failure) => results.length > 1 ? `${result.caseId}:${failure}` : failure));
    byAgent.set(result.agentCode, entry);
  }
  return buildAgentEvalEvidencePayload({
    agentVersionId,
    datasetVersion,
    evaluationMode: mode,
    results: [...byAgent].map(([agentCode, entry]) => ({ agentCode, ...entry })),
    overallScore: passed / results.length,
    evidence: {
      mode,
      cases: results.map((result) => ({
        case_id: result.caseId,
        agent_code: result.agentCode,
        dataset_split: result.datasetSplit,
        latency_ms: result.latencyMs,
        cost_usd: result.costUsd,
        trace_id: result.traceId,
        executed_agent_code: result.executedAgentCode,
        executed_agent_version_id: result.executedAgentVersionId ?? null,
        executed_candidate_fingerprint: result.executedCandidateFingerprint ?? null,
        candidate_judge_status: result.candidateJudgeStatus,
        candidate_judge_score: result.candidateJudgeScore,
        candidate_judge_rubric_version: result.candidateJudgeRubricVersion,
        candidate_judged_output_sha256: result.candidateJudgedOutputSha256,
      })),
    },
  });
}

/** Runs provider-backed cases with bounded I/O concurrency and per-case faults. */
export async function runLiveAgentEvalSuite(
  cases: readonly LiveAgentEvalCase[],
  mode: LiveEvalMode,
  provider: LiveAgentEvalProvider,
  maxConcurrency = 2,
  options: {
    maxConsecutiveProviderFailures?: number;
    policy?: AgentResiliencePolicy;
    candidate?: LiveEvalCandidate;
  } = {},
): Promise<LiveAgentEvalResult[]> {
  if (!Number.isInteger(maxConcurrency) || maxConcurrency < 1) {
    throw new Error("live_eval_concurrency_invalid");
  }
  const results: LiveAgentEvalResult[] = new Array(cases.length);
  let nextIndex = 0;
  let consecutiveProviderFailures = 0;
  const failureThreshold = options.maxConsecutiveProviderFailures ?? 3;
  if (!Number.isInteger(failureThreshold) || failureThreshold < 1) {
    throw new Error("live_eval_circuit_threshold_invalid");
  }
  async function worker() {
    while (true) {
      const index = nextIndex++;
      const testCase = cases[index];
      if (!testCase) return;
      if (consecutiveProviderFailures >= failureThreshold) {
        results[index] = {
          caseId: testCase.id,
          agentCode: testCase.agentCode,
          datasetSplit: testCase.datasetSplit ?? null,
          mode,
          passed: false,
          failures: ["circuit_open"],
          latencyMs: 0,
          costUsd: 0,
          traceId: null,
          executedAgentCode: null,
          executedAgentVersionId: null,
          executedCandidateFingerprint: null,
          candidateJudgeStatus: null,
          candidateJudgeScore: null,
          candidateJudgeRubricVersion: null,
          candidateJudgedOutputSha256: null,
        };
        continue;
      }
      try {
        const result = await runLiveAgentEvalCase(
          testCase,
          mode,
          provider,
          options.policy,
          options.candidate,
        );
        results[index] = result;
        if (result.failures.some((failure) => failure.startsWith("provider_error:"))) {
          consecutiveProviderFailures += 1;
        } else {
          consecutiveProviderFailures = 0;
        }
      } catch (error) {
        consecutiveProviderFailures += 1;
        results[index] = {
          caseId: testCase.id,
          agentCode: testCase.agentCode,
          datasetSplit: testCase.datasetSplit ?? null,
          mode,
          passed: false,
          failures: [
            error instanceof Error ? `provider_error:${error.message}` : "provider_error",
          ],
          latencyMs: 0,
          costUsd: 0,
          traceId: null,
          executedAgentCode: null,
          executedAgentVersionId: null,
          executedCandidateFingerprint: null,
          candidateJudgeStatus: null,
          candidateJudgeScore: null,
          candidateJudgeRubricVersion: null,
          candidateJudgedOutputSha256: null,
        };
      }
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(maxConcurrency, cases.length) }, worker),
  );
  return results;
}

export async function runLiveAgentEvalCase(
  testCase: LiveAgentEvalCase,
  mode: LiveEvalMode,
  provider?: LiveAgentEvalProvider,
  policy: AgentResiliencePolicy = DEFAULT_AGENT_RESILIENCE_POLICY,
  candidate?: LiveEvalCandidate,
): Promise<LiveAgentEvalResult> {
  if (!provider) throw new Error("live_eval_provider_required");
  const invocation = await withAgentResilience(
    (signal) => provider(testCase, signal, candidate),
    policy,
  );
  const failures: string[] = [];
  const evidenceOutput = testCase.agentCode === "a19_arquitecto_camino"
    && invocation.output && typeof invocation.output === "object"
    ? {
        answer: typeof (invocation.output as Record<string, unknown>).diagnosis === "string"
          ? (invocation.output as Record<string, unknown>).diagnosis
          : "",
        sources: (invocation.output as Record<string, unknown>).sources,
        confidence: (invocation.output as Record<string, unknown>).confidence,
        warnings: (invocation.output as Record<string, unknown>).warnings,
      }
    : invocation.output;
  const evidence = testCase.agentCode === "a19_revision_camino"
    ? {
        ok: Boolean(invocation.output && typeof invocation.output === "object"
          && typeof (invocation.output as Record<string, unknown>).executive_summary === "string"
          && (invocation.output as Record<string, unknown>).goal_progress
          && typeof (invocation.output as Record<string, unknown>).goal_progress === "object"),
      }
    : evaluateAgentEvidenceContract(evidenceOutput, testCase.evidenceContext);
  if (!evidence.ok) failures.push("evidence_contract");

  const output = invocation.output as Record<string, unknown> | null;
  const warnings = Array.isArray(output?.warnings) ? output.warnings : [];
  const abstained =
    typeof output?.confidence === "string" &&
    output.confidence === "low" &&
    warnings.length > 0;
  if (testCase.expectedAbstention !== abstained) {
    failures.push("abstention_expectation");
  }
  if (testCase.outputConstraints) {
    for (const path of testCase.outputConstraints.requiredPaths) {
      if (!readFixtureJsonPath(invocation.output, path).exists) failures.push(`required_output_path_missing:${path}`);
    }
    for (const path of testCase.outputConstraints.forbiddenPaths) {
      if (readFixtureJsonPath(invocation.output, path).exists) failures.push(`forbidden_output_path_present:${path}`);
    }
  }
  if (!Number.isFinite(invocation.latencyMs) || invocation.latencyMs < 0) {
    failures.push("latency_invalid");
  }
  if (!Number.isFinite(invocation.costUsd) || invocation.costUsd < 0) {
    failures.push("cost_invalid");
  }
  if (candidate) {
    if (invocation.executedAgentCode !== candidate.agentCode) {
      failures.push("candidate_agent_code_mismatch");
    }
    if (invocation.executedAgentVersionId !== candidate.agentVersionId) {
      failures.push("candidate_version_mismatch");
    }
    if (invocation.executedCandidateFingerprint !== candidate.candidateFingerprint) {
      failures.push("candidate_fingerprint_mismatch");
    }
    if (mode === "live") {
      const judged = agentJudgeResultSchema.safeParse(invocation.candidateJudgment);
      if (!judged.success) {
        failures.push("candidate_judgment_missing_or_invalid");
      } else {
        if (judged.data.rubric_version !== JUDGE_RUBRIC_VERSION) failures.push("candidate_judgment_rubric_mismatch");
        try {
          const recomputed = finalizeAgentJudgeResult(testCase.agentCode, {
            summary: judged.data.summary,
            criteria: judged.data.criteria,
          }, () => true);
          if (recomputed.status !== "passed" || judged.data.status !== recomputed.status
            || judged.data.overall_score !== recomputed.overall_score) {
            failures.push("candidate_judgment_not_passed");
          }
        } catch {
          failures.push("candidate_judgment_rubric_mismatch");
        }
        if (invocation.candidateJudgedOutputSha256 !== hashLiveAgentEvalOutput(invocation.output)) {
          failures.push("candidate_judgment_output_mismatch");
        }
      }
    }
  }

  return {
    caseId: testCase.id,
    agentCode: testCase.agentCode,
    datasetSplit: testCase.datasetSplit ?? null,
    mode,
    passed: failures.length === 0,
    failures,
    latencyMs: invocation.latencyMs,
    costUsd: invocation.costUsd,
    traceId: invocation.traceId,
    executedAgentCode: invocation.executedAgentCode ?? null,
    executedAgentVersionId: invocation.executedAgentVersionId ?? null,
    executedCandidateFingerprint: invocation.executedCandidateFingerprint ?? null,
    candidateJudgeStatus: invocation.candidateJudgment?.status ?? null,
    candidateJudgeScore: invocation.candidateJudgment?.overall_score ?? null,
    candidateJudgeRubricVersion: invocation.candidateJudgment?.rubric_version ?? null,
    candidateJudgedOutputSha256: invocation.candidateJudgedOutputSha256 ?? null,
  };
}
