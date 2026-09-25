import { loadApiEnv } from "@e-nora/config";
import { runDynamicDecisionEngineForAllOrganizations } from "@e-nora/api/dynamic-decision-engine";

const summary = await runDynamicDecisionEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p13-dynamic-decision", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
