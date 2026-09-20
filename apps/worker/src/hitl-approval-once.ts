import { loadApiEnv } from "@ecomscaling/config";
import { runHitlApprovalEngineForAllOrganizations } from "@ecomscaling/api/hitl-approval-engine";

const summary = await runHitlApprovalEngineForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f8-p02-hitl-approval", ...summary }));
if (summary.failed > 0) process.exitCode = 1;
