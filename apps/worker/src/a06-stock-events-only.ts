// Development pilot: start only A06 observation, without running other jobs.
import {
  loadWorkerEnv,
  describeEnvironmentTargetRisk,
  shouldBlockOnEnvironmentRisk,
} from "@e-nora/config";
import { startA06StockEventsWorker } from "./a06-stock-events-worker.js";
const env = loadWorkerEnv(process.env);
const risk = describeEnvironmentTargetRisk(process.env);
if (risk && shouldBlockOnEnvironmentRisk(process.env)) throw new Error(risk);
const url = new URL(env.REDIS_URL);
const runtime = await startA06StockEventsWorker(env, {
  host: url.hostname,
  port: Number(url.port || 6379),
  maxRetriesPerRequest: null,
  ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
  ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  ...(url.protocol === "rediss:" ? { tls: {} } : {}),
});
console.log(
  "A06 stock pilot consumer running; each store retains its configured mode.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void runtime.worker
      .close()
      .then(() => runtime.queue.close())
      .then(() => process.exit(0));
  });
