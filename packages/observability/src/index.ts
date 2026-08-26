export function createLogger(service: string) {
  return {
    info(message: string, meta?: unknown) {
      console.log(
        JSON.stringify({
          level: "info",
          service,
          message,
          meta: redactSensitive(meta),
        }),
      );
    },
    error(message: string, error?: unknown) {
      const serializedError =
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error;

      console.error(
        JSON.stringify({
          level: "error",
          service,
          message,
          error: redactSensitive(serializedError),
        }),
      );
    },
  };
}

const SENSITIVE_LOG_KEY =
  /(authorization|cookie|password|secret|access[_-]?token|refresh[_-]?token|api[_-]?key|private[_-]?key|service[_-]?role)/i;

/** Redacts credential-shaped values embedded in provider/DB error strings. */
export function redactSensitiveText(value: string): string {
  return value
    .replace(/(Bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(
      /([?&](?:access_token|refresh_token|api_key|apikey)=)[^&\s]+/gi,
      "$1[REDACTED]",
    )
    .slice(0, 2_000);
}

/** Redacts credential-shaped keys before metadata reaches stdout/stderr. */
export function redactSensitive(value: unknown): unknown {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item));
  }

  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = SENSITIVE_LOG_KEY.test(key)
      ? "[REDACTED]"
      : redactSensitive(item);
  }
  return result;
}

export type MetricLabels = Record<string, string | number | boolean>;

type MetricSample = {
  name: string;
  labels: MetricLabels;
  value: number;
};

function metricKey(name: string, labels: MetricLabels) {
  return `${name}|${Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(",")}`;
}

function escapeLabel(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\n");
}

/** Small process-local metrics registry for health/debug endpoints and logs. */
export class MetricsRegistry {
  private readonly counters = new Map<string, MetricSample>();
  private droppedSeries = 0;
  private readonly maxSeries: number;

  constructor(options: { maxSeries?: number } = {}) {
    const maxSeries = options.maxSeries ?? 5_000;
    if (!Number.isInteger(maxSeries) || maxSeries < 1) {
      throw new Error("Metric maxSeries must be a positive integer");
    }
    this.maxSeries = maxSeries;
  }

  increment(name: string, labels: MetricLabels = {}, value = 1) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Metric increment must be a finite non-negative number");
    }

    const key = metricKey(name, labels);
    const current = this.counters.get(key);
    if (!current && this.counters.size >= this.maxSeries) {
      // A provider or route must never be able to turn labels into an
      // unbounded in-memory allocation. The drop is observable and can be
      // aggregated by the future shared metrics backend.
      this.droppedSeries += 1;
      return;
    }
    this.counters.set(key, {
      name,
      labels: { ...labels },
      value: (current?.value ?? 0) + value,
    });
  }

  /** Records a cumulative Prometheus histogram without a runtime dependency. */
  observe(
    name: string,
    labels: MetricLabels,
    value: number,
    buckets: readonly number[],
  ) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(
        "Metric observation must be a finite non-negative number",
      );
    }

    const sortedBuckets = [...buckets].sort((left, right) => left - right);
    if (
      sortedBuckets.some(
        (bucket, index) =>
          !Number.isFinite(bucket) ||
          bucket < 0 ||
          (index > 0 && bucket === sortedBuckets[index - 1]),
      )
    ) {
      throw new Error("Metric histogram buckets must be finite and unique");
    }

    for (const bucket of sortedBuckets) {
      if (value <= bucket) {
        this.increment(`${name}_bucket`, { ...labels, le: bucket });
      }
    }
    this.increment(`${name}_bucket`, { ...labels, le: "+Inf" });
    this.increment(`${name}_count`, labels);
    this.increment(`${name}_sum`, labels, value);
  }

  snapshot() {
    const samples = [...this.counters.values()].map((sample) => ({
      name: sample.name,
      labels: { ...sample.labels },
      value: sample.value,
    }));
    if (this.droppedSeries > 0) {
      samples.push({
        name: "observability_metric_series_dropped_total",
        labels: {},
        value: this.droppedSeries,
      });
    }
    return samples;
  }

  toPrometheus() {
    return this.snapshot()
      .map((sample) => {
        const labels = Object.entries(sample.labels)
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => `${key}="${escapeLabel(String(value))}"`)
          .join(",");
        return `${sample.name}${labels ? `{${labels}}` : ""} ${sample.value}`;
      })
      .join("\n");
  }
}

