import { loadApiEnv } from "@ecomscaling/config";
import { runInterventionImpactEngineForAllOrganizations } from "@ecomscaling/api/intervention-impact-engine";

const summary = await runInterventionImpactEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p04-intervention-impact", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
