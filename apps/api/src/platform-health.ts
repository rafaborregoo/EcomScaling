import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { LoadedApiEnv } from "@e-nora/config";
import { evaluateHttpSlo, redactSensitiveText } from "@e-nora/observability";
import { recordAuditLog } from "./audit-log.js";
import type { AuthContext } from "./auth-context.js";
import { apiMetrics, getRecentApiHttpSlo } from "./metrics.js";
import { SHOPIFY_SYNC_MAX_PENDING, SHOPIFY_SYNC_QUEUE_NAME } from "./shopify-sync-queue.js";

const WINDOW_HOURS = 24;
const MAX_RECENT_ROWS = 1_000;
const NODE_EXPORTER_TIMEOUT_MS = 2_500;
const NODE_EXPORTER_URL =
  process.env.NODE_EXPORTER_URL ?? "http://node-exporter:9100/metrics";
const CADVISOR_URL = process.env.CADVISOR_URL ?? "http://cadvisor:8080/metrics";
const DOCKER_API_URL = process.env.DOCKER_API_URL ?? "http://docker-proxy:2375";
const ACTIVE_USERS_KEY = "ecomscaling:platform:active-users";
const ACTIVE_USERS_HOURLY_PEAK_KEY = "ecomscaling:platform:active-users:hourly-peaks";
const ACTIVE_USERS_DAILY_PEAK_KEY = "ecomscaling:platform:active-users:daily-peaks";
const EXTERNAL_PROBE_KEY = "ecomscaling:platform:external-probe";
const EXTERNAL_PROBE_HISTORY_KEY = "ecomscaling:platform:external-probe:history";
const ACTIVE_USER_WINDOW_MS = 60_000;
let activeUsersRedis: Redis | null = null;

export type ExternalProbeInput = {
  ok: boolean;
  checked_at: string;
  latency_ms: number | null;
  dns_ok: boolean;
  tls_days_remaining: number | null;
  http_status: number | null;
};

export async function recordExternalProbe(env: LoadedApiEnv, probe: ExternalProbeInput) {
  if (!env.REDIS_URL) return false;
  try {
    activeUsersRedis ??= new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: NODE_EXPORTER_TIMEOUT_MS,
      enableOfflineQueue: false,
    });
    const payload = JSON.stringify(probe);
    const now = Date.now();
    await activeUsersRedis.set(EXTERNAL_PROBE_KEY, payload, "EX", 172_800);
    await activeUsersRedis.zadd(EXTERNAL_PROBE_HISTORY_KEY, now, `${now}:${payload}`);
    await activeUsersRedis.zremrangebyscore(EXTERNAL_PROBE_HISTORY_KEY, 0, now - 86_400_000);
    await activeUsersRedis.expire(EXTERNAL_PROBE_HISTORY_KEY, 172_800);
    return true;
  } catch {
    return false;
  }
}

async function readExternalProbe(env: LoadedApiEnv) {
  if (!env.REDIS_URL) return { status: "not_configured" as const, latest: null, history: [] };
  try {
    activeUsersRedis ??= new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: NODE_EXPORTER_TIMEOUT_MS,
      enableOfflineQueue: false,
    });
    const [latest, history] = await Promise.all([
      activeUsersRedis.get(EXTERNAL_PROBE_KEY),
      activeUsersRedis.zrevrange(EXTERNAL_PROBE_HISTORY_KEY, 0, 287),
    ]);
    return {
      status: latest ? "ok" as const : "waiting" as const,
      latest: latest ? JSON.parse(latest) as ExternalProbeInput : null,
      history: history.reverse().map((row) => JSON.parse(row.slice(row.indexOf(":") + 1)) as ExternalProbeInput),
    };
  } catch {
    return { status: "error" as const, latest: null, history: [] };
  }
}

type PromSample = {
  name: string;
  labels: Record<string, string>;
  value: number;
};
type CpuSample = { at: number; idle: number; total: number };

let previousCpu: CpuSample | null = null;
let lastObservedBootTime: number | null = null;
let hostBootChangesObserved = 0;
const priorContainerCpu = new Map<string, { at: number; cpu: number }>();

function createServiceClient(env: LoadedApiEnv) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { transport: WebSocket as any },
  });
}

function parsePrometheusText(text: string): PromSample[] {
  const samples: PromSample[] = [];
  const linePattern =
    /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|NaN|\+Inf|-Inf)(?:\s+\d+)?$/;
  const labelPattern = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"])*)"/g;

  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const match = linePattern.exec(line);
    if (!match) continue;
    const labels: Record<string, string> = {};
    for (const label of match[2]?.matchAll(labelPattern) ?? []) {
      labels[label[1]!] = label[2]!
        .replaceAll("\\n", "\n")
        .replaceAll('\\"', '"')
        .replaceAll("\\\\", "\\");
    }
    const value = Number(match[3]);
    if (Number.isFinite(value))
      samples.push({ name: match[1]!, labels, value });
  }
  return samples;
}

function metric(
  samples: PromSample[],
  name: string,
  predicate: (labels: Record<string, string>) => boolean = () => true,
) {
  return (
    samples.find((sample) => sample.name === name && predicate(sample.labels))
      ?.value ?? null
  );
}

function currentCpuPercent(samples: PromSample[], at: number) {
  const cpuRows = samples.filter(
    (sample) => sample.name === "node_cpu_seconds_total",
  );
  if (cpuRows.length === 0) return null;
  const idle = cpuRows
    .filter(
      (sample) =>
        sample.labels.mode === "idle" || sample.labels.mode === "iowait",
    )
    .reduce((sum, sample) => sum + sample.value, 0);
  const total = cpuRows.reduce((sum, sample) => sum + sample.value, 0);
  const prior = previousCpu;
  previousCpu = { at, idle, total };
  if (!prior || total <= prior.total || at <= prior.at) return null;
  const elapsed = total - prior.total;
  const idleElapsed = Math.max(0, idle - prior.idle);
  return Math.max(0, Math.min(100, ((elapsed - idleElapsed) / elapsed) * 100));
}

