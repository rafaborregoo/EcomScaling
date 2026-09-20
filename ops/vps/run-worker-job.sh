#!/usr/bin/env bash
set -Euo pipefail

job="${1:-}"
case "$job" in
  anomalies-red-flags|benchmark-confidence|conversion-cro-benchmarks|klaviyo-reconcile|meta-reconcile|offer-pricing-benchmarks|operations-cx-benchmarks|product-inventory-benchmarks|purge-expired-deletions|retention-crm-benchmarks|scalability-benchmarks|unit-economics-benchmarks)
    ;;
  *)
    echo "Unknown worker job: ${job:-<missing>}" >&2
    exit 64
    ;;
esac

base_dir="/opt/ecomscaling"
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
if docker compose --project-directory "$base_dir" \
    -f "$base_dir/docker-compose.prod.yml" \
    run --rm --no-deps worker \
    node "apps/worker/dist/${job}-once.js"; then
  status=0
else
  status=$?
fi
echo "[$(date -Is)] finished ${job} status=${status}"
exit "$status"
