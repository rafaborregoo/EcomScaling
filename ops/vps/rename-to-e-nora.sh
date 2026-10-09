#!/usr/bin/env bash
# Renombra el stack de produccion ecomscaling -> e-nora (proyecto compose, volumenes,
# imagenes locales). El directorio /opt/ecomscaling NO se mueve: requiere sudo.
set -Eeuo pipefail
cd /opt/ecomscaling
ts="$(date +%Y%m%d-%H%M%S)"
SERVICES="redis api worker caddy"

if docker ps --format '{{.Names}}' | grep -q 'worker-run'; then
  echo "ABORTO: hay un job del worker en marcha; reintenta cuando acabe" >&2
  exit 3
fi

echo "==> 1. copias de seguridad"
cp -p docker-compose.prod.yml "docker-compose.prod.yml.bak-ecomscaling-$ts"
cp -p docker-compose.build.yml "docker-compose.build.yml.bak-ecomscaling-$ts"
cp -p run-worker-job.sh "run-worker-job.sh.bak-ecomscaling-$ts"
crontab -l > "crontab.bak-$ts"
OLD="docker compose -f docker-compose.prod.yml.bak-ecomscaling-$ts -f docker-compose.build.yml.bak-ecomscaling-$ts"
NEW="docker compose -f docker-compose.prod.yml -f docker-compose.build.yml"

echo "==> 2. ficheros nuevos"
sed -i 's/^name: ecomscaling/name: e-nora/' docker-compose.prod.yml
sed -i 's/ecomscaling-\(api\|worker\|email-renderer\):local/e-nora-\1:local/' docker-compose.build.yml
sed -i 's/ecomscaling-worker:local/e-nora-worker:local/g' run-worker-job.sh
docker tag ecomscaling-api:local e-nora-api:local
docker tag ecomscaling-worker:local e-nora-worker:local
$NEW config -q

rollback() {
  echo "!! FALLO: volviendo al stack anterior" >&2
  $NEW down 2>/dev/null || true
  cp -p "docker-compose.prod.yml.bak-ecomscaling-$ts" docker-compose.prod.yml
  cp -p "docker-compose.build.yml.bak-ecomscaling-$ts" docker-compose.build.yml
  cp -p "run-worker-job.sh.bak-ecomscaling-$ts" run-worker-job.sh
  $OLD up -d $SERVICES
}
trap rollback ERR

echo "==> 3. crear contenedores y volumenes del proyecto e-nora (sin arrancar)"
$NEW up --no-start $SERVICES

echo "==> 4. parar el stack anterior (los volumenes se conservan)"
$OLD down

echo "==> 5. copiar datos a los volumenes nuevos"
for v in caddy-data caddy-config redis-data email-render-spool; do
  docker run --rm -v "ecomscaling_$v:/from:ro" -v "e-nora_$v:/to" node:24-alpine sh -c 'cp -a /from/. /to/'
  echo "   $v ok"
done

echo "==> 6. arrancar e-nora"
$NEW up -d $SERVICES

echo "==> 7. esperar a que la API este sana"
for i in $(seq 1 36); do
  status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' e-nora-api-1 2>/dev/null || echo missing)"
  [ "$status" = "healthy" ] && break
  sleep 5
done
[ "$status" = "healthy" ] || { echo "API no sana: $status" >&2; false; }
curl -fsS http://127.0.0.1:4000/health | head -c 300; echo
trap - ERR
docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
echo "OK"
