import type { PlaybookTriState } from "@e-nora/contracts";

export type ShopifyNetMetricsCoverage = {
  lines_with_exact_metrics?: number | null;
  lines_with_estimated_metrics?: number | null;
  lines_without_metrics?: number | null;
} | null | undefined;

/**
 * Missing counters (for example, before the additive migration) and empty
 * periods are unknown. Only a non-empty period with zero uncovered lines is
 * complete enough to support an aggregate line-level economic claim.
 */
export function shopifyNetMetricsComplete(
  coverage: ShopifyNetMetricsCoverage,
): boolean | null {
  const exact = coverage?.lines_with_exact_metrics;
  const estimated = coverage?.lines_with_estimated_metrics;
  const missing = coverage?.lines_without_metrics;
  if (![exact, estimated, missing].every((value) => typeof value === "number")) {
    return null;
  }
  if ((exact ?? 0) + (estimated ?? 0) + (missing ?? 0) === 0) return null;
  return missing === 0;
}

export function shopifyNetMetricsQualityFacts(
  coverage: ShopifyNetMetricsCoverage,
): Record<string, PlaybookTriState> {
  const complete = shopifyNetMetricsComplete(coverage);
  const exact = coverage?.lines_with_exact_metrics;
  const estimated = coverage?.lines_with_estimated_metrics;
  return {
    "shopify.net_line_metrics.complete":
      complete === null ? "UNKNOWN" : complete ? "TRUE" : "FALSE",
    "shopify.net_line_metrics.exact":
      typeof exact === "number" ? (exact > 0 ? "TRUE" : "FALSE") : "UNKNOWN",
    "shopify.net_line_metrics.estimated":
      typeof estimated === "number"
        ? (estimated > 0 ? "TRUE" : "FALSE")
        : "UNKNOWN",
  };
}

export function gateShopifyNetMetricsObservation(
  coverage: ShopifyNetMetricsCoverage,
  observation: PlaybookTriState,
): PlaybookTriState {
  return shopifyNetMetricsComplete(coverage) === true ? observation : "UNKNOWN";
}
