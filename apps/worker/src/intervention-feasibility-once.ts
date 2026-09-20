import { loadApiEnv } from "@ecomscaling/config";
import { runInterventionFeasibilityEngineForAllOrganizations } from "@ecomscaling/api/intervention-feasibility-engine";

const summary = await runInterventionFeasibilityEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p05-intervention-feasibility", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
