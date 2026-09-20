import { loadApiEnv } from "@ecomscaling/config";
import { runRecommendationConfidenceEngineForAllOrganizations } from "@ecomscaling/api/recommendation-confidence-engine";

const summary = await runRecommendationConfidenceEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p17-recommendation-confidence", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
