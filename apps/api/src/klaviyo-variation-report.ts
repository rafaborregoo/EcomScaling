export type KlaviyoVariationMetric = {
  account_id: string;
  campaign_id: string;
  campaign_message_id: string | null;
  variation_id: string;
  variation_name: string;
  period_start: string;
  period_end: string;
  statistics: unknown;
  total_count?: number;
};

export type KlaviyoVariationInventoryRow = {
  account_id: string;
  external_message_id: string | null;
  parent_name: string | null;
};

const ALLOWED_METRICS = [
  "recipients",
  "delivered",
  "opens_unique",
  "clicks_unique",
  "conversion_uniques",
  "conversion_value",
  "unsubscribes",
  "bounced",
  "spam_complaints",
] as const;

function numericStatistics(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const safe: Record<string, number> = {};
  for (const key of ALLOWED_METRICS) {
    const metric = source[key];
    const parsed = typeof metric === "number" ? metric : typeof metric === "string" && metric.trim() ? Number(metric) : Number.NaN;
    if (Number.isFinite(parsed) && parsed >= 0 && (key === "conversion_value" || Number.isInteger(parsed))) safe[key] = parsed;
  }
  return safe;
}

function messageKey(accountId: string, messageId: string) {
  return `${accountId}\u0000${messageId}`;
}

/** Join stable Klaviyo A/B metrics to the exact account/message in inventory.
 * Never attach a parent campaign's metrics to another account's reused ID. */
export function buildKlaviyoVariationContext(
  inventory: readonly KlaviyoVariationInventoryRow[],
  metrics: readonly KlaviyoVariationMetric[],
  maxRows = 40,
) {
  const byMessage = new Map<string, KlaviyoVariationInventoryRow>();
  for (const row of inventory) {
    if (row.external_message_id) {
      byMessage.set(messageKey(row.account_id, row.external_message_id), row);
    }
  }

  const latestByVariant = new Map<string, {
    metric: KlaviyoVariationMetric;
    inventory: KlaviyoVariationInventoryRow;
  }>();
  let unmatchedCount = 0;
  let reportedTotalCount = metrics.length;
  for (const metric of metrics) {
    if (typeof metric.total_count === "number" && Number.isFinite(metric.total_count)) {
      reportedTotalCount = Math.max(reportedTotalCount, metric.total_count);
    }
    if (!metric.campaign_message_id || !metric.variation_id) continue;
    const email = byMessage.get(messageKey(metric.account_id, metric.campaign_message_id));
    if (!email) {
      unmatchedCount++;
      continue;
    }
    const key = messageKey(metric.account_id, metric.campaign_message_id) + `\u0000${metric.variation_id}`;
    const previous = latestByVariant.get(key);
    if (!previous || metric.period_end > previous.metric.period_end) {
      latestByVariant.set(key, { metric, inventory: email });
    }
  }

  const rows = [...latestByVariant.values()]
    .sort((a, b) => b.metric.period_end.localeCompare(a.metric.period_end))
    .slice(0, Math.max(0, Math.floor(maxRows)))
    .map(({ metric, inventory: email }) => ({
      account_id: metric.account_id,
      campaign_id: metric.campaign_id,
      campaign_name: email.parent_name,
      external_message_id: metric.campaign_message_id,
      variation_id: metric.variation_id,
      variation_name: metric.variation_name,
      period_start: metric.period_start,
      period_end: metric.period_end,
      statistics: Object.fromEntries(Object.entries(numericStatistics(metric.statistics)).filter(([key]) => key !== "conversion_value")),
      monetary_metrics_withheld: true,
      comparison_status: [...latestByVariant.values()].some(({ metric: other }) =>
        other.account_id === metric.account_id && other.campaign_message_id === metric.campaign_message_id &&
        (other.period_start !== metric.period_start || other.period_end !== metric.period_end))
        ? "incompatible_periods" : "descriptive_only_experiment_design_unverified",
      currency_status: "unverified",
      attribution_definition: "provider_reported_not_verified",
      experiment_arm_mapping: "unverified_content_variation_is_not_experiment_assignment",
      interpretation_limits: [
        "Métricas agregadas reportadas por Klaviyo para la variante; no identifican el HTML personalizado recibido por cada destinatario.",
        "Una diferencia observada entre variantes no demuestra causalidad si el reparto, ventana, audiencia u otras condiciones no fueron controladas.",
      ],
    }));

  return {
    rows,
    matchedVariantCount: latestByVariant.size,
    unmatchedCount,
    omittedCount: Math.max(0, latestByVariant.size - rows.length),
    queryTruncated: reportedTotalCount > metrics.length,
    providerRowsReported: reportedTotalCount,
    providerRowsReturned: metrics.length,
  };
}
