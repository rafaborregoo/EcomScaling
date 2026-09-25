import { loadApiEnv } from "@e-nora/config";
import { runInterventionRiskEngineForAllOrganizations } from "@e-nora/api/intervention-risk-engine";

const summary = await runInterventionRiskEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p06-intervention-risk", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
