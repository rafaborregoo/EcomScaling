import { Queue } from "bullmq";

export const INTEGRATION_SYNC_QUEUE_NAME = "ecomscaling-integrations";
export const INTEGRATION_SYNC_QUEUE_NAMES = { meta_ads: "ecomscaling-meta-sync", klaviyo: "ecomscaling-klaviyo-sync" } as const;
export type IntegrationSyncJob = {
  provider: "meta_ads" | "klaviyo";
  connectionId: string;
  organizationId: string;
  mode: "initial" | "incremental";
  force?: boolean;
};
const queues = new Map<string, Queue<IntegrationSyncJob>>();

export async function closeIntegrationSyncQueues() {
  await Promise.all([...queues.values()].map((queue) => queue.close()));
  queues.clear();
}

export async function enqueueIntegrationSync(env: { REDIS_URL?: string }, input: IntegrationSyncJob) {
  if (!env.REDIS_URL) throw new Error("integration_sync_redis_not_configured");
  const queueName = INTEGRATION_SYNC_QUEUE_NAMES[input.provider];
  let queue = queues.get(queueName);
  if (!queue) {
    const url = new URL(env.REDIS_URL);
    queue = new Queue(queueName, { connection: {
      host: url.hostname, port: Number(url.port || 6379), maxRetriesPerRequest: 1,
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(url.protocol === "rediss:" ? { tls: {} } : {}),
    } });
    queues.set(queueName, queue);
  }
  const jobId = `integration-${input.provider}-${input.connectionId}`;
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (state === "completed") await existing.remove();
    else if (state === "failed") {
      await existing.updateData(input);
      await existing.retry();
      return { jobId, status: "queued" as const };
    } else {
      if (state !== "active" && (input.mode === "initial" || input.force)) {
        await existing.updateData({ ...input, mode: existing.data.mode === "initial" ? "initial" : input.mode });
      }
      return { jobId, status: state === "active" ? "running" as const : "queued" as const };
    }
  }
  await queue.add("sync", input, {
    jobId, attempts: 5, backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: true, removeOnFail: { age: 7 * 24 * 60 * 60, count: 1000 },
  });
  return { jobId, status: "queued" as const };
}
