import { loadApiEnv } from "@e-nora/config";
import { runRecommendationCommunicationEngineForAllOrganizations } from "@e-nora/api/recommendation-communication-engine";

const summary = await runRecommendationCommunicationEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p18-recommendation-communication", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