async function readHostMetrics() {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(NODE_EXPORTER_URL, {
      signal: AbortSignal.timeout(NODE_EXPORTER_TIMEOUT_MS),
      headers: { Accept: "text/plain; version=0.0.4" },
    });
    if (!response.ok) throw new Error(`node_exporter_http_${response.status}`);
    const samples = parsePrometheusText(await response.text());
    const memoryTotal = metric(samples, "node_memory_MemTotal_bytes");
    const memoryAvailable = metric(samples, "node_memory_MemAvailable_bytes");
    const swapTotal = metric(samples, "node_memory_SwapTotal_bytes");
    const swapFree = metric(samples, "node_memory_SwapFree_bytes");
    const diskSize = metric(
      samples,
      "node_filesystem_size_bytes",
      (labels) => labels.mountpoint === "/",
    );
    const diskAvailable = metric(
      samples,
      "node_filesystem_avail_bytes",
      (labels) => labels.mountpoint === "/",
    );
    const bootTime = metric(samples, "node_boot_time_seconds");
    if (bootTime != null && bootTime !== lastObservedBootTime) {
      if (lastObservedBootTime != null) hostBootChangesObserved += 1;
      lastObservedBootTime = bootTime;
    }
    const load1 = metric(samples, "node_load1");
    const cpuCount = new Set(
      samples
        .filter(
          (sample) =>
            sample.name === "node_cpu_seconds_total" &&
            sample.labels.mode === "idle",
        )
        .map((sample) => sample.labels.cpu),
    ).size;
    const memoryUsedPercent =
      memoryTotal == null || memoryAvailable == null || memoryTotal <= 0
        ? null
        : ((memoryTotal - memoryAvailable) / memoryTotal) * 100;
    const diskUsedPercent =
      diskSize == null || diskAvailable == null || diskSize <= 0
        ? null
        : ((diskSize - diskAvailable) / diskSize) * 100;
    const swapUsed =
      swapTotal == null || swapFree == null
        ? null
        : Math.max(0, swapTotal - swapFree);
    const cpuPercent = currentCpuPercent(samples, Date.now());

    return {
      status: "ok" as const,
      checked_at: checkedAt,
      cpu_percent: cpuPercent,
      cpu_cores: cpuCount || null,
      load_1m: load1,
      memory_total_bytes: memoryTotal,
      memory_available_bytes: memoryAvailable,
      memory_used_percent: memoryUsedPercent,
      swap_total_bytes: swapTotal,
      swap_used_bytes: swapUsed,
      disk_total_bytes: diskSize,
      disk_available_bytes: diskAvailable,
      disk_used_percent: diskUsedPercent,
      boot_time:
        bootTime == null ? null : new Date(bootTime * 1_000).toISOString(),
      uptime_seconds:
        bootTime == null ? null : Math.max(0, Date.now() / 1_000 - bootTime),
      boot_changes_observed_since_api_start: hostBootChangesObserved,
    };
  } catch (error) {
    return {
      status: "unknown" as const,
      checked_at: checkedAt,
      reason: redactSensitiveText(
        error instanceof Error ? error.message : String(error),
      ),
      cpu_percent: null,
      cpu_cores: null,
      load_1m: null,
      memory_total_bytes: null,
      memory_available_bytes: null,
      memory_used_percent: null,
      swap_total_bytes: null,
      swap_used_bytes: null,
      disk_total_bytes: null,
      disk_available_bytes: null,
      disk_used_percent: null,
      boot_time: null,
      uptime_seconds: null,
      boot_changes_observed_since_api_start: hostBootChangesObserved,
    };
  }
}

