import { loadApiEnv } from "@ecomscaling/config";
import { runInterventionIntensityEngineForAllOrganizations } from "@ecomscaling/api/intervention-intensity-engine";
const summary = await runInterventionIntensityEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p09-intervention-intensity", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
