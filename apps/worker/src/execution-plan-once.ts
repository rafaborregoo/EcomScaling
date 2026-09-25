import { loadApiEnv } from "@e-nora/config";
import { runExecutionPlanEngineForAllOrganizations } from "@e-nora/api/execution-plan-engine";

const summary = await runExecutionPlanEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f8-p03-execution-plan", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
