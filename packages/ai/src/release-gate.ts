/**
 * AI-06: contrato determinista para impedir activar una version sin evidencia
 * suficiente. El runner de evals produce los datos; esta funcion solo decide
 * de forma reproducible si cumplen el gate, sin usar un LLM como juez.
 */

export type ReleaseGate = {
  minimumOverallScore: number;
  minimumScores: Record<string, number>;
  maximumRates: {
    unauthorizedActionRate: number;
    tenantLeakRate: number;
    approvalBypassRate: number;
    regressionFailureRate: number;
  };
  maximumCostIncrease?: number;
  maximumLatencyIncrease?: number;
  /** Optional coverage gate for a versioned multi-agent release. */
  requiredAgentCodes?: readonly string[];
};

export type ReleaseEvaluation = {
  overallScore: number;
  scores: Record<string, number>;
  rates: {
    unauthorizedActionRate: number;
    tenantLeakRate: number;
    approvalBypassRate: number;
    regressionFailureRate: number;
  };
  costIncrease?: number;
  latencyIncrease?: number;
  criticalFailures?: string[];
  /** Agent codes represented by the evaluation evidence. */
  evaluatedAgentCodes?: readonly string[];
  /** Deterministic failures produced by the agent eval runner. */
  agentEvalFailures?: readonly string[];
};

export type ReleaseGateDecision = {
  allowed: boolean;
  reasons: string[];
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function checkMinimum(
  reasons: string[],
  label: string,
  actual: number | undefined,
  minimum: number,
): void {
  if (!isFiniteNumber(actual)) {
    reasons.push(`${label}:missing`);
  } else if (actual < minimum) {
    reasons.push(`${label}:below_minimum:${actual}<${minimum}`);
  }
}

function checkMaximum(
  reasons: string[],
  label: string,
  actual: number | undefined,
  maximum: number,
): void {
  if (!isFiniteNumber(actual)) {
    reasons.push(`${label}:missing`);
  } else if (actual > maximum) {
    reasons.push(`${label}:above_maximum:${actual}>${maximum}`);
  }
}

/**
 * A version can only be activated when every configured criterion passes.
 * Missing evidence is a failure: an absent metric must never be interpreted
 * as zero or as a successful run.
 */
export function evaluateReleaseGate(
  gate: ReleaseGate,
  evaluation: ReleaseEvaluation,
): ReleaseGateDecision {
  const reasons: string[] = [];

  checkMinimum(
    reasons,
    "overallScore",
    evaluation.overallScore,
    gate.minimumOverallScore,
  );

  for (const [metric, minimum] of Object.entries(gate.minimumScores)) {
    checkMinimum(
      reasons,
      `score.${metric}`,
      evaluation.scores[metric],
      minimum,
    );
  }

  for (const [metric, maximum] of Object.entries(gate.maximumRates)) {
    const rateMetric = metric as keyof ReleaseEvaluation["rates"];
    checkMaximum(
      reasons,
      `rate.${metric}`,
      evaluation.rates[rateMetric],
      maximum,
    );
  }

  if (gate.maximumCostIncrease !== undefined) {
    checkMaximum(
      reasons,
      "costIncrease",
      evaluation.costIncrease,
      gate.maximumCostIncrease,
    );
  }

  if (gate.maximumLatencyIncrease !== undefined) {
    checkMaximum(
      reasons,
      "latencyIncrease",
      evaluation.latencyIncrease,
      gate.maximumLatencyIncrease,
    );
  }

  for (const agentCode of gate.requiredAgentCodes ?? []) {
    if (!evaluation.evaluatedAgentCodes?.includes(agentCode)) {
      reasons.push(`agentEvalCoverage:missing:${agentCode}`);
    }
  }

  for (const failure of evaluation.agentEvalFailures ?? []) {
    reasons.push(`agent_eval_failure:${failure}`);
  }

  for (const failure of evaluation.criticalFailures ?? []) {
    reasons.push(`critical_failure:${failure}`);
  }

  return { allowed: reasons.length === 0, reasons };
}
