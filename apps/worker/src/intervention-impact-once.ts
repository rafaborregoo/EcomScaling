import { loadApiEnv } from "@e-nora/config";
import { runInterventionImpactEngineForAllOrganizations } from "@e-nora/api/intervention-impact-engine";

const summary = await runInterventionImpactEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p04-intervention-impact", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