async function readWorkerQueues(env: LoadedApiEnv) {
  if (!env.REDIS_URL) {
    return {
      status: "unknown" as const,
      heartbeat_at: null,
      heartbeat_age_seconds: null,
      queues: [],
      reason: "Redis no está configurado.",
    };
  }
  let defaultQueue: Queue | null = null;
  let shopifyQueue: Queue | null = null;
  try {
    const redisUrl = new URL(env.REDIS_URL);
    const connection = {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      maxRetriesPerRequest: 1,
      connectTimeout: NODE_EXPORTER_TIMEOUT_MS,
      ...(redisUrl.username
        ? { username: decodeURIComponent(redisUrl.username) }
        : {}),
      ...(redisUrl.password
        ? { password: decodeURIComponent(redisUrl.password) }
        : {}),
      ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
    };
    defaultQueue = new Queue("ecomscaling-default", { connection });
    shopifyQueue = new Queue(SHOPIFY_SYNC_QUEUE_NAME, { connection });
    const [
      redis,
      defaultCounts,
      oldestDefaultWaitingJobs,
      oldestDefaultDelayedJobs,
      shopifyCounts,
      oldestShopifyWaitingJobs,
      oldestShopifyPrioritizedJobs,
      oldestShopifyDelayedJobs,
      shopifyGlobalConcurrency,
      shopifyGlobalRateLimit,
    ] = await Promise.all([
      defaultQueue.client,
      defaultQueue.getJobCounts(
        "waiting",
        "active",
        "failed",
        "delayed",
        "waiting-children",
      ),
      defaultQueue.getJobs(["waiting"], 0, 0),
      defaultQueue.getJobs(["delayed"], 0, 0),
      shopifyQueue.getJobCounts(
        "waiting",
        "prioritized",
        "active",
        "failed",
        "delayed",
        "waiting-children",
      ),
      shopifyQueue.getJobs(["waiting"], 0, 0),
      shopifyQueue.getJobs(["prioritized"], 0, 0),
      shopifyQueue.getJobs(["delayed"], 0, 0),
      shopifyQueue.getGlobalConcurrency(),
      shopifyQueue.getGlobalRateLimit(),
    ]);
    const heartbeat = await redis.get("ecomscaling:worker:heartbeat");
    const activeUsersCutoff = Date.now() - ACTIVE_USER_WINDOW_MS;
    await (redis as unknown as Redis).zremrangebyscore(
      ACTIVE_USERS_KEY,
      0,
      activeUsersCutoff,
    );
    const activeUsers = await redis.zcard(ACTIVE_USERS_KEY);
    const [hourlyPeaks, dailyPeaks] = await Promise.all([
      redis.hgetall(ACTIVE_USERS_HOURLY_PEAK_KEY),
      redis.hgetall(ACTIVE_USERS_DAILY_PEAK_KEY),
    ]);
    const heartbeatAt =
      heartbeat && Number.isFinite(Date.parse(heartbeat)) ? heartbeat : null;
    const ageSeconds = heartbeatAt
      ? Math.max(0, (Date.now() - Date.parse(heartbeatAt)) / 1_000)
      : null;
    return {
      status:
        ageSeconds == null
          ? ("unknown" as const)
          : ageSeconds <= 45
            ? ("ok" as const)
            : ("stale" as const),
      heartbeat_at: heartbeatAt,
      heartbeat_age_seconds: ageSeconds,
      active_users_60s: activeUsers,
      active_users_hourly_peaks: Object.entries(hourlyPeaks)
        .map(([bucket, peak]) => ({ bucket, peak: Number(peak) }))
        .sort((left, right) => left.bucket.localeCompare(right.bucket))
        .slice(-24),
      active_users_daily_peaks: Object.entries(dailyPeaks)
        .map(([bucket, peak]) => ({ bucket, peak: Number(peak) }))
        .sort((left, right) => left.bucket.localeCompare(right.bucket))
        .slice(-30),
      queues: [
        {
          name: "ecomscaling-default",
          ...defaultCounts,
          oldest_pending_age_seconds: [
            ...oldestDefaultWaitingJobs,
            ...oldestDefaultDelayedJobs,
          ].length
            ? Math.max(
                0,
                (Date.now() - Math.min(...[
                  ...oldestDefaultWaitingJobs,
                  ...oldestDefaultDelayedJobs,
                ].map((job) => job.timestamp))) / 1_000,
              )
            : 0,
        },
        {
          name: SHOPIFY_SYNC_QUEUE_NAME,
          ...shopifyCounts,
          oldest_pending_age_seconds: [
            ...oldestShopifyWaitingJobs,
            ...oldestShopifyPrioritizedJobs,
            ...oldestShopifyDelayedJobs,
          ].length
            ? Math.max(
                0,
                (Date.now() - Math.min(...[
                  ...oldestShopifyWaitingJobs,
                  ...oldestShopifyPrioritizedJobs,
                  ...oldestShopifyDelayedJobs,
                ].map((job) => job.timestamp))) / 1_000,
              )
            : 0,
          global_concurrency: shopifyGlobalConcurrency,
          global_rate_limit: shopifyGlobalRateLimit,
          pending_limit: SHOPIFY_SYNC_MAX_PENDING,
        },
      ],
      reason: heartbeatAt ? null : "El worker aún no ha publicado heartbeat.",
    };
  } catch (error) {
    return {
      status: "error" as const,
      heartbeat_at: null,
      heartbeat_age_seconds: null,
      active_users_60s: null,
      queues: [],
      reason: cleanError(
        error instanceof Error ? error.message : String(error),
      ),
    };
  } finally {
    await Promise.all([
      defaultQueue?.close().catch(() => undefined),
      shopifyQueue?.close().catch(() => undefined),
    ]);
  }
}

