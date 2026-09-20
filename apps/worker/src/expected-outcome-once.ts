import { loadApiEnv } from "@ecomscaling/config";
import { runExpectedOutcomeEngineForAllOrganizations } from "@ecomscaling/api/expected-outcome-engine";

const summary = await runExpectedOutcomeEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p15-expected-outcome", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
