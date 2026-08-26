import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runAndPersistOfflineAgentEvalsForEnv } from "@ecomscaling/api/agent-eval-runner";
import { createWorkerJobContext, workerJobMeta } from "./job-context.js";

const logger = createLogger("agent-evals-cron");
const jobContext = createWorkerJobContext("agent-evals-cron");

async function main() {
  const env = loadApiEnv(process.env);
  logger.info("Starting offline agent eval runner", workerJobMeta(jobContext));
  const result = await runAndPersistOfflineAgentEvalsForEnv(env);
  logger.info(
    "Offline agent eval runner completed",
    workerJobMeta(jobContext, {
      count: result.length,
      failed: result.filter((item) => !item.passed).length,
    }),
  );
  if (result.some((item) => !item.passed)) process.exitCode = 1;
}

main().catch((error: unknown) => {
  logger.error("Offline agent eval runner crashed", {
    ...workerJobMeta(jobContext),
    error,
  });
  process.exit(1);
});