async function readContainerMetrics() {
  const checkedAt = new Date().toISOString();
  try {
    const [metricsResponse, containersResponse] = await Promise.all([
      fetch(CADVISOR_URL, { signal: AbortSignal.timeout(NODE_EXPORTER_TIMEOUT_MS) }),
      fetch(`${DOCKER_API_URL}/containers/json?all=1`, {
        signal: AbortSignal.timeout(NODE_EXPORTER_TIMEOUT_MS),
      }),
    ]);
    if (!metricsResponse.ok || !containersResponse.ok)
      throw new Error("container_metrics_unavailable");
    const samples = parsePrometheusText(await metricsResponse.text());
    const dockerContainers = (await containersResponse.json()) as Array<{
      Id: string;
      Names?: string[];
      State?: string;
      Status?: string;
      RestartCount?: number;
      Labels?: Record<string, string>;
    }>;
    const now = Date.now();
    const containers = (await Promise.all(dockerContainers
      .filter((container) => container.Labels?.["com.docker.compose.service"])
      .map(async (container) => {
        const service = container.Labels!["com.docker.compose.service"]!;
        const id = container.Id;
        const detailResponse = await fetch(
          `${DOCKER_API_URL}/containers/${encodeURIComponent(id)}/json`,
          { signal: AbortSignal.timeout(NODE_EXPORTER_TIMEOUT_MS) },
        ).catch(() => null);
        const details = detailResponse?.ok
          ? (await detailResponse.json()) as {
              RestartCount?: number;
              State?: { OOMKilled?: boolean; Health?: { Status?: string } };
            }
          : null;
        const matches = (labels: Record<string, string>) => {
          const metricId = labels.id ?? "";
          return metricId.includes(id.slice(0, 12)) || metricId.includes(id);
        };
        const memory = metric(
          samples,
          "container_memory_working_set_bytes",
          matches,
        );
        const memoryLimit = metric(samples, "container_spec_memory_limit_bytes", matches);
        const cpuTotal = metric(
          samples,
          "container_cpu_usage_seconds_total",
          matches,
        );
        const previous = priorContainerCpu.get(id);
        priorContainerCpu.set(id, { at: now, cpu: cpuTotal ?? 0 });
        const cpuPercent =
          cpuTotal == null || !previous || now <= previous.at
            ? null
            : Math.max(0, ((cpuTotal - previous.cpu) * 100_000) / (now - previous.at));
        const oomEvents = metric(samples, "container_oom_events_total", matches);
        const image = container.Labels?.["com.docker.compose.image"] ?? null;
        const name = container.Names?.[0]?.replace(/^\//, "") ?? service;
        return {
          id: id.slice(0, 12),
          name,
          service,
          image,
          state: container.State ?? "unknown",
          status: container.Status ?? "unknown",
          restart_count: details?.RestartCount ?? container.RestartCount ?? null,
          health: details?.State?.Health?.Status ?? null,
          cpu_percent: cpuPercent,
          memory_working_set_bytes: memory,
          memory_limit_bytes: memoryLimit,
          memory_used_percent:
            memory == null || memoryLimit == null || memoryLimit <= 0
              ? null
              : (memory / memoryLimit) * 100,
          oom_events: Math.max(oomEvents ?? 0, details?.State?.OOMKilled ? 1 : 0),
        };
      })))
      .sort((left, right) => left.service.localeCompare(right.service));
    return { status: "ok" as const, checked_at: checkedAt, containers };
  } catch (error) {
    return {
      status: "unknown" as const,
      checked_at: checkedAt,
      reason: cleanError(error instanceof Error ? error.message : error),
      containers: [],
    };
  }
}

async function readDatabaseRecovery(env: LoadedApiEnv) {
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();
  let database: { status: "ok" | "error" | "unknown"; latency_ms: number | null } = {
    status: "unknown",
    latency_ms: null,
  };
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const response = await fetch(
        `${env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/organizations?select=id&limit=0`,
        {
          method: "HEAD",
          headers: {
            apikey: env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          },
          signal: AbortSignal.timeout(NODE_EXPORTER_TIMEOUT_MS),
        },
      );
      database = {
        status: response.ok ? "ok" : "error",
        latency_ms: Date.now() - startedAt,
      };
    } catch {
      database = { status: "error", latency_ms: Date.now() - startedAt };
    }
  }

  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = new URL(env.SUPABASE_URL).hostname.split(".")[0] ?? "";
  let connections: { active: number | null; max: number | null; status: "available" | "not_configured" | "error" } = {
    active: null,
    max: null,
    status: token ? "error" : "not_configured",
  };
  if (token) {
    try {
      const queryResponse = await fetch(
        `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/query`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
          body: JSON.stringify({
            query: "select count(*) filter (where state = 'active')::int as active_connections, current_setting('max_connections')::int as max_connections from pg_stat_activity",
            read_only: true,
          }),
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!queryResponse.ok) throw new Error(`database_query_http_${queryResponse.status}`);
      const result = await queryResponse.json() as Array<{ active_connections?: number; max_connections?: number }> | { result?: Array<{ active_connections?: number; max_connections?: number }> };
      const row = Array.isArray(result) ? result[0] : result.result?.[0];
      connections = {
        active: typeof row?.active_connections === "number" ? row.active_connections : null,
        max: typeof row?.max_connections === "number" ? row.max_connections : null,
        status: row ? "available" : "error",
      };
    } catch {
      connections = { active: null, max: null, status: "error" };
    }
  }
  let backups: {
    status: "available" | "error" | "not_configured";
    latest_backup_at: string | null;
    pitr_enabled: boolean | null;
    latest_physical_backup_at: string | null;
    reason?: string;
  } = {
    status: "not_configured",
    latest_backup_at: null,
    pitr_enabled: null,
    latest_physical_backup_at: null,
  };
  if (token) {
    try {
      const response = await fetch(
        `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/database/backups`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!response.ok) throw new Error(`management_api_http_${response.status}`);
      const body = (await response.json()) as {
        pitr_enabled?: boolean;
        backups?: Array<{ status?: string; inserted_at?: string; is_physical_backup?: boolean }>;
        physical_backup_data?: { latest_physical_backup_date_unix?: number };
      };
      const latest = (body.backups ?? [])
        .filter((backup) => backup.status === "COMPLETED" && backup.inserted_at)
        .sort((left, right) =>
          String(right.inserted_at).localeCompare(String(left.inserted_at)),
        )[0];
      const physicalSeconds = body.physical_backup_data?.latest_physical_backup_date_unix;
      backups = {
        status: "available",
        latest_backup_at: latest?.inserted_at ?? null,
        pitr_enabled: body.pitr_enabled ?? null,
        latest_physical_backup_at:
          physicalSeconds && physicalSeconds > 0
            ? new Date(physicalSeconds * 1_000).toISOString()
            : null,
      };
    } catch (error) {
      backups = {
        status: "error",
        latest_backup_at: null,
        pitr_enabled: null,
        latest_physical_backup_at: null,
        reason: cleanError(error instanceof Error ? error.message : error),
      };
    }
  }
  const restoreVerifiedAt = process.env.SUPABASE_LAST_RESTORE_VERIFIED_AT ?? null;
  return {
    checked_at: checkedAt,
    database,
    connections,
    backups,
    last_restore_verified_at:
      restoreVerifiedAt && Number.isFinite(Date.parse(restoreVerifiedAt))
        ? new Date(restoreVerifiedAt).toISOString()
        : null,
  };
}

