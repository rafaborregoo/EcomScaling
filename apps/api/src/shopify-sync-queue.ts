import { Queue } from "bullmq";

export const SHOPIFY_SYNC_QUEUE_NAME = "ecomscaling-shopify-sync";
/** Bounds Redis backlog when many stores connect or recover at once. */
export const SHOPIFY_SYNC_MAX_PENDING = 250;

export type ShopifyQueuedSyncType = "initial_import" | "manual" | "incremental";
export type ShopifyQueuedSyncSource = "oauth" | "manual" | "reconcile";

export type ShopifySyncQueueJob = {
  kind: "sync";
  connectionId: string;
  organizationId: string;
  syncType: ShopifyQueuedSyncType;
  source: ShopifyQueuedSyncSource;
};
export type ShopifyReconcileFinalizeJob = { kind: "reconcile_finalize" };
export type ShopifyWebhookDrainJob = { kind: "webhook_drain" };
export type ShopifyQueueJob =
  | ShopifySyncQueueJob
  | ShopifyReconcileFinalizeJob
  | ShopifyWebhookDrainJob;

export type ShopifySyncQueueResult = {
  jobId: string;
  status: "queued" | "running";
  deduplicated: boolean;
};

export class ShopifySyncQueueSaturatedError extends Error {
  constructor() {
    super("shopify_sync_queue_saturated");
    this.name = "ShopifySyncQueueSaturatedError";
  }
}

const SHOPIFY_SYNC_PRIORITY: Record<ShopifyQueuedSyncType, number> = {
  initial_import: 1,
  manual: 5,
  incremental: 10,
};

type QueueEnv = { REDIS_URL?: string };

// BullMQ's job-name keyed payload typing collapses discriminated unions to
// `never`; the consumer remains strictly typed by ShopifyQueueJob.
let queue: Queue<any> | null = null;
let queueUrl: string | null = null;

function getShopifySyncQueue(env: QueueEnv) {
  if (!env.REDIS_URL) throw new Error("shopify_sync_queue_redis_not_configured");
  if (queue && queueUrl === env.REDIS_URL) return queue;
  if (queue) void queue.close();

  const redisUrl = new URL(env.REDIS_URL);
  queue = new Queue<any>(SHOPIFY_SYNC_QUEUE_NAME, {
    connection: {
      host: redisUrl.hostname,
      port: Number(redisUrl.port || 6379),
      maxRetriesPerRequest: null,
      ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
      ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
      ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
    },
  });
  queueUrl = env.REDIS_URL;
  return queue;
}

/**
 * A stable per-connection job id prevents duplicate imports from OAuth retries,
 * impatient clicks, and overlapping reconciliation passes. One job per
 * connection is allowed to be queued or active at a time.
 */
export async function enqueueShopifySync(
  env: QueueEnv,
  input: ShopifySyncQueueJob,
): Promise<ShopifySyncQueueResult> {
  const jobQueue = getShopifySyncQueue(env);
  const jobId = `shopify-sync-${input.connectionId}`;
  const existing = await jobQueue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();
    if (state === "failed") {
      await existing.updateData(input);
      await existing.changePriority({ priority: SHOPIFY_SYNC_PRIORITY[input.syncType] });
      await existing.retry();
      return { jobId, status: "queued", deduplicated: false };
    }
    if (state === "completed") {
      await existing.remove();
    } else {
      const existingData = existing.data as ShopifyQueueJob;
      const isPending = state === "waiting" || state === "delayed" || state === "prioritized";
      const upgradesToInitialImport =
        isPending &&
        input.syncType === "initial_import" &&
        existingData.kind === "sync" &&
        existingData.syncType !== "initial_import";

      if (upgradesToInitialImport) {
        await existing.updateData(input);
        await existing.changePriority({ priority: SHOPIFY_SYNC_PRIORITY.initial_import });
      }
      return {
        jobId,
        status: state === "active" ? "running" : "queued",
        deduplicated: true,
      };
    }
  }

  const pendingCounts = await jobQueue.getJobCounts(
    "waiting",
    "prioritized",
    "delayed",
    "waiting-children",
  );
  const pendingCount =
    (pendingCounts.waiting ?? 0) +
    (pendingCounts.prioritized ?? 0) +
    (pendingCounts.delayed ?? 0) +
    (pendingCounts["waiting-children"] ?? 0);
  if (pendingCount >= SHOPIFY_SYNC_MAX_PENDING) {
    throw new ShopifySyncQueueSaturatedError();
  }

  await jobQueue.add("sync-store", input, {
    jobId,
    attempts: 5,
    backoff: { type: "exponential", delay: 60_000 },
    priority: SHOPIFY_SYNC_PRIORITY[input.syncType],
    removeOnComplete: true,
    removeOnFail: { age: 30 * 24 * 60 * 60, count: 2_000 },
  });

  return { jobId, status: "queued", deduplicated: false };
}

export async function enqueueShopifyReconcileFinalize(env: QueueEnv, dayKey: string) {
  const jobQueue = getShopifySyncQueue(env);
  const jobId = `shopify-reconcile-finalize-${dayKey}`;
  const existing = await jobQueue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state !== "completed" && state !== "failed") return { jobId, deduplicated: true };
    await existing.remove();
  }
  await jobQueue.add("reconcile-finalize", { kind: "reconcile_finalize" }, {
    jobId,
    attempts: 3,
    backoff: { type: "exponential", delay: 60_000 },
    priority: 20,
    removeOnComplete: true,
    removeOnFail: { age: 30 * 24 * 60 * 60, count: 500 },
  });
  return { jobId, deduplicated: false };
}
