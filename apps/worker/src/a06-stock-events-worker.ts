import { Queue, Worker, type ConnectionOptions } from "bullmq";
import { createLogger } from "@e-nora/observability";
import { fetchWorkerWithResilience } from "./worker-http.js";
import { createWorkerJobContext } from "./job-context.js";

/** Separate consumer: model latency must not hold up inventory webhooks. */
export async function startA06StockEventsWorker(
  env: { API_URL: string; INTERNAL_API_SECRET?: string | undefined },
  connection: ConnectionOptions,
) {
  const logger = createLogger("a06-stock-events-worker");
  const queue = new Queue("ecomscaling-a06-stock-events", { connection });
  await queue.setGlobalConcurrency(1);
  await queue.add(
    "stock-event-tick",
    {},
    {
      repeat: { every: 60_000 },
      jobId: "a06-stock-event-tick-repeat",
      removeOnComplete: { count: 20 },
      removeOnFail: { count: 100 },
    },
  );
  const worker = new Worker(
    "ecomscaling-a06-stock-events",
    async (job) => {
      if (!env.INTERNAL_API_SECRET)
        return { status: "skipped", reason: "internal_secret_not_configured" };
      const context = createWorkerJobContext(job.name, job.id ?? null);
      const response = await fetchWorkerWithResilience(
        `${env.API_URL}/v1/internal/ai/a06-stock-events/tick`,
        {
          method: "POST",
          headers: {
            "x-internal-secret": env.INTERNAL_API_SECRET,
            "x-correlation-id": context.correlation_id,
          },
        },
        { timeoutMs: 20 * 60_000, maxRetries: 0 },
      );
      if (!response.ok)
        throw new Error(`a06_stock_event_tick_failed_${response.status}`);
      return response.json();
    },
    { connection, concurrency: 1 },
  );
  worker.on("failed", (_job, error) =>
    logger.error("A06 stock event tick failed", { error: error.message }),
  );
  worker.on("completed", (_job, result) => {
    if (result?.processed) logger.info("A06 stock events processed", result);
  });
  return { queue, worker };
}
