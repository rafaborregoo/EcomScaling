import { loadApiEnv } from "@ecomscaling/config";
import { runRecommendationPortfolioEngineForAllOrganizations } from "@ecomscaling/api/recommendation-portfolio-engine";

const summary = await runRecommendationPortfolioEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p12-recommendation-portfolio", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
