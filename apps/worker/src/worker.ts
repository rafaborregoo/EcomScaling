import { Queue, Worker } from "bullmq";
import {
  describeEnvironmentTargetRisk,
  loadApiEnv,
  loadWorkerEnv,
  shouldBlockOnEnvironmentRisk,
} from "@e-nora/config";
import { runShopifyQueueJob } from "@e-nora/api/shopify-queue-worker";
import type { ShopifyQueueWorkerJob } from "@e-nora/api/shopify-queue-worker";
import { reconcileAllMetaConnections } from "@e-nora/api/meta-sync";
import { reconcileAllKlaviyoConnections } from "@e-nora/api/klaviyo-sync";
import { SHOPIFY_WEBHOOK_QUEUE_NAME } from "@e-nora/api/shopify-webhook-queue";
import { drainFailedShopifyWebhooks } from "@e-nora/api/shopify-webhook-handler";
import { INTEGRATION_SYNC_QUEUE_NAME, INTEGRATION_SYNC_QUEUE_NAMES, enqueueIntegrationSync, type IntegrationSyncJob } from "@e-nora/api/integration-sync-queue";
import { runMetaSync } from "@e-nora/api/meta-sync";
import { runKlaviyoSync } from "@e-nora/api/klaviyo-sync";
import { processQueuedKlaviyoWebhooks } from "@e-nora/api/klaviyo-webhooks";
import { runIntegrationHealthMonitor } from "@e-nora/api/ops-health-check";
import {
  SHOPIFY_SYNC_QUEUE_NAME,
} from "@e-nora/api/shopify-sync-queue";
import { createLogger } from "@e-nora/observability";
import {
  SHOPIFY_RECONCILE_CRON,
  SHOPIFY_RECONCILE_TZ,
  META_RECONCILE_CRON,
  META_RECONCILE_TZ,
  KLAVIYO_RECONCILE_CRON,
  KLAVIYO_RECONCILE_TZ,
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
  NOTIFICATION_EMAIL_CRON,
  NOTIFICATION_EMAIL_TZ,
  MOBILE_PUSH_CRON,
  MOBILE_PUSH_TZ,
  NOTIFICATION_DAILY_CRON,
  NOTIFICATION_DAILY_TZ,
  NOTIFICATION_OUTBOX_CRON,
  NOTIFICATION_OUTBOX_TZ,
  isStaleIntegrationRepeatable,
} from "./repeatable-jobs.js";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";
import { recordWorkerJobMetric, workerMetrics } from "./metrics.js";
import { fetchWorkerWithResilience } from "./worker-http.js";
import { startA06StockEventsWorker } from "./a06-stock-events-worker.js";

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
  const result = await response.json() as { status?: string; detail?: string };
  if (result.status === "error") throw new Error(`instagram_image_queue_failed_${result.detail ?? "unknown"}`);
  return result;
}

async function runNotificationEmailTick(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/notifications/email-tick`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok)
    throw new Error(`notification_email_tick_failed_${response.status}`);
  return response.json();
}

async function runMobilePushTick(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/notifications/push-tick`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok) throw new Error(`mobile_push_tick_failed_${response.status}`);
  return response.json();
}

