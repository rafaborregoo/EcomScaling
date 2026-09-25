import { loadApiEnv } from "@e-nora/config";
import { runRestraintDecisionEngineForAllOrganizations } from "@e-nora/api/restraint-decision-engine";

const summary = await runRestraintDecisionEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p14-restraint-decision", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
