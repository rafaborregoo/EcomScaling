#!/usr/bin/env bash
set -Euo pipefail

job="${1:-}"
case "$job" in
  # Integraciones y mantenimiento
  klaviyo-reconcile|meta-reconcile|purge-expired-deletions)
    ;;
  # Benchmarks por dimension + lectura transversal
  anomalies-red-flags|benchmark-confidence|conversion-cro-benchmarks|\
offer-pricing-benchmarks|operations-cx-benchmarks|product-inventory-benchmarks|\
retention-crm-benchmarks|scalability-benchmarks|unit-economics-benchmarks)
    ;;
  # F7 (recomendacion) y F8/F9 (ejecucion y aprendizaje), migrados desde
  # GitHub Actions el 2026-09-22 al borrarse los workflows en 2b2ab70.
  expected-outcome|recommendation-confidence|recommendation-communication|\
execution-plan|readiness|hitl-approval|closure-handoff|\
action-envelope|execution-supervision|continuous-learning)
    ;;
  # AI-07 memoria acumulativa (apps/worker/src/memory-ingestion-once.ts).
  # memory-ingestion.yml se borro con el resto de workflows de GH Actions
  # (2b2ab70, 2026-09-22) pero, a diferencia de F7/F8/F9, no se le dio
  # reemplazo en el VPS -- se quedo parado en produccion hasta ahora.
  memory-ingestion|mailing-campaign-resume)
    ;;
  # Cadena nocturna F3 -> F7 en orden de fase (apps/worker/src/nightly-chain-once.ts)
  nightly-chain)
    ;;
  # Tarifa de modelos de IA desde LiteLLM (apps/worker/src/ai-pricing-sync-once.ts)
  ai-pricing-sync)
    ;;
  # Informes PDF mensuales programados (apps/worker/src/scheduled-reports-once.ts)
  scheduled-reports)
    ;;
  *)
    echo "Unknown worker job: ${job:-<missing>}" >&2
    exit 64
    ;;
esac

base_dir="/opt/e-nora"
lock_dir="$base_dir/.locks"
log_dir="$base_dir/logs"
mkdir -p "$lock_dir" "$log_dir"

exec 9>"$lock_dir/${job}.lock"
if ! flock -n 9; then
  echo "Skipping ${job}: previous execution is still running" >&2
  exit 0
fi

exec >>"$log_dir/${job}.log" 2>&1
echo "[$(date -Is)] starting ${job}"

# El override de build NO es opcional. Sin el, compose resuelve el worker desde
# docker-compose.prod.yml, o sea ghcr.io/...:${IMAGE_TAG}. Desde que se construye
# en el VPS esa imagen o no existe (el job no arranca) o es la del ultimo deploy
# por GHCR, y entonces el cron ejecuta codigo VIEJO mientras los contenedores
# largos sirven el nuevo. Las dos cosas pasaron el 2026-09-24.
if ! docker image inspect e-nora-worker:local >/dev/null 2>&1; then
  echo "Falta la imagen e-nora-worker:local; despliega con ops/vps/deploy.sh" >&2
  echo "[$(date -Is)] finished ${job} status=69"
  exit 69
fi

if docker compose --project-directory "$base_dir" \
    -f "$base_dir/docker-compose.prod.yml" \
    -f "$base_dir/docker-compose.build.yml" \
    run --rm --no-deps worker \
    node "apps/worker/dist/${job}-once.js"; then
  status=0
else
  status=$?
fi
echo "[$(date -Is)] finished ${job} status=${status}"
exit "$status"
