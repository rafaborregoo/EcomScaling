import { loadApiEnv } from "@e-nora/config";
import { refreshLifecycleViewsForAllOrganizations } from "@e-nora/api/execution-lifecycle-engine";

const summary = await refreshLifecycleViewsForAllOrganizations(loadApiEnv(process.env));
console.log(JSON.stringify({ worker: "f8-p10-execution-lifecycle", ...summary }));
// Una intervencion con el lifecycle inconsistente es un fallo operativo, no una
// nota: CLOSED con escrituras activas no puede pasar desapercibido (spec 49).
if (summary.failed > 0 || summary.inconsistent > 0) process.exitCode = 1;
