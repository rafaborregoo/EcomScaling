import { mapWithConcurrency } from "./async-concurrency.js";

const METRIC_ID = /^[A-Za-z0-9_-]{1,128}$/;
export const A28_MAX_METRIC_VOLUME_QUERIES = 6;
export const A28_METRIC_VOLUME_REFRESH_MS = 24 * 60 * 60 * 1000;
export const A28_METRIC_VOLUME_STALE_MS = 48 * 60 * 60 * 1000;

type Row = Record<string, unknown>;
type MetricAggregateClient = {
  request<T>(pathOrUrl: string, init?: RequestInit): Promise<T>;
};

/** IDs are retained only as backend join keys; never include them in agent context. */
export function extractKlaviyoFlowMetricRefs(response: unknown): string[] {
  const root = row(response);
  const data = row(root?.data) ?? root;
  const attributes = row(data?.attributes) ?? data;
  const definition = row(attributes?.definition);
  if (!definition || !Array.isArray(definition.triggers)) return [];
  const ids = new Set<string>();
  for (const value of definition.triggers.slice(0, 4)) {
    const trigger = row(value);
    if (!trigger || safeType(trigger.type) !== "metric") continue;
    for (const candidate of [trigger.metric_id, trigger.id]) {
      if (typeof candidate === "string" && METRIC_ID.test(candidate))
        ids.add(candidate);
    }
  }
  return [...ids].slice(0, 4);
}

export function readKlaviyoFlowMetricRefs(rawData: unknown): string[] {
  const refs = row(rawData)?.a28_flow_metric_refs;
  if (!Array.isArray(refs)) return [];
  return [
    ...new Set(
      refs.filter(
        (value): value is string =>
          typeof value === "string" && METRIC_ID.test(value),
      ),
    ),
  ].slice(0, 4);
}

export type StoredKlaviyoMetricVolume = {
  metric_id: string;
  event_type: string;
  event_count: number;
  period_start: string;
  period_end: string;
  fetched_at: string;
};

export function readStoredKlaviyoMetricVolumes(
  rawData: unknown,
): StoredKlaviyoMetricVolume[] {
  const values = row(rawData)?.a28_flow_metric_volumes;
  if (!Array.isArray(values)) return [];
  return values.slice(0, 4).flatMap((value) => {
    const item = row(value);
    if (
      !item ||
      typeof item.metric_id !== "string" ||
      !METRIC_ID.test(item.metric_id)
    )
      return [];
    const eventType = safeEventCategory(item.event_type);
    const eventCount = finiteCount(item.event_count);
    const periodStart = isoTimestamp(item.period_start);
    const periodEnd = isoTimestamp(item.period_end);
    const fetchedAt = isoTimestamp(item.fetched_at);
    if (
      !eventType ||
      eventCount === null ||
      !periodStart ||
      !periodEnd ||
      !fetchedAt
    )
      return [];
    return [
      {
        metric_id: item.metric_id,
        event_type: eventType,
        event_count: eventCount,
        period_start: periodStart,
        period_end: periodEnd,
        fetched_at: fetchedAt,
      },
    ];
  });
}

export function readStoredKlaviyoMetricVolumeAttempts(
  rawData: unknown,
): Array<{ metric_id: string; attempted_at: string }> {
  const values = row(rawData)?.a28_flow_metric_volume_attempts;
  if (!Array.isArray(values)) return [];
  return values.slice(0, 4).flatMap((value) => {
    const item = row(value);
    const attemptedAt = isoTimestamp(item?.attempted_at);
    if (
      !item ||
      typeof item.metric_id !== "string" ||
      !METRIC_ID.test(item.metric_id) ||
      !attemptedAt
    )
      return [];
    return [{ metric_id: item.metric_id, attempted_at: attemptedAt }];
  });
}

export function selectKlaviyoMetricIdsForRefresh(
  metricIds: string[],
  cachedAtByMetricId: Map<string, string>,
  attemptedAtByMetricId: Map<string, string>,
  now = Date.now(),
  maxMetrics = A28_MAX_METRIC_VOLUME_QUERIES,
) {
  const refreshBefore = now - A28_METRIC_VOLUME_REFRESH_MS;
  const retryBefore = now - A28_METRIC_VOLUME_REFRESH_MS;
  return [...new Set(metricIds.filter((id) => METRIC_ID.test(id)))]
    .flatMap((metricId) => {
      const attempted = Date.parse(attemptedAtByMetricId.get(metricId) ?? "");
      if (Number.isFinite(attempted) && attempted > retryBefore) return [];
      const cached = Date.parse(cachedAtByMetricId.get(metricId) ?? "");
      return !Number.isFinite(cached) || cached <= refreshBefore
        ? [
            {
              metricId,
              cachedAt: Number.isFinite(cached)
                ? cached
                : Number.NEGATIVE_INFINITY,
            },
          ]
        : [];
    })
    .sort((left, right) => left.cachedAt - right.cachedAt)
    .slice(
      0,
      Math.max(
        1,
        Math.min(A28_MAX_METRIC_VOLUME_QUERIES, Math.trunc(maxMetrics)),
      ),
    )
    .map((value) => value.metricId);
}

