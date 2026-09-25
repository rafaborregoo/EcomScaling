import { createMetricsRegistry } from "@e-nora/observability";

/** Process-local API metrics; shared aggregation remains an explicit deployment gate. */
export const apiMetrics = createMetricsRegistry({ maxSeries: 5_000 });
