import { loadApiEnv } from "@e-nora/config";
import { runInterventionFeasibilityEngineForAllOrganizations } from "@e-nora/api/intervention-feasibility-engine";

const summary = await runInterventionFeasibilityEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p05-intervention-feasibility", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
