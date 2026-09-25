import { loadApiEnv } from "@e-nora/config";
import { runHitlApprovalEngineForAllOrganizations } from "@e-nora/api/hitl-approval-engine";

const summary = await runHitlApprovalEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f8-p02-hitl-approval", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
