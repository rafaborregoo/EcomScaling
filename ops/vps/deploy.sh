#!/usr/bin/env bash
#
# Deploy de api + worker al VPS. Se ejecuta DESDE LA MAQUINA LOCAL, en la raiz
# del repo:  bash ops/vps/deploy.sh
#
# Existe porque desde 2b2ab70 (2026-09-24) no hay GitHub Actions: el codigo se
# copia al VPS y se construye alli. Los cuatro pasos que se olvidaban al hacerlo
# a mano y que este script no deja olvidar:
#   1. Verificar antes de subir -> es lo unico que queda de ci.yml. Nada roto
#      llega al VPS: si una comprobacion falla, no se despliega (ECOM_SKIP_CHECKS=1
#      lo fuerza a sabiendas). Ojo: corre sobre el arbol local, asi que NO ve lo
#      que un clon limpio veria (ficheros sin commitear que faltan en el commit).
#   2. IMAGE_TAG con el SHA real -> si no, agent_runs.deployment_version miente.
#   3. Sincronizar deploy/ y ops/vps/ -> el VPS y el repo se separan en silencio.
#   4. Construir en serie -> 1.6 GB de RAM no aguantan dos `tsc` a la vez.
#
set -Eeuo pipefail

host="${ECOM_SSH_HOST:-ecom}"
remote="/opt/ecomscaling"
compose="-f $remote/docker-compose.prod.yml -f $remote/docker-compose.build.yml"

cd "$(git rev-parse --show-toplevel)"

sha="$(git rev-parse HEAD)"
# Sin rsync se sube HEAD con git archive (paso 2): lo que llega al VPS es el
# commit exacto aunque el arbol tenga cambios ajenos sin commitear, asi que
# GIT_SHA dice la verdad y no hace falta exigir arbol limpio.
if command -v rsync >/dev/null 2>&1 && ! git diff-index --quiet HEAD --; then
  if [ "${ECOM_ALLOW_DIRTY:-0}" != "1" ]; then
    echo "ABORTADO: hay cambios sin commitear." >&2
    echo "El VPS debe correr codigo que exista en un commit, o GIT_SHA miente." >&2
    echo "Si aun asi quieres desplegar el arbol sucio: ECOM_ALLOW_DIRTY=1 $0" >&2
    exit 1
  fi
  sha="${sha}-dirty"
  echo "AVISO: desplegando un arbol sucio como ${sha}"
fi

log_dir="${TMPDIR:-/tmp}/ecomscaling-deploy"
mkdir -p "$log_dir"

if [ "${ECOM_SKIP_CHECKS:-0}" = "1" ]; then
  echo "==> 1/6 Verificacion SALTADA (ECOM_SKIP_CHECKS=1)"
else
  echo "==> 1/6 Verificacion (lo que comprobaba ci.yml, ahora en local)"
  for check in verify typecheck lint test; do
    printf '    npm run %-10s ' "$check"
    if npm run "$check" >"$log_dir/$check.log" 2>&1; then
      echo "ok"
    else
      echo "ROJO"
      {
        echo
        echo "ABORTADO: 'npm run $check' ha fallado; no se despliega nada."
        echo "Log completo: $log_dir/$check.log"
        echo "Ultimas lineas:"
        tail -25 "$log_dir/$check.log"
        echo
        echo "Si el rojo es de trabajo a medias ajeno y quieres desplegar igual:"
        echo "  ECOM_SKIP_CHECKS=1 $0"
      } >&2
      exit 1
    fi
  done
fi

echo "==> 2/6 Codigo -> $host:$remote/src  ($sha)"
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete \
    --exclude '.git' --exclude 'node_modules' --exclude 'dist' --exclude '.next' \
    --exclude 'conocimiento' --exclude 'docs' --exclude 'roadmap' \
    --exclude 'Agentes IA' --exclude 'Base de Datos' \
    --exclude '.claude' --exclude '.agents' --exclude '.codex' --exclude '.impeccable' \
    --exclude '*.bundle' \
    ./ "$host:$remote/src/"
else
  # Git Bash en Windows no trae rsync. git archive sube exactamente HEAD: lo
  # que no este commiteado no viaja.
  if ! git diff-index --quiet HEAD --; then
    echo "AVISO: hay cambios sin commitear; no se suben (se despliega HEAD $sha)."
  fi
  git archive --format=tar HEAD -- . \
    ':(exclude)conocimiento' ':(exclude)docs' ':(exclude)roadmap' \
    ':(exclude)Agentes IA' ':(exclude)Base de Datos' \
    | ssh "$host" "set -e; rm -rf $remote/src.next; mkdir -p $remote/src.next; \
        tar -x -C $remote/src.next; rm -rf $remote/src; mv $remote/src.next $remote/src"
fi

echo "==> 3/6 IMAGE_TAG=$sha"
# Ya no elige ninguna imagen: con el override de build todo es :local. Sirve solo
# para GIT_SHA -> agent_runs.deployment_version, y por eso tiene que ser cierto.
ssh "$host" "printf 'IMAGE_TAG=%s\n' '$sha' > $remote/.env"

echo "==> 4/6 Config del VPS: compose, cron y runner de jobs"
# Los compose van aqui porque run-worker-job.sh depende de docker-compose.build.yml
# en el VPS: si el repo lo cambia y el VPS no se entera, los 22 jobs del cron se
# caen sin que nadie lo vea hasta la madrugada siguiente.
scp deploy/docker-compose.prod.yml deploy/docker-compose.build.yml \
    ops/vps/run-worker-job.sh ops/vps/ecomscaling.crontab "$host:$remote/"
ssh "$host" "chmod 750 $remote/run-worker-job.sh && crontab $remote/ecomscaling.crontab"
# El Caddyfile no se sincroniza: cambiarlo exige recargar Caddy, que este script
# no toca. Se copia a mano y `docker compose restart caddy`.

echo "==> 5/6 Build (en serie: la RAM no da para los dos a la vez)"
ssh "$host" "docker compose $compose build api"
ssh "$host" "docker compose $compose build worker"

echo "==> 6/6 Arranque"
ssh "$host" "docker compose $compose up -d && docker compose $compose ps"

echo
echo "Desplegado $sha. Comprobar:"
echo "  curl -s https://api.ecomscaling.es/health"
echo "  ssh $host '$remote/run-worker-job.sh readiness; echo status=\$?'"