export function summarizeStoredKlaviyoMetricVolumes(
  rawData: unknown,
  now = Date.now(),
) {
  const refs = readKlaviyoFlowMetricRefs(rawData);
  const entries = readStoredKlaviyoMetricVolumes(rawData);
  const volumesById = new Map(entries.map((entry) => [entry.metric_id, entry]));
  const freshCount = refs.filter((id) => {
    const entry = volumesById.get(id);
    return Boolean(
      entry && now - Date.parse(entry.fetched_at) <= A28_METRIC_VOLUME_STALE_MS,
    );
  }).length;
  const status =
    refs.length === 0
      ? "unavailable"
      : freshCount === refs.length
        ? "available"
        : freshCount > 0
          ? "partial"
          : "unavailable";
  return {
    status,
    metrics_observed: freshCount,
    metrics_referenced: refs.length,
    volumes: refs.flatMap((id) => {
      const entry = volumesById.get(id);
      if (!entry) return [];
      const age = now - Date.parse(entry.fetched_at);
      return [
        {
          event_type: entry.event_type,
          event_count: entry.event_count,
          period_start: entry.period_start,
          period_end: entry.period_end,
          fetched_at: entry.fetched_at,
          stale: !Number.isFinite(age) || age > A28_METRIC_VOLUME_STALE_MS,
        },
      ];
    }),
  } as const;
}

/** Map merchant-controlled metric labels to fixed labels before they reach an agent. */
export function classifyKlaviyoMetricName(value: unknown): string {
  if (typeof value !== "string") return "unmapped_metric";
  const normalized = value.trim().toLowerCase();
  const categories: Record<string, string> = {
    "placed order": "placed_order",
    "started checkout": "started_checkout",
    "added to cart": "added_to_cart",
    "viewed product": "viewed_product",
    "ordered product": "ordered_product",
    "fulfilled order": "fulfilled_order",
    "cancelled order": "cancelled_order",
    "refunded order": "refunded_order",
    "subscribed to list": "subscribed_to_list",
    "submitted form": "submitted_form",
  };
  return categories[normalized] ?? "unmapped_metric";
}

export async function queryKlaviyoFlowMetricVolumes(
  client: MetricAggregateClient,
  metricIds: string[],
  period: { start: Date; end: Date },
  timezone: string,
  maxMetrics = A28_MAX_METRIC_VOLUME_QUERIES,
) {
  const ids = [...new Set(metricIds.filter((id) => METRIC_ID.test(id)))];
  const limit = Math.max(
    1,
    Math.min(A28_MAX_METRIC_VOLUME_QUERIES, Math.trunc(maxMetrics)),
  );
  const selectedIds = ids.slice(0, limit);
  const zone = validTimezone(timezone);
  const values = await mapWithConcurrency(selectedIds, 2, async (metricId) => {
    try {
      const response = await client.request<unknown>("/metric-aggregates/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            type: "metric-aggregate",
            attributes: {
              measurements: ["count"],
              filter: [
                `greater-or-equal(datetime,${period.start.toISOString()})`,
                `less-than(datetime,${period.end.toISOString()})`,
              ],
              metric_id: metricId,
              interval: "month",
              timezone: zone,
            },
          },
        }),
      });
      const eventCount = sumCountMeasurements(response);
      return eventCount === null
        ? null
        : { metric_id: metricId, event_count: eventCount };
    } catch {
      return null;
    }
  });
  const results = new Map(
    values
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .map((value) => [value.metric_id, value.event_count]),
  );
  const failedCount = selectedIds.length - results.size;
  return {
    status:
      selectedIds.length === 0
        ? ("unavailable" as const)
        : failedCount === 0 && ids.length <= limit
          ? ("available" as const)
          : results.size > 0
            ? ("partial" as const)
            : ("unavailable" as const),
    period_start: period.start.toISOString(),
    period_end: period.end.toISOString(),
    metrics_observed: results.size,
    metrics_requested: selectedIds.length,
    metrics_truncated: ids.length > limit,
    failed_metrics: failedCount,
    results,
  };
}

function sumCountMeasurements(response: unknown): number | null {
  const attributes = row(row(response)?.data)?.attributes;
  const aggregate = row(attributes);
  if (!aggregate) return null;
  if (!Array.isArray(aggregate.data)) return null;
  let total = 0;
  for (const value of aggregate.data) {
    const measurement = row(row(value)?.measurements)?.count;
    const samples = Array.isArray(measurement) ? measurement : [measurement];
    for (const sample of samples) {
      if (typeof sample !== "number" || !Number.isFinite(sample) || sample < 0)
        return null;
      total += sample;
    }
  }
  return Number.isFinite(total) ? Math.trunc(total) : null;
}

function validTimezone(value: string): string {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return value;
  } catch {
    return "UTC";
  }
}

function safeEventCategory(value: unknown): string | null {
  const categories = new Set([
    "placed_order",
    "started_checkout",
    "added_to_cart",
    "viewed_product",
    "ordered_product",
    "fulfilled_order",
    "cancelled_order",
    "refunded_order",
    "subscribed_to_list",
    "submitted_form",
    "unmapped_metric",
  ]);
  return typeof value === "string" && categories.has(value) ? value : null;
}

function finiteCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeType(value: unknown): string | null {
  return typeof value === "string"
    ? value.trim().toLowerCase().replaceAll("_", "-")
    : null;
}

function row(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : null;
}
