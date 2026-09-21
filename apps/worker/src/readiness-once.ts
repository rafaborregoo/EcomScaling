import { loadApiEnv } from "@ecomscaling/config";
import { runReadinessEngineForAllOrganizations } from "@ecomscaling/api/readiness-engine";
const summary = await runReadinessEngineForAllOrganizations(loadApiEnv(process.env)); console.log(JSON.stringify({ worker: "f8-p04-readiness", ...summary })); if (summary.failed > 0) process.exitCode = 1;
