const NET_METRIC_COLUMNS = new Set([
  "net_quantity",
  "net_revenue",
  "net_metrics_source",
]);

/** Detects an unmigrated database without swallowing unrelated write errors. */
export function isMissingShopifyNetMetricsSchema(message: string) {
  const mentionsColumn = [...NET_METRIC_COLUMNS].some((column) => message.includes(column));
  return mentionsColumn && (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("could not find")
  );
}

export function withoutShopifyNetMetrics<T extends Record<string, unknown>>(row: T) {
  const legacyRow = { ...row };
  for (const column of NET_METRIC_COLUMNS) delete legacyRow[column];
  return legacyRow;
}
