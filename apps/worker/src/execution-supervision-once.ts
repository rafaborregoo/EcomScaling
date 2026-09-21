import { loadApiEnv } from "@ecomscaling/config";
import { runExecutionSupervisionForAllOrganizations } from "@ecomscaling/api/execution-supervision-engine";
const summary = await runExecutionSupervisionForAllOrganizations(loadApiEnv(process.env)); console.log(JSON.stringify({ worker: "f8-p06-p17-execution-supervision", ...summary })); if (summary.failed > 0) process.exitCode = 1;
