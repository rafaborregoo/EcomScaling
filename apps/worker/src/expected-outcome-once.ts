import { loadApiEnv } from "@e-nora/config";
import { runExpectedOutcomeEngineForAllOrganizations } from "@e-nora/api/expected-outcome-engine";

const summary = await runExpectedOutcomeEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p15-expected-outcome", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
