import { loadApiEnv } from "@ecomscaling/config";
import { runInterventionMatchingEngineForAllOrganizations } from "@ecomscaling/api/intervention-matching-engine";

const summary = await runInterventionMatchingEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p02-intervention-matching", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
