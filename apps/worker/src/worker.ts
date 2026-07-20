import { Queue, Worker } from "bullmq";
import { loadWorkerEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";

const env = loadWorkerEnv(process.env);
const logger = createLogger("worker");

const redisUrl = new URL(env.REDIS_URL);
const connection = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  maxRetriesPerRequest: null,
  ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
  ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
};

const SHOPIFY_RECONCILE_CRON = "0 2 * * *";
const SHOPIFY_RECONCILE_TZ = "Europe/Madrid";

async function runShopifyReconcile() {
  if (!env.INTERNAL_API_SECRET) {
    logger.info("Skipping Shopify reconcile job - INTERNAL_API_SECRET not configured");
    return { status: "skipped" };
  }

  const response = await fetch(`${env.API_URL}/v1/internal/shopify/reconcile`, {
    method: "POST",
    headers: { "x-internal-secret": env.INTERNAL_API_SECRET },
  });

  if (!response.ok) {
    throw new Error(`shopify_reconcile_trigger_failed_${response.status}`);
  }

  return response.json();
}

const queue = new Queue("ecomscaling-default", { connection });

// BullMQ indexa los jobs repetibles por su configuracion de repeat, no solo por
// jobId: cambiar de `every` (6h) a `pattern` (cron diario) deja el job viejo
// huerfano en Redis si no se borra explicitamente, duplicando el reconcile.
const staleRepeatables = await queue.getRepeatableJobs();
for (const repeatable of staleRepeatables) {
  if (repeatable.name === "shopify-reconcile" && repeatable.pattern !== SHOPIFY_RECONCILE_CRON) {
    await queue.removeRepeatableByKey(repeatable.key);
    logger.info(`Removed stale shopify-reconcile repeatable job (${repeatable.key})`);
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
  logger.info(`Scheduled shopify-reconcile daily at 2am (${SHOPIFY_RECONCILE_TZ})`);
} else {
  logger.info("Not scheduling shopify-reconcile - INTERNAL_API_SECRET not configured");
}

const worker = new Worker(
  "ecomscaling-default",
  async (job) => {
    logger.info(`Processing job ${job.id ?? "unknown"}:${job.name}`);

    if (job.name === "shopify-reconcile") {
      return runShopifyReconcile();
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
  logger.info(`Completed job ${job.id ?? "unknown"}:${job.name}`);
});

worker.on("failed", (job, error) => {
  logger.error(`Failed job ${job?.id ?? "unknown"}:${job?.name ?? "unknown"}`, error);
});

logger.info("Worker started");
