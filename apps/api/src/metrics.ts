import { createMetricsRegistry } from "@e-nora/observability";

/** Process-local API metrics; shared aggregation remains an explicit deployment gate. */
export const apiMetrics = createMetricsRegistry({ maxSeries: 5_000 });

const HTTP_WINDOW_MS = 5 * 60 * 1_000;
const HTTP_WINDOW_MAX_SAMPLES = 20_000;
const recentHttpSamples: Array<{
  at: number;
  route: string;
  statusCode: number;
  durationMs: number;
  concurrentRequests: number;
}> = [];
let oldestHttpSample = 0;
let inFlightApiRequests = 0;

/** Track live HTTP work handled by this API process. */
export function beginApiHttpRequest() {
  inFlightApiRequests += 1;
}

export function finishApiHttpRequest() {
  inFlightApiRequests = Math.max(0, inFlightApiRequests - 1);
}

export function recordApiHttpSample(
  statusCode: number,
  durationMs: number,
  route = "unknown",
) {
  if (
    !Number.isInteger(statusCode) ||
    !Number.isFinite(durationMs) ||
    durationMs < 0
  )
    return;
  const now = Date.now();
  recentHttpSamples.push({
    at: now,
    route: route.slice(0, 160),
    statusCode,
    durationMs,
    concurrentRequests: inFlightApiRequests,
  });
  if (recentHttpSamples.length > HTTP_WINDOW_MAX_SAMPLES) {
    const overflow = recentHttpSamples.length - HTTP_WINDOW_MAX_SAMPLES;
    recentHttpSamples.splice(0, overflow);
    oldestHttpSample = Math.max(0, oldestHttpSample - overflow);
  }
  while (
    oldestHttpSample < recentHttpSamples.length &&
    recentHttpSamples[oldestHttpSample]!.at < now - HTTP_WINDOW_MS
  ) {
    oldestHttpSample += 1;
  }
  if (
    oldestHttpSample > 1_000 &&
    oldestHttpSample * 2 > recentHttpSamples.length
  ) {
    recentHttpSamples.splice(0, oldestHttpSample);
    oldestHttpSample = 0;
  }
}

export function getRecentApiHttpSlo() {
  const cutoff = Date.now() - HTTP_WINDOW_MS;
  const samples = recentHttpSamples
    .slice(oldestHttpSample)
    .filter((sample) => sample.at >= cutoff);
  const durations = samples
    .map((sample) => sample.durationMs)
    .sort((left, right) => left - right);
  const requestCount = samples.length;
  const quantile = (values: number[], ratio: number) =>
    values.length
      ? [...values].sort((left, right) => left - right)[
          Math.max(0, Math.ceil(values.length * ratio) - 1)
        ]!
      : null;
  const byRoute = new Map<string, number[]>();
  const traffic = new Map<number, number>();
  for (const sample of samples) {
    const routeSamples = byRoute.get(sample.route) ?? [];
    routeSamples.push(sample.durationMs);
    byRoute.set(sample.route, routeSamples);
    const minute = Math.floor(sample.at / 60_000) * 60_000;
    traffic.set(minute, (traffic.get(minute) ?? 0) + 1);
  }
  const errorCount = samples.filter(
    (sample) => sample.statusCode >= 500,
  ).length;
  const authenticationFailures = samples.filter(
    (sample) => sample.statusCode === 401,
  ).length;
  const authorizationDenials = samples.filter(
    (sample) => sample.statusCode === 403,
  ).length;
  const timeouts = samples.filter(
    (sample) => sample.statusCode === 408 || sample.statusCode === 504,
  ).length;
  const errorRate = requestCount ? errorCount / requestCount : 0;
  const p95LatencyMs = requestCount
    ? durations[Math.max(0, Math.ceil(requestCount * 0.95) - 1)]!
    : null;
  const violations: Array<"error_rate" | "p95_latency"> = [];
  if (errorRate > 0.01) violations.push("error_rate");
  if (p95LatencyMs != null && p95LatencyMs > 1_000)
    violations.push("p95_latency");
  return {
    status:
      requestCount === 0
        ? ("no_traffic" as const)
        : violations.length > 1
          ? ("critical" as const)
          : violations.length
            ? ("degraded" as const)
            : ("ok" as const),
    requestCount,
    errorCount,
    authenticationFailures,
    authorizationDenials,
    timeouts,
    errorRate,
    p95LatencyMs,
    latency_by_route: [...byRoute.entries()]
      .map(([route, values]) => ({
        route,
        requestCount: values.length,
        p50LatencyMs: quantile(values, 0.5),
        p95LatencyMs: quantile(values, 0.95),
        p99LatencyMs: quantile(values, 0.99),
        errorCount: samples.filter(
          (sample) => sample.route === route && sample.statusCode >= 500,
        ).length,
      }))
      .sort((left, right) => right.requestCount - left.requestCount)
      .slice(0, 25),
    requests_per_minute: Array.from({ length: 5 }, (_, index) => {
      const minute = Math.floor(Date.now() / 60_000) * 60_000 - (4 - index) * 60_000;
      return { at: new Date(minute).toISOString(), count: traffic.get(minute) ?? 0 };
    }),
    inFlightRequests: inFlightApiRequests,
    peakConcurrentRequests: samples.reduce(
      (peak, sample) => Math.max(peak, sample.concurrentRequests),
      inFlightApiRequests,
    ),
    windowMs: HTTP_WINDOW_MS,
    sample_limit_reached: requestCount === HTTP_WINDOW_MAX_SAMPLES,
    violations,
  };
}