async function runNotificationOutboxTick(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/notifications/outbox-tick`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok) throw new Error(`notification_outbox_tick_failed_${response.status}`);
  return response.json();
}

async function runNotificationDailyTick(
  context: ReturnType<typeof createWorkerJobContext>,
) {
  if (!env.INTERNAL_API_SECRET) return { status: "skipped" };
  const response = await fetchWorkerWithResilience(
    `${env.API_URL}/v1/internal/notifications/daily-tick`,
    {
      method: "POST",
      headers: {
        "x-internal-secret": env.INTERNAL_API_SECRET,
        "x-correlation-id": context.correlation_id,
      },
    },
  );
  if (!response.ok) throw new Error(`notification_daily_tick_failed_${response.status}`);
  return response.json();
}

const queue = new Queue("ecomscaling-default", { connection });
// Stock reviews may call a model for minutes. Keep them off the webhook and
// shared queues so they never delay inventory ingestion or notifications.
const { queue: a06EventQueue, worker: a06EventWorker } = await startA06StockEventsWorker(env, connection);
await queue.add("integration-health", {}, {
  repeat: { every: 300_000 }, jobId: "integration-health-repeat",
  removeOnComplete: { count: 20 }, removeOnFail: { count: 100 },
});
const shopifyQueueControl = new Queue(SHOPIFY_SYNC_QUEUE_NAME, { connection });
await shopifyQueueControl.setGlobalConcurrency(1);
await shopifyQueueControl.setGlobalRateLimit(1, 5_000);
// Remove the old shared-queue sweep; imports must never block live events.
for (const repeatable of await shopifyQueueControl.getRepeatableJobs()) {
  if (repeatable.name === "shopify-webhook-drain") await shopifyQueueControl.removeRepeatableByKey(repeatable.key);
}
const webhookQueue = new Queue(SHOPIFY_WEBHOOK_QUEUE_NAME, { connection });
const runIntegrationJob = async (job: { data: IntegrationSyncJob }) => {
  const apiEnv = loadApiEnv(process.env);
  if (job.data.provider === "meta_ads") {
    if (job.data.mode === "initial") return runMetaSync(apiEnv, job.data.connectionId, "initial");
    const result = await reconcileAllMetaConnections(apiEnv, job.data.connectionId);
    if (result.failed) throw new Error("meta_sync_failed_retry_scheduled");
    return result;
  }
  if (job.data.mode === "initial") {
    const result = await runKlaviyoSync(apiEnv, job.data.connectionId, "initial", true);
    if (result.status === "partial") throw new Error("klaviyo_sync_partial_retry_scheduled");
    return result;
  }
  const result = await reconcileAllKlaviyoConnections(apiEnv, job.data.connectionId, job.data.force);
  if (result.failed) throw new Error("klaviyo_sync_failed_retry_scheduled");
  return result;
};
// Drain jobs from the earlier shared queue without letting a large Klaviyo
// import occupy every Meta consumer. Each provider has independent capacity.
const integrationWorker = new Worker<IntegrationSyncJob>(INTEGRATION_SYNC_QUEUE_NAME, (job) => enqueueIntegrationSync(loadApiEnv(process.env), job.data), { connection, concurrency: 2 });
const providerWorkers = Object.entries(INTEGRATION_SYNC_QUEUE_NAMES).map(([provider, name]) => {
  const consumer = new Worker<IntegrationSyncJob>(name, runIntegrationJob, { connection, concurrency: provider === "klaviyo" ? 2 : 1 });
  consumer.on("failed", (job, error) => logger.error("Provider sync failed", { provider, connection_id: job?.data.connectionId, error: error.message }));
  return consumer;
});
integrationWorker.on("failed", (_job, error) => logger.error("Integration sync job failed", { error: error.message }));
await webhookQueue.setGlobalConcurrency(1);
await webhookQueue.add("sweep", {}, {
  repeat: { every: 5_000 }, jobId: "webhook-recovery-sweep",
  removeOnComplete: true, removeOnFail: { count: 500 },
});
const webhookWorker = new Worker(SHOPIFY_WEBHOOK_QUEUE_NAME, async () => {
  const apiEnv = loadApiEnv(process.env);
  const deadline = Date.now() + 25_000;
  await processQueuedKlaviyoWebhooks(apiEnv);
  let total = 0;
  do {
    const result = await drainFailedShopifyWebhooks(apiEnv, 100);
    total += result.processed;
    if (result.candidates < 100) break;
  } while (Date.now() < deadline);
  return { processed: total };
}, { connection, concurrency: 1 });
webhookWorker.on("failed", (_job, error) => logger.error("Shopify webhook consumer failed", { error: error.message }));

await queue.add(
  "meta-reconcile",
  {},
  {
    repeat: { pattern: META_RECONCILE_CRON, tz: META_RECONCILE_TZ },
    jobId: "meta-reconcile-repeat",
  },
);
await queue.add(
  "klaviyo-reconcile",
  {},
  {
    repeat: { pattern: KLAVIYO_RECONCILE_CRON, tz: KLAVIYO_RECONCILE_TZ },
    jobId: "klaviyo-reconcile-repeat",
  },
);
logger.info("Scheduled Meta reconciliation every 10 minutes and Klaviyo every 15 minutes (UTC)");

const staleRepeatables = await queue.getRepeatableJobs();
for (const repeatable of staleRepeatables) {
  if (isStaleIntegrationRepeatable(repeatable)) {
    await queue.removeRepeatableByKey(repeatable.key);
    logger.info(
      `Removed stale integration repeatable job (${repeatable.key})`,
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
    `Scheduled shopify-reconcile every 15 minutes (${SHOPIFY_RECONCILE_TZ})`,
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
  await queue.add(
    "notification-email",
    {},
    {
      repeat: { pattern: NOTIFICATION_EMAIL_CRON, tz: NOTIFICATION_EMAIL_TZ },
      jobId: "notification-email-repeat",
    },
  );
  logger.info(`Scheduled notification-email every 10 minutes (${NOTIFICATION_EMAIL_TZ})`);
  await queue.add(
    "mobile-push",
    {},
    {
      repeat: { pattern: MOBILE_PUSH_CRON, tz: MOBILE_PUSH_TZ },
      jobId: "mobile-push-repeat",
    },
  );
  logger.info(`Scheduled mobile-push every 2 minutes (${MOBILE_PUSH_TZ})`);
  await queue.add(
    "notification-daily",
    {},
    {
      repeat: { pattern: NOTIFICATION_DAILY_CRON, tz: NOTIFICATION_DAILY_TZ },
      jobId: "notification-daily-repeat",
    },
  );
  logger.info(`Scheduled notification-daily at 08:00 (${NOTIFICATION_DAILY_TZ})`);
  await queue.add(
    "notification-outbox",
    {},
    {
      repeat: { pattern: NOTIFICATION_OUTBOX_CRON, tz: NOTIFICATION_OUTBOX_TZ },
      jobId: "notification-outbox-repeat",
    },
  );
  logger.info(`Scheduled notification-outbox every minute (${NOTIFICATION_OUTBOX_TZ})`);
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
    if (job.name === "integration-health") {
      const result = await runIntegrationHealthMonitor(loadApiEnv(process.env));
      const findings = result.findings;
      for (const finding of findings) logger.error("Integration health alert", finding);
      return { checkedAt: result.checkedAt, findings };
    }
    if (job.name === "meta-reconcile") {
      const result = await reconcileAllMetaConnections(loadApiEnv(process.env));
      logger.info("Meta reconciliation completed", workerJobMeta(context, result));
      return result;
    }
    if (job.name === "klaviyo-reconcile") {
      const result = await reconcileAllKlaviyoConnections(loadApiEnv(process.env));
      logger.info("Klaviyo reconciliation completed", workerJobMeta(context, result));
      return result;
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
    if (job.name === "notification-email") {
      return runNotificationEmailTick(context);
    }
    // Estaba programado pero sin rama aqui: el job caia en el "ok" de abajo y
    // nunca se mandaba ningun push.
    if (job.name === "mobile-push") {
      return runMobilePushTick(context);
    }
    if (job.name === "notification-outbox") {
      return runNotificationOutboxTick(context);
    }
    if (job.name === "notification-daily") {
      return runNotificationDailyTick(context);
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

let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(workerHeartbeatTimer);
  const deadline = setTimeout(() => process.exit(1), 30_000);
  void Promise.all([worker.close(), a06EventWorker.close(), shopifySyncWorker.close(), webhookWorker.close(), integrationWorker.close(), ...providerWorkers.map((consumer) => consumer.close())])
    .then(() => Promise.all([queue.close(), a06EventQueue.close(), shopifyQueueControl.close(), webhookQueue.close()]))
    .then(() => { clearTimeout(deadline); process.exit(0); })
    .catch((error: unknown) => { logger.error("Worker shutdown failed", { error: error instanceof Error ? error.message : "unknown_error" }); process.exit(1); });
});
