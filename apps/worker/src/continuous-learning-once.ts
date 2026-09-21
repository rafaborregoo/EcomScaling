import { loadApiEnv } from "@ecomscaling/config";
import { runContinuousLearningEngineForAllOrganizations } from "@ecomscaling/api/continuous-learning-engine";

const summary = await runContinuousLearningEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f9-continuous-learning", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
