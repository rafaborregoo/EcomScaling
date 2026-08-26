import { Queue, Worker } from "bullmq";
import { loadWorkerEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import {
  SHOPIFY_RECONCILE_CRON,
  SHOPIFY_RECONCILE_TZ,
  FATHOM_WEBHOOK_CRON,
  FATHOM_WEBHOOK_TZ,
  isStaleShopifyReconcileRepeatable,
} from "./repeatable-jobs.js";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";
import { recordWorkerJobMetric, workerMetrics } from "./metrics.js";
import { fetchWorkerWithResilience } from "./worker-http.js";

const env = loadWorkerEnv(process.env);
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

const queue = new Queue("ecomscaling-default", { connection });

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
    error,
  });
});

logger.info("Worker started");
