import { Queue, Worker } from "bullmq";
import {
  describeEnvironmentTargetRisk,
  loadApiEnv,
  loadWorkerEnv,
  shouldBlockOnEnvironmentRisk,
} from "@e-nora/config";
import { runShopifyQueueJob } from "@e-nora/api/shopify-queue-worker";
import type { ShopifyQueueWorkerJob } from "@e-nora/api/shopify-queue-worker";
import {
  SHOPIFY_SYNC_QUEUE_NAME,
} from "@e-nora/api/shopify-sync-queue";
import { createLogger } from "@e-nora/observability";
import {
  SHOPIFY_RECONCILE_CRON,
  SHOPIFY_RECONCILE_TZ,
  FATHOM_WEBHOOK_CRON,
  FATHOM_WEBHOOK_TZ,
  WEBHOOK_RETENTION_CRON,
  WEBHOOK_RETENTION_TZ,
  AI_CONTEXT_RETENTION_CRON,
  AI_CONTEXT_RETENTION_TZ,
  AI_DIAGNOSTICS_TICK_CRON,
  AI_DIAGNOSTICS_TICK_TZ,
  INSTAGRAM_IMAGE_QUEUE_CRON,
  INSTAGRAM_IMAGE_QUEUE_TZ,
  isStaleShopifyReconcileRepeatable,
} from "./repeatable-jobs.js";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";
import { recordWorkerJobMetric, workerMetrics } from "./metrics.js";
import { fetchWorkerWithResilience } from "./worker-http.js";

const env = loadWorkerEnv(process.env);
// Mismo guardarrail que la API: el worker escribe mas que nadie, asi que
// apuntar sin querer a produccion desde local es peor aqui.
const environmentRisk = describeEnvironmentTargetRisk(process.env);
if (environmentRisk) {
  if (shouldBlockOnEnvironmentRisk(process.env)) {
    throw new Error(`entorno_cruzado: ${environmentRisk}`);
  }
  console.warn(`entorno_cruzado: ${environmentRisk}`);
}
const logger = createLogger("worker");

const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  maxRetriesPerRequest: null,
  ...(redisUrl.username
    ? { username: decodeURIComponent(redisUrl.username) }
    : {}),
  ...(redisUrl.password
    ? { password: decodeURIComponent(redisUrl.password) }
    : {}),
  ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
};

async function runShopifyReconcile(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) {
    logger.info(
      "Skipping Shopify reconcile job - INTERNAL_API_SECRET not configured",
      workerJobMeta(context),
    );
    return { status: "skipped" };
  }

  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/shopify/reconcile`,
    {
    method: "POST",
    headers: {
      "x-internal-secret": env.INTERNAL_API_SECRET,
      "x-correlation-id": context.correlation_id,
    },
    },
  );

  if (!response.ok) {
    throw new Error(`shopify_reconcile_trigger_failed_${response.status}`);
  }

  return response.json();
}

async function runFathomWebhookProcessing(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/fathom/process-queued`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok) throw new Error(`fathom_queue_trigger_failed_${response.status}`);
  return response.json();
}

async function runWebhookRetention(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/webhooks/purge-retained`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok) throw new Error(`webhook_retention_trigger_failed_${response.status}`);
  return response.json();
}

async function runAiContextRetention(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/ai/purge-retained-context`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok) throw new Error(`ai_context_retention_trigger_failed_${response.status}`);
  return response.json();
}

async function runAiDiagnosticsTick(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/ai/diagnostics/tick`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok) throw new Error(`ai_diagnostics_tick_trigger_failed_${response.status}`);
  return response.json();
}

async function runInstagramImageQueue(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/instagram/process-image-queue`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok)
    throw new Error(`instagram_image_queue_trigger_failed_${response.status}`);
  return response.json();
}

