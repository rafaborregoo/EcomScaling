import type { CopilotEvidenceReference } from "@e-nora/contracts";

/** Graph targeting is scored independently from document retrieval. */
export function scoreChartIdentification(
  actual: CopilotEvidenceReference,
  expected: Pick<CopilotEvidenceReference, "source" | "entity" | "metric" | "period" | "connection_id">,
) {
  const checks = {
    source: actual.source === expected.source,
    entity: JSON.stringify(actual.entity) === JSON.stringify(expected.entity),
    metric: actual.metric?.key === expected.metric?.key && actual.metric?.date === expected.metric?.date,
    period: JSON.stringify(actual.period) === JSON.stringify(expected.period),
    store: actual.connection_id === expected.connection_id,
  };
  return { correct: Object.values(checks).every(Boolean), checks };
}

export type AnswerFact = {
  /** A literal phrase or formatted number that must occur in the answer. */
  text: string;
  /** Citation reference from the structured output, such as meta_performance_daily. */
  source: string;
  sourceKind?: "metric" | "table" | "tool" | "document";
};

/** Scores human-labelled answer facts and their structured citations separately. */
export function scoreCopilotAnswer(input: {
  answer: string;
  sources: readonly { reference: string; kind: string }[];
  expectedFacts: readonly AnswerFact[];
  forbiddenClaims?: readonly string[];
}) {
  const normalizedAnswer = input.answer.toLocaleLowerCase("es");
  const factChecks = input.expectedFacts.map((fact) => ({
    fact,
    present: normalizedAnswer.includes(fact.text.toLocaleLowerCase("es")),
    cited: input.sources.some((source) => source.reference === fact.source &&
      (!fact.sourceKind || source.kind === fact.sourceKind)),
  }));
  const unsupportedClaims = (input.forbiddenClaims ?? []).filter((claim) =>
    normalizedAnswer.includes(claim.toLocaleLowerCase("es"))
  );
  return {
    factAccuracy: factChecks.length ? factChecks.filter((check) => check.present).length / factChecks.length : 1,
    citationCoverage: factChecks.length ? factChecks.filter((check) => check.present && check.cited).length / factChecks.length : 1,
    unsupportedClaims,
    factChecks,
  };
}
