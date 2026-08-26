import {
  evaluateAgentEvidenceContract,
} from "./evidence-evals.js";
import { ACTIVE_AGENT_CODES, type ActiveAgentCode } from "./agent-evals.js";
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
  objective: string;
  expectedAbstention: boolean;
  evidenceContext: EvidenceEvaluationContext;
};

export type LiveAgentEvalInvocation = {
  output: unknown;
  latencyMs: number;
  costUsd: number;
  traceId: string | null;
};

export type LiveAgentEvalProvider = (
  testCase: LiveAgentEvalCase,
  signal?: AbortSignal,
) => Promise<LiveAgentEvalInvocation>;

/** Baseline missing-data case for every agent in the catalog. */
export function buildDefaultLiveEvalCases(): LiveAgentEvalCase[] {
  return ACTIVE_AGENT_CODES.map((agentCode) => ({
    id: `${agentCode}:missing-data-abstention`,
    agentCode,
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
  mode: LiveEvalMode;
  passed: boolean;
  failures: string[];
  latencyMs: number;
  costUsd: number;
  traceId: string | null;
};

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
  return buildAgentEvalEvidencePayload({
    agentVersionId,
    datasetVersion,
    evaluationMode: mode,
    results: results.map((result) => ({
      agentCode: result.agentCode,
      passed: result.passed,
      checks: 1,
      failed: result.failures,
    })),
    overallScore: passed / results.length,
    evidence: {
      mode,
      cases: results.map((result) => ({
        case_id: result.caseId,
        agent_code: result.agentCode,
        latency_ms: result.latencyMs,
        cost_usd: result.costUsd,
        trace_id: result.traceId,
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
  options: { maxConsecutiveProviderFailures?: number; policy?: AgentResiliencePolicy } = {},
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
          mode,
          passed: false,
          failures: ["circuit_open"],
          latencyMs: 0,
          costUsd: 0,
          traceId: null,
        };
        continue;
      }
      try {
        const result = await runLiveAgentEvalCase(
          testCase,
          mode,
          provider,
          options.policy,
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
          mode,
          passed: false,
          failures: [
            error instanceof Error ? `provider_error:${error.message}` : "provider_error",
          ],
          latencyMs: 0,
          costUsd: 0,
          traceId: null,
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
): Promise<LiveAgentEvalResult> {
  if (!provider) throw new Error("live_eval_provider_required");
  const invocation = await withAgentResilience(
    (signal) => provider(testCase, signal),
    policy,
  );
  const failures: string[] = [];
  const evidence = evaluateAgentEvidenceContract(
    invocation.output,
    testCase.evidenceContext,
  );
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
  if (!Number.isFinite(invocation.latencyMs) || invocation.latencyMs < 0) {
    failures.push("latency_invalid");
  }
  if (!Number.isFinite(invocation.costUsd) || invocation.costUsd < 0) {
    failures.push("cost_invalid");
  }

  return {
    caseId: testCase.id,
    agentCode: testCase.agentCode,
    mode,
    passed: failures.length === 0,
    failures,
    latencyMs: invocation.latencyMs,
    costUsd: invocation.costUsd,
    traceId: invocation.traceId,
  };
}