const queue = new Queue("ecomscaling-default", { connection });
const shopifyQueueControl = new Queue(SHOPIFY_SYNC_QUEUE_NAME, { connection });
await shopifyQueueControl.setGlobalConcurrency(1);
await shopifyQueueControl.setGlobalRateLimit(1, 5_000);
await shopifyQueueControl.add(
  "shopify-webhook-drain",
  { kind: "webhook_drain" },
  {
    repeat: { pattern: "* * * * *", tz: "Europe/Madrid" },
    jobId: "shopify-webhook-drain-repeat",
  },
);
logger.info("Scheduled Shopify webhook drain every minute (shared Shopify queue)");

const staleRepeatables = await queue.getRepeatableJobs();
for (const repeatable of staleRepeatables) {
  if (isStaleShopifyReconcileRepeatable(repeatable, SHOPIFY_RECONCILE_CRON)) {
    await queue.removeRepeatableByKey(repeatable.key);
    logger.info(
      `Removed stale shopify-reconcile repeatable job (${repeatable.key})`,
    );
  }
}

if (env.INTERNAL_API_SECRET) {
  await queue.add(
    "shopify-reconcile",
    {},
    {
      repeat: { pattern: SHOPIFY_RECONCILE_CRON, tz: SHOPIFY_RECONCILE_TZ },
      jobId: "shopify-reconcile-repeat",
    },
  );
  logger.info(
    `Scheduled shopify-reconcile daily at 2am (${SHOPIFY_RECONCILE_TZ})`,
  );
  await queue.add(
    "fathom-webhook-processing",
    {},
    {
      repeat: { pattern: FATHOM_WEBHOOK_CRON, tz: FATHOM_WEBHOOK_TZ },
      jobId: "fathom-webhook-processing-repeat",
    },
  );
  logger.info(`Scheduled fathom-webhook-processing every minute (${FATHOM_WEBHOOK_TZ})`);
  await queue.add(
    "webhook-retention",
    {},
    {
      repeat: { pattern: WEBHOOK_RETENTION_CRON, tz: WEBHOOK_RETENTION_TZ },
      jobId: "webhook-retention-repeat",
    },
  );
  logger.info(`Scheduled webhook-retention daily at 3:30am (${WEBHOOK_RETENTION_TZ})`);
  await queue.add(
    "ai-context-retention",
    {},
    {
      repeat: { pattern: AI_CONTEXT_RETENTION_CRON, tz: AI_CONTEXT_RETENTION_TZ },
      jobId: "ai-context-retention-repeat",
    },
  );
  logger.info(`Scheduled ai-context-retention daily at 3:45am (${AI_CONTEXT_RETENTION_TZ})`);
  await queue.add(
    "ai-diagnostics-tick",
    {},
    {
      repeat: { pattern: AI_DIAGNOSTICS_TICK_CRON, tz: AI_DIAGNOSTICS_TICK_TZ },
      jobId: "ai-diagnostics-tick-repeat",
    },
  );
  logger.info(`Scheduled ai-diagnostics-tick at 6am and 3pm (${AI_DIAGNOSTICS_TICK_TZ})`);
  await queue.add(
    "instagram-image-queue",
    {},
    {
      repeat: {
        pattern: INSTAGRAM_IMAGE_QUEUE_CRON,
        tz: INSTAGRAM_IMAGE_QUEUE_TZ,
      },
      jobId: "instagram-image-queue-repeat",
    },
  );
  logger.info(
    `Scheduled instagram-image-queue every minute (${INSTAGRAM_IMAGE_QUEUE_TZ})`,
  );
} else {
  logger.info(
    "Not scheduling shopify-reconcile - INTERNAL_API_SECRET not configured",
  );
}

