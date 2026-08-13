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

  increment(name: string, labels: MetricLabels = {}, value = 1) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error("Metric increment must be a finite non-negative number");
    }

    const key = metricKey(name, labels);
    const current = this.counters.get(key);
    this.counters.set(key, {
      name,
      labels: { ...labels },
      value: (current?.value ?? 0) + value,
    });
  }

  snapshot() {
    return [...this.counters.values()].map((sample) => ({
      name: sample.name,
      labels: { ...sample.labels },
      value: sample.value,
    }));
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

export function createMetricsRegistry() {
  return new MetricsRegistry();
}
