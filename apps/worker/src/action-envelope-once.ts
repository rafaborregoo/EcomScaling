import { loadApiEnv } from "@e-nora/config";
import { runActionEnvelopeEngineForAllOrganizations } from "@e-nora/api/action-envelope-engine";
const summary = await runActionEnvelopeEngineForAllOrganizations(loadApiEnv(process.env)); console.log(JSON.stringify({ worker: "f8-p05-action-envelope", ...summary })); if (summary.failed > 0) process.exitCode = 1;