const worker = new Worker(
  "ecomscaling-default",
  async (job) => {
    const context = createWorkerJobContext(job.name, job.id ?? null);
    recordWorkerJobMetric(job.name, "started");
    logger.info(
      `Processing job ${job.id ?? "unknown"}:${job.name}`,
      workerJobMeta(context, { attempt: job.attemptsMade }),
    );

    if (job.name === "shopify-reconcile") {
      return runShopifyReconcile(context);
    }
    if (job.name === "fathom-webhook-processing") {
      return runFathomWebhookProcessing(context);
    }
    if (job.name === "webhook-retention") {
      return runWebhookRetention(context);
    }
    if (job.name === "ai-context-retention") {
      return runAiContextRetention(context);
    }
    if (job.name === "ai-diagnostics-tick") {
      return runAiDiagnosticsTick(context);
    }
    if (job.name === "instagram-image-queue") {
      return runInstagramImageQueue(context);
    }

    return {
      status: "ok",
      processedAt: new Date().toISOString(),
    };
  },
  {
    connection,
  },
);

worker.on("completed", (job) => {
  const context = createWorkerJobContext(job.name, job.id ?? null);
  recordWorkerJobMetric(job.name, "completed");
  logger.info(
    `Completed job ${job.id ?? "unknown"}:${job.name}`,
    workerJobMeta(context, {
      metric: "worker_jobs_total",
      metric_value: workerMetrics
        .snapshot()
        .find(
          (sample) =>
            sample.name === "worker_jobs_total" &&
            sample.labels.job_name === job.name &&
            sample.labels.status === "completed",
        )?.value,
    }),
  );
});

worker.on("failed", (job, error) => {
  const context = createWorkerJobContext(
    job?.name ?? "unknown",
    job?.id ?? null,
  );
  recordWorkerJobMetric(job?.name ?? "unknown", "failed");
  logger.error(`Failed job ${job?.id ?? "unknown"}:${job?.name ?? "unknown"}`, {
    ...workerJobMeta(context),
    // Un Error tiene message/stack no enumerables -> se serializaban como `{}`.
    error:
      error instanceof Error
        ? { name: error.name, message: error.message, stack: error.stack }
        : error,
  });
});

const shopifySyncWorker = new Worker<ShopifyQueueWorkerJob>(
  SHOPIFY_SYNC_QUEUE_NAME,
  async (job) => {
    const context = createWorkerJobContext(job.name, job.id ?? null);
    recordWorkerJobMetric("shopify-sync", "started");
    logger.info("Processing queued Shopify job", workerJobMeta(context, {
      attempt: job.attemptsMade,
      connection_id: job.data.kind === "sync" ? job.data.connectionId : undefined,
      sync_type: job.data.kind === "sync"
        ? job.data.syncType
        : job.data.kind === "webhook_drain"
          ? "webhook_drain"
          : "reconcile_finalize",
    }));
    const apiEnv = loadApiEnv(process.env);
    return runShopifyQueueJob(apiEnv, job.data);
  },
  { connection, concurrency: 1 },
);

shopifySyncWorker.on("completed", (job) => {
  const context = createWorkerJobContext(job.name, job.id ?? null);
  recordWorkerJobMetric("shopify-sync", "completed");
  logger.info("Completed queued Shopify job", workerJobMeta(context, {
    connection_id: job.data.kind === "sync" ? job.data.connectionId : undefined,
  }));
});

shopifySyncWorker.on("failed", (job, error) => {
  const context = createWorkerJobContext(job?.name ?? "shopify-sync", job?.id ?? null);
  recordWorkerJobMetric("shopify-sync", "failed");
  logger.error("Queued Shopify job failed", {
    ...workerJobMeta(context),
    connection_id: job?.data.kind === "sync" ? job.data.connectionId : undefined,
    error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
  });
});

const heartbeatKey = "ecomscaling:worker:heartbeat";
const publishWorkerHeartbeat = async () => {
  const client = await queue.client;
  await client.set(heartbeatKey, new Date().toISOString(), { EX: 60 });
};
await publishWorkerHeartbeat();
const workerHeartbeatTimer = setInterval(() => {
  void publishWorkerHeartbeat().catch(() => undefined);
}, 15_000);
workerHeartbeatTimer.unref();

logger.info("Worker started");
