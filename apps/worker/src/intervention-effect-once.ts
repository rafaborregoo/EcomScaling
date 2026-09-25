import { loadApiEnv } from "@ecomscaling/config";
import { createLogger } from "@ecomscaling/observability";
import { runInterventionEffectEngineForAllOrganizations } from "@ecomscaling/api/intervention-effect-engine";

// F8: efecto de negocio de las intervenciones con metrica objetivo declarada.
async function main() {
  const summary = await runInterventionEffectEngineForAllOrganizations(loadApiEnv(process.env));
  console.log(JSON.stringify({ worker: "f8-intervention-effect", ...summary }));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error: unknown) => {
  createLogger("intervention-effect-cron").error("intervention_effect_crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
