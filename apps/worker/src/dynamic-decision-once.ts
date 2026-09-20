import { loadApiEnv } from "@ecomscaling/config";
import { runDynamicDecisionEngineForAllOrganizations } from "@ecomscaling/api/dynamic-decision-engine";

const summary = await runDynamicDecisionEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p13-dynamic-decision", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