export async function recordPlatformUserHeartbeat(
  env: LoadedApiEnv,
  context: AuthContext,
) {
  if (!env.REDIS_URL) {
    return {
      ok: false as const,
      statusCode: 503,
      error: "presence_store_unavailable",
      message: "No se pudo actualizar la presencia de usuario.",
    };
  }
  try {
    activeUsersRedis ??= new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: NODE_EXPORTER_TIMEOUT_MS,
      enableOfflineQueue: false,
    });
    const now = Date.now();
    await activeUsersRedis.zadd(ACTIVE_USERS_KEY, now, context.user.id);
    await activeUsersRedis.zremrangebyscore(
      ACTIVE_USERS_KEY,
      0,
      now - ACTIVE_USER_WINDOW_MS,
    );
    await activeUsersRedis.expire(ACTIVE_USERS_KEY, 120);
    const activeUsers = await activeUsersRedis.zcard(ACTIVE_USERS_KEY);
    const hour = new Date(now).toISOString().slice(0, 13);
    const day = new Date(now).toISOString().slice(0, 10);
    const updatePeaks = `
      local current = tonumber(ARGV[1])
      for index = 1, 2 do
        local previous = tonumber(redis.call('HGET', KEYS[index], ARGV[index + 1]) or '0')
        if current > previous then redis.call('HSET', KEYS[index], ARGV[index + 1], current) end
        redis.call('EXPIRE', KEYS[index], 3024000)
      end
      return 1
    `;
    await activeUsersRedis.eval(
      updatePeaks,
      2,
      ACTIVE_USERS_HOURLY_PEAK_KEY,
      ACTIVE_USERS_DAILY_PEAK_KEY,
      activeUsers,
      hour,
      day,
    );
    return { ok: true as const };
  } catch {
    return {
      ok: false as const,
      statusCode: 503,
      error: "presence_store_unavailable",
      message: "No se pudo actualizar la presencia de usuario.",
    };
  }
}

function requirePlatformAdmin(context: AuthContext) {
  if (context.profile.platform_role !== "platform_admin") {
    return {
      ok: false as const,
      statusCode: 403,
      error: "platform_admin_required",
      message:
        "Solo un platform admin puede consultar la salud de la plataforma.",
    };
  }
  return { ok: true as const };
}

function cleanError(value: unknown) {
  const text = redactSensitiveText(String(value ?? ""));
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}

/** Sends one notification when the active alert set changes. Configure a Slack/Discord-compatible webhook. */
export async function monitorPlatformHealth(env: LoadedApiEnv) {
  const webhook = process.env.PLATFORM_ALERT_WEBHOOK_URL;
  if (!webhook || !env.REDIS_URL) return;
  const [host, worker, containers, databaseRecovery] = await Promise.all([
    readHostMetrics(),
    readWorkerQueues(env),
    readContainerMetrics(),
    readDatabaseRecovery(env),
  ]);
  const slo = getRecentApiHttpSlo();
  const alerts: Array<{ severity: "warning" | "critical"; key: string; message: string }> = [];
  if (host.status === "unknown") alerts.push({ severity: "warning", key: "host_metrics_unavailable", message: "Node Exporter no disponible." });
  if (host.cpu_percent != null && host.cpu_percent >= 90) alerts.push({ severity: "critical", key: "cpu_pressure", message: `CPU al ${host.cpu_percent.toFixed(0)} %.` });
  if (host.memory_used_percent != null && host.memory_used_percent >= 90) alerts.push({ severity: "critical", key: "memory_pressure", message: `Memoria al ${host.memory_used_percent.toFixed(0)} %.` });
  if (host.disk_used_percent != null && host.disk_used_percent >= 85) alerts.push({ severity: "critical", key: "disk_pressure", message: `Disco al ${host.disk_used_percent.toFixed(0)} %.` });
  if (worker.status === "stale" || worker.status === "error") alerts.push({ severity: "critical", key: "worker_unavailable", message: `Worker ${worker.status}: ${worker.reason ?? "heartbeat vencido"}.` });
  if (slo.status === "critical" || slo.status === "degraded") alerts.push({ severity: slo.status === "critical" ? "critical" : "warning", key: "api_slo_degraded", message: `API p95 ${Math.round(slo.p95LatencyMs ?? 0)} ms; ${slo.errorCount}/${slo.requestCount} errores.` });
  if (databaseRecovery.database.status === "error") alerts.push({ severity: "critical", key: "database_unavailable", message: "La comprobación de Supabase ha fallado." });
  if (databaseRecovery.connections.active != null && databaseRecovery.connections.max != null && databaseRecovery.connections.active / databaseRecovery.connections.max >= 0.8) alerts.push({ severity: "warning", key: "database_connection_pressure", message: `Conexiones Supabase: ${databaseRecovery.connections.active}/${databaseRecovery.connections.max}.` });
  if (databaseRecovery.backups.status === "available" && databaseRecovery.backups.latest_backup_at && Date.now() - Date.parse(databaseRecovery.backups.latest_backup_at) > 36 * 60 * 60 * 1_000) alerts.push({ severity: "critical", key: "database_backup_stale", message: "El último backup completado tiene más de 36 horas." });
  if (containers.status === "unknown") alerts.push({ severity: "warning", key: "container_metrics_unavailable", message: "cAdvisor o Docker API proxy no disponibles." });
  for (const container of containers.containers) {
    if (container.state !== "running" || container.health === "unhealthy") alerts.push({ severity: "critical", key: `container_${container.service}`, message: `${container.service}: ${container.status}${container.health ? ` · health ${container.health}` : ""}.` });
    if ((container.oom_events ?? 0) > 0) alerts.push({ severity: "critical", key: `oom_${container.service}`, message: `${container.service} informa OOM.` });
    if (container.cpu_percent != null && container.cpu_percent >= 90) alerts.push({ severity: "warning", key: `container_cpu_${container.service}`, message: `${container.service} supera el 90 % de un núcleo.` });
    if (container.memory_used_percent != null && container.memory_used_percent >= 90) alerts.push({ severity: "critical", key: `container_memory_${container.service}`, message: `${container.service} supera el 90 % de su límite de memoria.` });
  }
  const signature = JSON.stringify(alerts.map(({ severity, key }) => ({ severity, key })).sort((a, b) => a.key.localeCompare(b.key)));
  let redis: Redis | null = null;
  try {
    redis = activeUsersRedis ?? new Redis(env.REDIS_URL, { maxRetriesPerRequest: 1, connectTimeout: NODE_EXPORTER_TIMEOUT_MS, enableOfflineQueue: false });
    activeUsersRedis = redis;
    const previous = await redis.get("ecomscaling:platform:alert-signature");
    if (previous === signature) return;
    await redis.set("ecomscaling:platform:alert-signature", signature);
    if (previous == null && alerts.length === 0) return;
    const text = alerts.length
      ? `E-NORA · ${alerts.length} alerta(s) activas\n${alerts.map((alert) => `${alert.severity.toUpperCase()}: ${alert.message}`).join("\n")}`
      : "E-NORA · Todas las alertas de plataforma se han resuelto.";
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`alert_webhook_http_${response.status}`);
  } catch (error) {
    // Keep the scheduler alive; logs contain only a redacted error and never the webhook URL.
    console.warn("platform_alert_delivery_failed", cleanError(error instanceof Error ? error.message : error));
    if (redis) await redis.del("ecomscaling:platform:alert-signature").catch(() => undefined);
  }
}

