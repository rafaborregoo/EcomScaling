import { loadApiEnv } from "@ecomscaling/config";
import { runInterventionTestExecuteEngineForAllOrganizations } from "@ecomscaling/api/intervention-test-execute-engine";

const summary = await runInterventionTestExecuteEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f7-p08-intervention-test-execute", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
