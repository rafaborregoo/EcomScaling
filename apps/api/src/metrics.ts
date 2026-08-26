import { createMetricsRegistry } from "@ecomscaling/observability";

/** Process-local API metrics; shared aggregation remains an explicit deployment gate. */
export const apiMetrics = createMetricsRegistry({ maxSeries: 5_000 });
