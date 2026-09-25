import { loadApiEnv } from "@e-nora/config";
import { runInterventionIntensityEngineForAllOrganizations } from "@e-nora/api/intervention-intensity-engine";
const summary = await runInterventionIntensityEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p09-intervention-intensity", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
