import { loadApiEnv } from "@ecomscaling/config";
import { runMaturityRecommendationEngineForAllOrganizations } from "@ecomscaling/api/maturity-recommendations-engine";

const summary = await runMaturityRecommendationEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p10-maturity-recommendations", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
