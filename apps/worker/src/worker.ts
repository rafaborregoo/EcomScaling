import { Queue, Worker } from "bullmq";
import { loadWorkerEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { SHOPIFY_RECONCILE_CRON, SHOPIFY_RECONCILE_TZ, isStaleShopifyReconcileRepeatable } from "./repeatable-jobs.js";

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

const staleRepeatables = await queue.getRepeatableJobs();
for (const repeatable of staleRepeatables) {
  if (isStaleShopifyReconcileRepeatable(repeatable, SHOPIFY_RECONCILE_CRON)) {
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