export function createMetricsRegistry(options: { maxSeries?: number } = {}) {
  return new MetricsRegistry(options);
}

export type SloStatus = "ok" | "degraded" | "critical" | "no_traffic";

export type HttpSloReport = {
  status: SloStatus;
  requestCount: number;
  errorCount: number;
  errorRate: number;
  p95LatencyMs: number | null;
  errorRateBudget: number;
  p95LatencyBudgetMs: number;
  violations: Array<"error_rate" | "p95_latency">;
};

/** Evaluates a bounded process-local HTTP SLO snapshot without external APM. */
export function evaluateHttpSlo(
  samples: readonly { name: string; labels: MetricLabels; value: number }[],
  options: { errorRateBudget?: number; p95LatencyBudgetMs?: number } = {},
): HttpSloReport {
  const errorRateBudget = options.errorRateBudget ?? 0.01;
  const p95LatencyBudgetMs = options.p95LatencyBudgetMs ?? 1_000;
  if (
    !Number.isFinite(errorRateBudget) ||
    errorRateBudget < 0 ||
    errorRateBudget > 1 ||
    !Number.isFinite(p95LatencyBudgetMs) ||
    p95LatencyBudgetMs <= 0
  ) {
    throw new Error("Invalid HTTP SLO budget");
  }

  let requestCount = 0;
  let errorCount = 0;
  const buckets = new Map<number, number>();
  let histogramCount = 0;

  for (const sample of samples) {
    if (sample.name === "http_requests_total") {
      const statusCode = Number(sample.labels.status_code ?? sample.labels.status);
      if (!Number.isFinite(statusCode)) continue;
      requestCount += sample.value;
      if (statusCode >= 500) errorCount += sample.value;
      continue;
    }
    if (sample.name === "http_request_duration_ms_count") {
      histogramCount += sample.value;
      continue;
    }
    if (sample.name !== "http_request_duration_ms_bucket") continue;
    const bucket = Number(sample.labels.le);
    if (Number.isFinite(bucket)) {
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + sample.value);
    }
  }

  const effectiveCount = requestCount > 0 ? requestCount : histogramCount;
  if (effectiveCount === 0) {
    return {
      status: "no_traffic",
      requestCount: 0,
      errorCount: 0,
      errorRate: 0,
      p95LatencyMs: null,
      errorRateBudget,
      p95LatencyBudgetMs,
      violations: [],
    };
  }

  const target = effectiveCount * 0.95;
  let cumulative = 0;
  let p95LatencyMs: number | null = null;
  for (const [bucket, value] of [...buckets.entries()].sort(
    ([left], [right]) => left - right,
  )) {
    cumulative += value;
    if (cumulative >= target) {
      p95LatencyMs = bucket;
      break;
    }
  }

  const errorRate = requestCount > 0 ? errorCount / requestCount : 0;
  const violations: HttpSloReport["violations"] = [];
  if (errorRate > errorRateBudget) violations.push("error_rate");
  if (p95LatencyMs !== null && p95LatencyMs > p95LatencyBudgetMs) {
    violations.push("p95_latency");
  }
  const severe =
    errorRate > errorRateBudget * 2 ||
    (p95LatencyMs !== null && p95LatencyMs > p95LatencyBudgetMs * 2);

  return {
    status: violations.length === 0 ? "ok" : severe ? "critical" : "degraded",
    requestCount,
    errorCount,
    errorRate,
    p95LatencyMs,
    errorRateBudget,
    p95LatencyBudgetMs,
    violations,
  };
}
