import { loadApiEnv } from "@e-nora/config";
import { runInterventionSequencingEngineForAllOrganizations } from "@e-nora/api/intervention-sequencing-engine";

const summary = await runInterventionSequencingEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p07-intervention-sequencing", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
