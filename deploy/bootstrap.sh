#!/usr/bin/env bash
# Bootstrap del VPS (AlmaLinux 9). EJECUTAR UNA SOLA VEZ, como deploy con sudo:
#   scp deploy/bootstrap.sh deploy/docker-compose.prod.yml deploy/Caddyfile deploy/.env.production.example deploy@194.164.161.151:/tmp/
#   ssh deploy@194.164.161.151
#   sudo bash /tmp/bootstrap.sh
#
# Hace: backup + borra la app NORA, instala Docker, crea /opt/e-nora.
set -uo pipefail
TS=$(date +%Y%m%d-%H%M%S)

echo "############ 1/4  BACKUP + BORRADO DE NORA ############"
BK=/root/nora-wipe-backup-$TS
mkdir -p "$BK/nginx" "$BK/systemd" "$BK/env"
cp -a /etc/nginx/conf.d/. "$BK/nginx/" 2>/dev/null
cp -a /etc/systemd/system/nora*.service "$BK/systemd/" 2>/dev/null
cp -a /opt/nora/.env* "$BK/env/" 2>/dev/null
cp -a /opt/nora/app/apps/saas/.env.production "$BK/env/saas.env.production" 2>/dev/null
cp -a /opt/nora/runtime/nora-api.env "$BK/env/nora-api.env" 2>/dev/null
crontab -l -u deploy > "$BK/deploy.crontab" 2>/dev/null
tar czf /root/nora-home-$TS.tar.gz -C /home nora 2>/dev/null
tar czf /root/nora-meta-$TS.tar.gz -C /root "nora-wipe-backup-$TS" 2>/dev/null
ls -la /root/nora-*-$TS* || true

for s in nora-api nora-saas nora; do
  systemctl disable --now "$s.service" 2>&1 | sed 's/^/   /'
  rm -f "/etc/systemd/system/$s.service"
done
systemctl daemon-reload; systemctl reset-failed 2>/dev/null || true
crontab -r -u deploy 2>/dev/null && echo "   crontab deploy borrado" || echo "   sin crontab deploy"
pkill -f 'start-nora-api|packages/api/src/server.js|next start -p 3200|gunicorn.*server:app' 2>/dev/null || true
sleep 1
rm -f /etc/nginx/conf.d/nora.conf /etc/nginx/conf.d/nora.conf.bak* \
      /etc/nginx/conf.d/nora-noindex-map.conf \
      /etc/nginx/conf.d/api.noraapp.es.conf \
      /etc/nginx/conf.d/00_default_deny.conf
# nginx del host se apaga: Caddy (contenedor) se queda con 80/443
systemctl disable --now nginx 2>&1 | sed 's/^/   /' || true
rm -rf /opt/nora
pkill -u nora 2>/dev/null || true; sleep 1
userdel -r nora 2>&1 | sed 's/^/   /' || true
rm -rf /home/deploy/.npm /home/deploy/.cache /home/deploy/.esmtp_queue \
       /home/deploy/__pycache__ /home/deploy/.config /home/deploy/.pki "/home/deploy/ç" 2>/dev/null

echo "############ 2/4  DOCKER ############"
if ! command -v docker >/dev/null; then
  dnf -y install dnf-plugins-core
  dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker
usermod -aG docker deploy
docker --version
docker compose version

echo "############ 3/4  /opt/e-nora ############"
install -d -o deploy -g deploy /opt/e-nora
for f in docker-compose.prod.yml Caddyfile .env.production.example; do
  [ -f "/tmp/$f" ] && install -o deploy -g deploy -m 0644 "/tmp/$f" "/opt/e-nora/$f"
done
if [ ! -f /opt/e-nora/.env.production ]; then
  install -o deploy -g deploy -m 0600 /opt/e-nora/.env.production.example /opt/e-nora/.env.production
  echo "   -> creado /opt/e-nora/.env.production (RELLENA los valores reales)"
fi

echo "############ 4/4  FIREWALL ############"
if systemctl is-active --quiet firewalld; then
  firewall-cmd --permanent --add-service=http --add-service=https
  # RHEL9 + Docker: sin masquerade en la zona public, firewalld corta el
  # reenvio a los puertos publicados de los contenedores.
  firewall-cmd --permanent --zone=public --add-masquerade
  firewall-cmd --reload
  systemctl restart docker
fi

echo
echo "LISTO. Siguiente:"
echo "  1) nano /opt/e-nora/.env.production   (valores reales de Supabase, Shopify, WEB_ORIGIN)"
echo "  2) Configura los secrets del repo en GitHub (ver deploy/README.md)"
echo "  3) git push a main  ->  se despliega solo"
echo "  Backups de NORA en /root/nora-*-$TS*"
