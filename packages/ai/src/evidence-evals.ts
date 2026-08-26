/**
 * Deterministic evidence contract used by offline agent evals.
 * It checks provenance/tenant metadata, not whether an LLM sentence is
 * semantically true; semantic quality still needs a provider-backed dataset.
 */
export type EvidenceSourceFixture = {
  reference: string;
  organizationId: string;
};

export type EvidenceEvalResult = {
  ok: boolean;
  groundedness: "verified" | "partially_supported" | "insufficient_evidence";
  failures: string[];
};

export type StructuredEvidenceFact = {
  reference: string;
  organizationId: string;
  field: string;
  value: string | number | boolean | null;
};

export type EvidenceAssertion = {
  reference: string;
  organizationId: string;
  field: string;
  value: string | number | boolean | null;
};

export type EvidenceConsistencyResult = {
  ok: boolean;
  contradictions: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Evaluates the minimum evidence contract shared by every agent output. */
export function evaluateAgentEvidenceContract(
  output: unknown,
  options: {
    organizationId: string;
    availableSources: readonly EvidenceSourceFixture[];
    requireEvidence?: boolean;
  },
): EvidenceEvalResult {
  const failures: string[] = [];
  if (!isRecord(output)) {
    return { ok: false, groundedness: "insufficient_evidence", failures: ["output_not_object"] };
  }

  const answer = typeof output.answer === "string" ? output.answer.trim() : "";
  const confidence = output.confidence;
  const warnings = Array.isArray(output.warnings) ? output.warnings : [];
  const sources = Array.isArray(output.sources) ? output.sources : [];
  const available = new Map(options.availableSources.map((source) => [source.reference, source]));
  const seen = new Set<string>();

  if (!answer) failures.push("answer_empty");
  for (const source of sources) {
    if (!isRecord(source)) {
      failures.push("source_not_object");
      continue;
    }
    const reference = typeof source.reference === "string" ? source.reference.trim() : "";
    if (!reference) {
      failures.push("source_reference_empty");
      continue;
    }
    if (seen.has(reference)) failures.push(`source_duplicate:${reference}`);
    seen.add(reference);
    const fixture = available.get(reference);
    if (!fixture) failures.push(`source_not_available:${reference}`);
    else if (fixture.organizationId !== options.organizationId) {
      failures.push(`source_cross_tenant:${reference}`);
    }
  }

  const requireEvidence = options.requireEvidence ?? true;
  if (requireEvidence && sources.length === 0) {
    const declaresGap = /\b(no hay|sin|falta|insuficiente|missing|insufficient|not enough)\b/i.test(answer);
    if (confidence !== "low" || !declaresGap) {
      failures.push("missing_evidence_not_abstained");
    }
  }
  if (confidence === "high" && sources.length === 0) failures.push("high_confidence_without_sources");
  if (sources.length > 0 && warnings.some((warning) => typeof warning !== "string")) {
    failures.push("warning_not_string");
  }

  const groundedness = sources.length === 0
    ? "insufficient_evidence"
    : failures.some((failure) => failure.startsWith("source_"))
      ? "partially_supported"
      : "verified";
  return { ok: failures.length === 0, groundedness, failures };
}

/**
 * Compares claims emitted by a model/tool with authoritative structured facts.
 * Equality is intentional: callers must normalize currency, dates and enums
 * before this check instead of hiding ambiguity in a fuzzy comparison.
 */
export function evaluateEvidenceConsistency(
  assertions: readonly EvidenceAssertion[],
  facts: readonly StructuredEvidenceFact[],
): EvidenceConsistencyResult {
  const factsByKey = new Map(
    facts.map((fact) => [`${fact.organizationId}:${fact.reference}:${fact.field}`, fact.value]),
  );
  const contradictions: string[] = [];
  for (const assertion of assertions) {
    const key = `${assertion.organizationId}:${assertion.reference}:${assertion.field}`;
    if (!factsByKey.has(key)) {
      contradictions.push(`fact_missing:${assertion.reference}:${assertion.field}`);
      continue;
    }
    if (factsByKey.get(key) !== assertion.value) {
      contradictions.push(`fact_contradiction:${assertion.reference}:${assertion.field}`);
    }
  }
  return { ok: contradictions.length === 0, contradictions };
}
