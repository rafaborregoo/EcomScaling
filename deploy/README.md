# Despliegue

- **web (Next.js)** -> Vercel. Push a `main` = deploy a produccion. Cada rama/PR = preview URL (entorno de pruebas gratis).
- **api + worker + redis** -> VPS IONOS (`194.164.161.151`) con Docker Compose. Detras de Caddy (`https://api.noraapp.es`, TLS automatico).
- **DB** -> Supabase (proyecto remoto).
- CI construye y publica imagenes en GHCR; el deploy entra por SSH y hace `docker compose pull && up -d`.

```
push a main -> CI (checks) -> Deploy: build imagenes -> GHCR -> SSH al VPS -> compose up
```

---

## 1. Bootstrap del VPS (una sola vez)

Desde tu maquina, en la raiz del repo:

```bash
scp deploy/bootstrap.sh deploy/docker-compose.prod.yml deploy/Caddyfile deploy/.env.production.example \
    deploy@194.164.161.151:/tmp/
ssh deploy@194.164.161.151 'sudo bash /tmp/bootstrap.sh'
```

Esto: hace backup de la app NORA en `/root/nora-*`, la borra, instala Docker, crea `/opt/ecomscaling`, abre 80/443 en el firewall.

Luego rellena las variables reales (SSH al VPS):

```bash
nano /opt/ecomscaling/.env.production
```

Minimo para arrancar: `WEB_ORIGIN` (dominio Vercel), `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SHOPIFY_API_KEY`, `SHOPIFY_API_SECRET`,
`INTERNAL_API_SECRET` (`openssl rand -hex 32`).

## 2. Clave SSH para el deploy

En tu maquina ya tienes `~/.ssh/id_ed25519` autorizada como `deploy`. Para GitHub Actions crea una
clave dedicada (no reutilices la personal):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/ecom_deploy_ci -N "" -C "github-actions-ecomscaling"
ssh deploy@194.164.161.151 "mkdir -p ~/.ssh && echo '$(cat ~/.ssh/ecom_deploy_ci.pub)' >> ~/.ssh/authorized_keys"
```

## 3. Secrets del repo en GitHub

`Settings -> Secrets and variables -> Actions -> New repository secret`:

| Secret | Valor |
|---|---|
| `DEPLOY_HOST` | `194.164.161.151` |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | contenido de `~/.ssh/ecom_deploy_ci` (la privada, entera) |
| `NEXT_PUBLIC_API_URL` | `https://api.noraapp.es` |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key de Supabase |

Los 3 `NEXT_PUBLIC_*` ya los usa `ci.yml` para el build de la web; si no estan, ese paso falla.

## 4. GHCR (registro de imagenes)

Usa `GITHUB_TOKEN`, no hace falta configurar nada. Solo, la primera vez, en
`github.com/rafaborregoo?tab=packages` -> cada paquete (`ecomscaling-api`, `ecomscaling-worker`) ->
`Package settings` -> conectar al repo y, si el VPS tira las imagenes de un paquete privado, ver punto 6.

## 5. Vercel (web)

- Importa el repo en Vercel. Root del proyecto: `apps/web` (o raiz con `Root Directory = apps/web`).
- Build command: `npm run build -w web`  ·  Install: `npm ci`  ·  Output: por defecto (Next.js).
- Env vars en Vercel (Production + Preview): `NEXT_PUBLIC_API_URL=https://api.noraapp.es`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `main` -> produccion. Ramas -> preview automatica.

## 6. Primer deploy

```bash
git add deploy .github/workflows/deploy.yml
git commit -m "chore(deploy): infra VPS + workflow push-to-prod"
git push
```

CI corre, y al terminar OK se dispara `Deploy`. Tambien manual: pestana **Actions -> Deploy -> Run workflow**.

El VPS necesita poder bajar las imagenes de GHCR. Si el repo es privado, en el VPS una vez:

```bash
echo "$GHCR_PAT" | docker login ghcr.io -u rafaborregoo --password-stdin
```

(`GHCR_PAT` = token classic con scope `read:packages`). Si el repo es publico, no hace falta.

## Operar

```bash
ssh deploy@194.164.161.151
cd /opt/ecomscaling
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api        # logs api
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml restart api
docker compose -f docker-compose.prod.yml exec redis redis-cli
```

Rollback a un commit anterior:

```bash
echo "IMAGE_TAG=<sha-anterior>" > .env
docker compose -f docker-compose.prod.yml up -d
```

## Staging (cuando haga falta, no ahora)

Segundo stack en el mismo VPS: `docker-compose.staging.yml` con otro `name:`, otro
`.env.production`, Caddy sirviendo `staging-api.noraapp.es`, y una rama `staging` que dispara
un `deploy-staging.yml`. Coste: ~20 min. No se monta hasta que un deploy malo lo justifique.