/** Platform-admin operational snapshot; no tenant/user identifiers are emitted as metric labels. */
export async function getPlatformHealth(
  env: LoadedApiEnv,
  context: AuthContext,
) {
  const access = requirePlatformAdmin(context);
  if (!access.ok) return access;

  const since = new Date(
    Date.now() - WINDOW_HOURS * 60 * 60 * 1_000,
  ).toISOString();
  const supabase = createServiceClient(env);
  const [
    host,
    workerQueues,
    syncResult,
    agentResult,
    auditResult,
    auditCountResult,
    feedbackResult,
  ] = await Promise.all([
    readHostMetrics(),
    readWorkerQueues(env),
    supabase
      .from("integration_sync_runs")
      .select(
        "id, organization_id, provider, status, created_at, error_code, error_message",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(MAX_RECENT_ROWS),
    supabase
      .from("agent_runs")
      .select(
        "id, organization_id, status, latency_ms, started_at, error_message",
      )
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .limit(MAX_RECENT_ROWS),
    supabase
      .from("audit_logs")
      .select("id, action, entity_type, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("platform_health_feedback")
      .select(
        "id, organization_id, category, satisfaction, message, status, created_at",
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  const syncRows = syncResult.data ?? [];
  const agentRows = agentResult.data ?? [];
  const organizationIds = [
    ...new Set(
      [
        ...syncRows.map((row) => row.organization_id as string | null),
        ...agentRows.map((row) => row.organization_id as string | null),
        ...(feedbackResult.data ?? []).map(
          (row) => row.organization_id as string | null,
        ),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const organizationsResult = organizationIds.length
    ? await supabase
        .from("organizations")
        .select("id, display_name")
        .in("id", organizationIds)
    : { data: [], error: null };
  const orgNames = new Map(
    (organizationsResult.data ?? []).map((organization) => [
      organization.id as string,
      organization.display_name as string,
    ]),
  );

  const byOrganization = new Map<
    string,
    {
      organization_id: string;
      organization_name: string;
      sync_runs: number;
      sync_failures: number;
      agent_runs: number;
      agent_failures: number;
      agent_latencies: number[];
      last_issue_at: string | null;
      recent_issues: Array<{ service: string; summary: string; at: string }>;
    }
  >();
  const rowFor = (organizationId: string) => {
    let row = byOrganization.get(organizationId);
    if (!row) {
      row = {
        organization_id: organizationId,
        organization_name: orgNames.get(organizationId) ?? "Organización",
        sync_runs: 0,
        sync_failures: 0,
        agent_runs: 0,
        agent_failures: 0,
        agent_latencies: [],
        last_issue_at: null,
        recent_issues: [],
      };
      byOrganization.set(organizationId, row);
    }
    return row;
  };

  for (const run of syncRows) {
    if (!run.organization_id) continue;
    const organization = rowFor(run.organization_id as string);
    organization.sync_runs += 1;
    if (run.status === "failed" || run.status === "error") {
      organization.sync_failures += 1;
      const at = run.created_at as string;
      organization.last_issue_at =
        !organization.last_issue_at || at > organization.last_issue_at
          ? at
          : organization.last_issue_at;
      organization.recent_issues.push({
        service: String(run.provider ?? "sync"),
        summary: cleanError(
          run.error_message ?? run.error_code ?? "Fallo de sincronización",
        ),
        at,
      });
    }
  }
  for (const run of agentRows) {
    if (!run.organization_id) continue;
    const organization = rowFor(run.organization_id as string);
    organization.agent_runs += 1;
    if (typeof run.latency_ms === "number" && Number.isFinite(run.latency_ms)) {
      organization.agent_latencies.push(run.latency_ms);
    }
    if (run.status === "failed" || run.status === "error") {
      organization.agent_failures += 1;
      const at = run.started_at as string;
      organization.last_issue_at =
        !organization.last_issue_at || at > organization.last_issue_at
          ? at
          : organization.last_issue_at;
      organization.recent_issues.push({
        service: "IA",
        summary: cleanError(run.error_message ?? "Fallo de agente"),
        at,
      });
    }
  }
  const affectedOrganizations = [...byOrganization.values()]
    .filter((row) => row.sync_failures > 0 || row.agent_failures > 0)
    .map((row) => ({
      ...row,
      avg_agent_latency_ms: row.agent_latencies.length
        ? row.agent_latencies.reduce((sum, value) => sum + value, 0) /
          row.agent_latencies.length
        : null,
      p95_agent_latency_ms: row.agent_latencies.length
        ? [...row.agent_latencies].sort((left, right) => left - right)[
            Math.max(0, Math.ceil(row.agent_latencies.length * 0.95) - 1)
          ]!
        : null,
      agent_latencies: undefined,
      recent_issues: row.recent_issues
        .sort((left, right) => right.at.localeCompare(left.at))
        .slice(0, 4),
    }))
    .sort(
      (left, right) =>
        right.sync_failures +
          right.agent_failures -
          (left.sync_failures + left.agent_failures) ||
        (right.last_issue_at ?? "").localeCompare(left.last_issue_at ?? ""),
    )
    .slice(0, 50);

  const [containers, databaseRecovery, externalProbe] = await Promise.all([
    readContainerMetrics(),
    readDatabaseRecovery(env),
    readExternalProbe(env),
  ]);
  const slo = evaluateHttpSlo(apiMetrics.snapshot());
  const recentSlo = getRecentApiHttpSlo();
  const hostAlerts: Array<{
    severity: "warning" | "critical";
    key: string;
    message: string;
  }> = [];
  if (host.status === "unknown") {
    hostAlerts.push({
      severity: "warning",
      key: "host_metrics_unavailable",
      message: "No llegan métricas del servidor.",
    });
  } else {
    if (
      host.memory_available_bytes != null &&
      host.memory_total_bytes &&
      host.memory_available_bytes / host.memory_total_bytes < 0.15
    ) {
      hostAlerts.push({
        severity: "critical",
        key: "memory_pressure",
        message: "Memoria disponible por debajo del 15 %.",
      });
    }
    if (host.disk_used_percent != null && host.disk_used_percent >= 85) {
      hostAlerts.push({
        severity: "critical",
        key: "disk_pressure",
        message: "Disco raíz por encima del 85 %.",
      });
    }
    if (host.cpu_percent != null && host.cpu_percent >= 90) {
      hostAlerts.push({
        severity: "warning",
        key: "cpu_pressure",
        message: "CPU por encima del 90 % en la última muestra.",
      });
    }
  }
  if (recentSlo.status === "degraded" || recentSlo.status === "critical") {
    hostAlerts.push({
      severity: recentSlo.status === "critical" ? "critical" : "warning",
      key: "api_slo_degraded",
      message: `SLO API (5 min): ${recentSlo.errorCount} errores de ${recentSlo.requestCount} peticiones; p95 ${recentSlo.p95LatencyMs ?? "n/d"} ms.`,
    });
  }
  if (workerQueues.status === "stale" || workerQueues.status === "error") {
    hostAlerts.push({
      severity: "critical",
      key: "worker_unavailable",
      message:
        workerQueues.status === "stale"
          ? "No llega heartbeat reciente del worker."
          : "No se pudo consultar el estado del worker y sus colas.",
    });
  }
  if (containers.status === "unknown") {
    hostAlerts.push({
      severity: "warning",
      key: "container_metrics_unavailable",
      message: "No se pueden consultar recursos y estado de los contenedores.",
    });
  } else {
    for (const container of containers.containers) {
      if (container.state !== "running") {
        hostAlerts.push({
          severity: "critical",
          key: `container_down_${container.service}`,
          message: `El contenedor ${container.service} no está en ejecución (${container.status}).`,
        });
      }
      if ((container.restart_count ?? 0) >= 3) {
        hostAlerts.push({
          severity: "warning",
          key: `container_restarts_${container.service}`,
          message: `${container.service} se ha reiniciado ${container.restart_count} veces.`,
        });
      }
      if ((container.oom_events ?? 0) > 0) {
        hostAlerts.push({
          severity: "critical",
          key: `container_oom_${container.service}`,
          message: `${container.service} registra eventos de falta de memoria.`,
        });
      }
      if (container.cpu_percent != null && container.cpu_percent >= 90) {
        hostAlerts.push({ severity: "warning", key: `container_cpu_${container.service}`, message: `${container.service} supera el 90 % de un núcleo.` });
      }
      if (container.memory_used_percent != null && container.memory_used_percent >= 90) {
        hostAlerts.push({ severity: "critical", key: `container_memory_${container.service}`, message: `${container.service} supera el 90 % de su límite de memoria.` });
      }
    }
  }
  if (databaseRecovery.database.status === "error") {
    hostAlerts.push({
      severity: "critical",
      key: "database_unavailable",
      message: "La comprobación de conexión a Supabase ha fallado.",
    });
  }
  if (
    databaseRecovery.backups.status === "available" &&
    databaseRecovery.backups.latest_backup_at &&
    Date.now() - Date.parse(databaseRecovery.backups.latest_backup_at) > 36 * 60 * 60 * 1_000
  ) {
    hostAlerts.push({
      severity: "critical",
      key: "database_backup_stale",
      message: "El último backup completado tiene más de 36 horas.",
    });
  }
  if (externalProbe.latest && !externalProbe.latest.ok) {
    hostAlerts.push({ severity: "critical", key: "external_availability", message: "La sonda externa no pudo completar el health check público." });
  }
  if (externalProbe.latest && Date.now() - Date.parse(externalProbe.latest.checked_at) > 10 * 60_000) {
    hostAlerts.push({ severity: "warning", key: "external_probe_stale", message: "La sonda externa no ha informado en más de 10 minutos." });
  }
  if (externalProbe.latest?.tls_days_remaining != null && externalProbe.latest.tls_days_remaining >= 0 && externalProbe.latest.tls_days_remaining <= 14) {
    hostAlerts.push({ severity: externalProbe.latest.tls_days_remaining <= 3 ? "critical" : "warning", key: "tls_certificate_expiring", message: `El certificado TLS caduca en ${externalProbe.latest.tls_days_remaining} días.` });
  }
  if (
    recentSlo.authenticationFailures >= 30 ||
    recentSlo.authorizationDenials >= 50
  ) {
    hostAlerts.push({
      severity: "warning",
      key: "api_access_failures_spike",
      message: `Pico de rechazos API en 5 min: ${recentSlo.authenticationFailures} respuestas 401 y ${recentSlo.authorizationDenials} respuestas 403.`,
    });
  }
  const affectedCount = affectedOrganizations.length;
  if (affectedCount > 0) {
    const failedSyncs = affectedOrganizations.reduce(
      (sum, org) => sum + org.sync_failures,
      0,
    );
    const failedAgents = affectedOrganizations.reduce(
      (sum, org) => sum + org.agent_failures,
      0,
    );
    hostAlerts.push({
      severity: failedSyncs + failedAgents >= 10 ? "critical" : "warning",
      key: "customer_failures_detected",
      message: `${affectedCount} organizaciones con errores recientes: ${failedSyncs} sincronizaciones y ${failedAgents} ejecuciones de IA fallidas en 24 h.`,
    });
  }

  return {
    ok: true as const,
    generated_at: new Date().toISOString(),
    window_hours: WINDOW_HOURS,
    host,
    containers,
    database_recovery: databaseRecovery,
    external_probe: externalProbe,
    application: {
      slo,
      recent_slo: recentSlo,
      worker: workerQueues,
      readiness: {
        status: "available_at_health_ready_endpoint" as const,
        url: "/health/ready",
      },
      latency_by_route: recentSlo.latency_by_route,
      requests_per_minute: recentSlo.requests_per_minute,
      container_status: "read_only_docker_api_and_cadvisor" as const,
    },
    customers: {
      sync_run_count: syncRows.length,
      sync_query_complete:
        !syncResult.error && syncRows.length < MAX_RECENT_ROWS,
      agent_run_count: agentRows.length,
      agent_query_complete:
        !agentResult.error && agentRows.length < MAX_RECENT_ROWS,
      affected_organizations: affectedOrganizations,
    },
    security: {
      status:
        auditResult.error || auditCountResult.error
          ? ("partial" as const)
          : ("audit_available" as const),
      audit_events_24h: auditCountResult.count ?? 0,
      api_authentication_failures_5m: recentSlo.authenticationFailures,
      api_authorization_denials_5m: recentSlo.authorizationDenials,
      recent_admin_actions: (auditResult.data ?? [])
        .slice(0, 20)
        .map((event) => ({
          action: event.action,
          entity_type: event.entity_type,
          at: event.created_at,
        })),
      coverage_gaps: [
        "Los logins exitosos/fallidos de Supabase Auth deben conectarse desde el proveedor; aquí sí se cuentan respuestas API 401/403.",
        "Eventos SSH/fail2ban y vulnerabilidades de imágenes/paquetes aún no llegan al panel.",
        ...(process.env.PLATFORM_ALERT_WEBHOOK_URL ? [] : ["Configura PLATFORM_ALERT_WEBHOOK_URL para recibir notificaciones automáticas."]),
        ...(process.env.PLATFORM_MONITOR_TOKEN ? [] : ["Configura la sonda externa de GitHub Actions con PLATFORM_MONITOR_TOKEN."]),
        ...(databaseRecovery.backups.status === "available" ? [] : ["Configura SUPABASE_ACCESS_TOKEN con permisos database_read y backups_read para conexiones y backups."]),
        ...(databaseRecovery.last_restore_verified_at ? [] : ["Registra SUPABASE_LAST_RESTORE_VERIFIED_AT después de probar una restauración real."]),
      ],
    },
    feedback: {
      available: !feedbackResult.error,
      open_count: feedbackResult.data?.length ?? 0,
      reports: (feedbackResult.data ?? []).map((report) => ({
        id: report.id,
        organization_name:
          orgNames.get(report.organization_id as string) ?? "Organización",
        category: report.category,
        satisfaction: report.satisfaction,
        message: cleanError(report.message),
        created_at: report.created_at,
      })),
    },
    alerts: hostAlerts,
    data_quality: {
      sync_query_error: syncResult.error
        ? cleanError(syncResult.error.message)
        : null,
      agent_query_error: agentResult.error
        ? cleanError(agentResult.error.message)
        : null,
      organization_query_error: organizationsResult.error
        ? cleanError(organizationsResult.error.message)
        : null,
      audit_query_error: auditResult.error
        ? cleanError(auditResult.error.message)
        : null,
      audit_count_query_error: auditCountResult.error
        ? cleanError(auditCountResult.error.message)
        : null,
      feedback_query_error: feedbackResult.error
        ? cleanError(feedbackResult.error.message)
        : null,
      metrics_are_process_local: true,
    },
  };
}

export type PlatformHealthFeedbackInput = {
  organizationId: string;
  category: "bug" | "slow" | "sync" | "other";
  satisfaction: number | null;
  message: string;
  pagePath: string | null;
  requestId: string | null;
};

export async function submitPlatformHealthFeedback(
  env: LoadedApiEnv,
  context: AuthContext,
  input: PlatformHealthFeedbackInput,
) {
  const organizationAllowed = context.memberships.some(
    (membership) => membership.organization_id === input.organizationId,
  );
  if (!organizationAllowed) {
    return {
      ok: false as const,
      statusCode: 403,
      error: "organization_access_required",
      message: "No tienes acceso a esta organización.",
    };
  }

  const supabase = createServiceClient(env);
  const { error } = await supabase.from("platform_health_feedback").insert({
    organization_id: input.organizationId,
    reporter_user_id: context.user.id,
    category: input.category,
    satisfaction: input.satisfaction,
    message: redactSensitiveText(input.message.trim()),
    page_path: input.pagePath,
    request_id: input.requestId,
  });
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "feedback_submission_failed",
      message: "No se pudo enviar el informe.",
    };
  }
  return { ok: true as const, data: { received: true } };
}

export async function updatePlatformHealthFeedbackStatus(
  env: LoadedApiEnv,
  context: AuthContext,
  feedbackId: string,
  status: "open" | "triaged" | "resolved",
) {
  const access = requirePlatformAdmin(context);
  if (!access.ok) return access;
  const supabase = createServiceClient(env);
  const { data, error } = await supabase
    .from("platform_health_feedback")
    .update({ status })
    .eq("id", feedbackId)
    .select("id, organization_id, status")
    .maybeSingle();
  if (error) {
    return {
      ok: false as const,
      statusCode: 500,
      error: "feedback_status_update_failed",
      message: "No se pudo actualizar el informe.",
    };
  }
  if (!data) {
    return {
      ok: false as const,
      statusCode: 404,
      error: "feedback_not_found",
      message: "No se encontró el informe.",
    };
  }
  await recordAuditLog(supabase, {
    organizationId: data.organization_id as string,
    actorUserId: context.user.id,
    action: "platform_health_feedback.update_status",
    entityType: "platform_health_feedback",
    entityId: data.id as string,
    newData: { status },
  });
  return { ok: true as const, data: { id: data.id, status: data.status } };
}
