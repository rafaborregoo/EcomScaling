import { createMetricsRegistry } from "@ecomscaling/observability";

/**
 * Process-local worker counters. They are deliberately low-cardinality and
 * complement correlated logs until a shared metrics backend is provisioned.
 */
export const workerMetrics = createMetricsRegistry();

export function recordWorkerJobMetric(
  jobName: string,
  status: "started" | "completed" | "failed",
) {
  workerMetrics.increment("worker_jobs_total", {
    job_name: jobName,
    status,
  });
}
