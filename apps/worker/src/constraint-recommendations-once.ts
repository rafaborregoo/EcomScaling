import { loadApiEnv } from "@ecomscaling/config";
import { runConstraintRecommendationEngineForAllOrganizations } from "@ecomscaling/api/constraint-recommendations-engine";

const summary = await runConstraintRecommendationEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p11-constraint-recommendations", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
