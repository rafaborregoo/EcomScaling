import { loadApiEnv } from "@e-nora/config";
import { runInterventionPrioritizationEngineForAllOrganizations } from "@e-nora/api/intervention-prioritization-engine";

const summary = await runInterventionPrioritizationEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p03-intervention-prioritization", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
