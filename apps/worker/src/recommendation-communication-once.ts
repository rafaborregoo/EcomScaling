import { loadApiEnv } from "@ecomscaling/config";
import { runRecommendationCommunicationEngineForAllOrganizations } from "@ecomscaling/api/recommendation-communication-engine";

const summary = await runRecommendationCommunicationEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p18-recommendation-communication", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
