import { Queue } from "bullmq";

export const SHOPIFY_WEBHOOK_QUEUE_NAME = "ecomscaling-shopify-webhooks";
let queue: Queue | undefined;

/** SQL is the durable inbox; Redis only wakes its consumer. The sweep covers lost wakeups. */
export async function wakeShopifyWebhooks(env: { REDIS_URL?: string }) {
  if (!env.REDIS_URL) throw new Error("shopify_webhook_queue_redis_not_configured");
  if (!queue) {
    const url = new URL(env.REDIS_URL);
    queue = new Queue(SHOPIFY_WEBHOOK_QUEUE_NAME, { connection: {
      host: url.hostname, port: Number(url.port || 6379), maxRetriesPerRequest: 1,
      enableOfflineQueue: false, connectTimeout: 1000, commandTimeout: 1000,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    } });
  }
  await queue.add("drain", {}, {
    deduplication: { id: "wake" },
    attempts: 8, backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: true, removeOnFail: { age: 7 * 24 * 60 * 60, count: 500 },
  });
}
