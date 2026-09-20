import { loadApiEnv } from "@ecomscaling/config";
import { runRestraintDecisionEngineForAllOrganizations } from "@ecomscaling/api/restraint-decision-engine";

const summary = await runRestraintDecisionEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p14-restraint-decision", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
