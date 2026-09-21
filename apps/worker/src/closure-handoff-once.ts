import { loadApiEnv } from "@ecomscaling/config";
import { runClosureHandoffEngineForAllOrganizations } from "@ecomscaling/api/closure-handoff-engine";

const summary = await runClosureHandoffEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f8-p16-closure-handoff", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
