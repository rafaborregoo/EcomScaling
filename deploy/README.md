# Despliegue

- **web (Next.js)** -> Vercel. Push a `main` = deploy a produccion. Cada rama/PR = preview URL.
- **api + worker + redis** -> VPS IONOS (`194.164.161.151`) con Docker Compose. Detras de Caddy
  (`https://api.ecom.noraapp.es`, TLS automatico; `dashboard.ecomscaling.es`/`api.ecomscaling.es`
  se retiran). Alias SSH: `ssh ecom` (usuario `deploy`).
- **DB** -> Supabase (proyecto remoto).

**No hay GitHub Actions.** Los workflows se borraron en `2b2ab70` (la cuenta tenia los pagos
fallidos y ningun job arrancaba). El build de api/worker se hace en el propio VPS y lo periodico
vive en el crontab del sistema y dentro del worker.

```
bash ops/vps/deploy.sh  ->  verificacion en local  ->  rsync a /opt/e-nora/src  ->  build en el VPS  ->  up -d
```

---

## Que corre donde (verificado 2026-09-24)

### 1. Crontab del sistema (usuario `deploy`, reloj del VPS en UTC)

`crontab -l` en el VPS; fuente de verdad versionada en
[../ops/vps/e-nora.crontab](../ops/vps/e-nora.crontab), que `deploy.sh` reinstala en cada
despliegue. Cada linea llama a `/opt/e-nora/run-worker-job.sh <job>`, que toma un `flock` por
job, lanza `docker compose run --rm --no-deps worker node apps/worker/dist/<job>-once.js` y escribe
en `/opt/e-nora/logs/<job>.log`. **22 jobs**:

| Bloque | Jobs | Cuando (UTC) |
|---|---|---|
| Integraciones y mantenimiento | `ai-pricing-sync` (tarifa de modelos desde LiteLLM); `purge-expired-deletions` corre en BullMQ dentro del worker | 0:40 |
| Cadena nocturna F3 -> F7 | `nightly-chain`: los 57 motores de diagnostico, playbooks y recomendacion, en orden y en serie ([nightly-chain-once.ts](../apps/worker/src/nightly-chain-once.ts)) | 1:00 |
| Benchmarks por dimension | `conversion-cro`, `offer-pricing`, `retention-crm`, `unit-economics`, `operations-cx`, `product-inventory`, `scalability` | 3:35 -> 4:50 |
| Lectura transversal | `anomalies-red-flags`, `benchmark-confidence` | 5:05, 5:20 |
| F7 recomendacion | `expected-outcome`, `recommendation-confidence`, `recommendation-communication` | 5:35, 5:50, 6:05 |
| F8 ejecucion | `execution-plan`, `readiness`, `hitl-approval`, `closure-handoff` | 6:20, 6:35, 6:50, 7:05 |
| F8/F9 continuos | `action-envelope`, `execution-supervision`, `continuous-learning` | cada hora a :12, :27, :57 |

Los minutos no se eligen al azar: el VPS tiene 1.6 GB y cada job levanta su propio contenedor, asi
que no deben coincidir dos. El `flock` cubre lo otro (que un job se solape consigo mismo).

`run-worker-job.sh` tiene dos guardas, y las dos importan:

- **Lista blanca de jobs**: uno que no este ahi sale con codigo 64 sin ejecutar nada, aunque lo
  pongas en el crontab. Job nuevo = las dos cosas.
- **Invoca compose con los dos ficheros** (`prod` + `build`), y aborta con codigo 69 si falta la
  imagen `e-nora-worker:local` en vez de ponerse a construirla en plena madrugada. Sin el
  override, compose resuelve el worker desde `docker-compose.prod.yml`, o sea
  `ghcr.io/...:${IMAGE_TAG}`. Eso ya mordio dos veces el 2026-09-24: con un `IMAGE_TAG` que existia
  en GHCR, **los 22 jobs corrieron durante dias codigo 5 commits mas viejo** que el de los
  contenedores largos, sin un solo error; y al corregir `IMAGE_TAG` al SHA real, que no esta
  publicado en GHCR, los 22 dejaron de arrancar (`status=1`, "not found").
### 2. Dentro del worker (BullMQ repeatable)

Los registra `apps/worker/src/repeatable-jobs.ts` al arrancar el contenedor; no dependen del cron
del sistema y se ejecutan igual en local. Incluyen `meta-reconcile` (cada 10 minutos UTC),
`klaviyo-reconcile` (cada 15 minutos UTC), `shopify-reconcile` (cada 15 minutos),
`fathom-webhook-processing` (cada minuto), `webhook-retention` (3:30), `ai-context-retention`
(3:45), `ai-diagnostics-tick` (6:00 y 15:00) e `instagram-image-queue` (cada minuto).

El consumidor de webhooks de Shopify/Klaviyo tiene cola propia y recuperación cada 5 segundos.
Meta y Klaviyo usan consumidores separados; una importación de Klaviyo no ocupa los de Meta.
`integration-health` revisa exclusivamente conexiones y eventos pendientes cada 5 minutos y
registra incidencias en el worker. No reactiva la auditoría general `ops-health-check` apagada.
Configurar `INTEGRATION_WEBHOOK_BASE_URL` con el HTTPS público de la API. Para el despliegue,
aplicar primero `20261026080914_integration_event_delivery.sql` y después reiniciar API/worker.
Klaviyo funciona por consulta periódica; habilitar `KLAVIYO_SYSTEM_WEBHOOKS_ENABLED=true` solo
si la cuenta/aplicación tiene acceso al Webhooks API y los scopes correspondientes.

Meta y Klaviyo vuelven a intentar automáticamente los fallos temporales. Si el error indica que
caducó el token o faltan permisos, se pausa ese intento hasta que alguien reconecte la cuenta; el
panel de Integraciones muestra ese estado para evitar reintentos ruidosos que no pueden resolverlo.

### 3. La verificacion (lo que era `ci.yml`)

No corre en GitHub ni en el VPS: corre **en local, como puerta del deploy**. `ops/vps/deploy.sh`
ejecuta antes de subir nada y aborta al primer rojo:

| Comando | Que cubre |
|---|---|
| `npm run verify` | las 17 guardas `scripts/assert-*.mjs` (RLS, migraciones idempotentes, search_path, superficie de tests, enlaces markdown...) |
| `npm run typecheck` | `tsc --noEmit` en packages, api, web y worker |
| `npm run lint` | idem + ESLint de la web |
| `npm test` | la suite de todos los workspaces |

`ECOM_SKIP_CHECKS=1 bash ops/vps/deploy.sh` se la salta a sabiendas.

Por que aqui y no en un runner del VPS: los minutos de un runner self-hosted serian gratis, pero
1.6 GB ya necesitan swap para un solo `tsc` (de ahi el `--max-old-space-size=2048` del Dockerfile)
y la verificacion competiria con la API en produccion.

**Lo que esta puerta no puede ver**: corre sobre el arbol de trabajo, no sobre un clon limpio. Un
fichero sin commitear que la build necesita pasa la puerta aqui y revienta en cualquier otro sitio.
Eso solo lo caza un CI sobre un checkout limpio. Si se recupera GitHub Actions, que sea **solo**
`ci.yml` (push a main + PR, sin ningun `schedule`): a ~3 commits/dia son del orden de 700 min/mes
de los 2000 del plan. Lo que reventaba la cuota no era CI, eran los 3 workflows **horarios**
(`action-envelope`, `execution-supervision`, `continuous-learning`, ~2190 ejecuciones/mes), que
ahora estan en el crontab del VPS y no cuestan nada.

### 4. Lo que no corre, y no es un olvido

Distinguirlo importa, porque lo primero hay que taparlo y lo segundo no hay que "arreglarlo":

- **Motores de F3**: apagados el 2026-08-03 y reactivados el 2026-09-24 por decision tuya, dentro
  de `nightly-chain` (Meta se reconcilia a las 0:17 para que la cadena lea el gasto de ayer).
- **Apagado por decision tuya del 2026-08-03**, escrito en la cabecera de cada workflow borrado
  (`git show 2b2ab70^:.github/workflows/<x>.yml`): `agent-evals`, `alert-rules`,
  `memory-ingestion` y `ops-health-check`. Tienen su `<job>-once.js` en la imagen; programarlos
  exige anadirlos a la lista blanca. **No los programes sin preguntar.**
- **Backup de base de datos**: `backup-database.yml` tambien tenia el cron comentado de antes. Lo
  unico que hay es el backup propio de Supabase. Esto si es una decision pendiente.
- **Verificacion sobre un clon limpio**: la puerta del punto 3 corre en tu arbol, no en un checkout
  limpio.

Lo que si fue un olvido —los 10 jobs de F7/F8/F9 que quedaron sin programar al borrar Actions— esta
resuelto: estan en la tabla del punto 1 desde el 2026-09-24.

### 5. `GIT_SHA` / `IMAGE_TAG`: que etiqueta que

`IMAGE_TAG` (en `/opt/e-nora/.env`) **ya no elige ninguna imagen**: desde que se construye en
el VPS, tanto los contenedores largos como los jobs del cron usan `:local` via
`docker-compose.build.yml`. Su unico trabajo es alimentar `GIT_SHA` ->
`agent_runs.deployment_version`, y precisamente por eso tiene que ser cierto: si no, la
observabilidad atribuye el comportamiento de produccion a un commit que no es.

`deploy.sh` lo escribe con el SHA de `HEAD` en cada despliegue y aborta si el arbol esta sucio
(`ECOM_ALLOW_DIRTY=1` lo fuerza y etiqueta `<sha>-dirty`).

No conviene dejarlo apuntando a una etiqueta que **si** exista en GHCR: cualquier `compose` que se
invoque sin el override bajaria esa imagen y correria codigo viejo en silencio, que es exactamente
como el cron estuvo desactualizado sin que se notara.

Para comprobar que lo desplegado es de verdad un commit —`/opt/e-nora/src` no es un clon de
git, no se puede preguntar alli— se comparan los blobs. Ojo: la copia del VPS tiene CRLF, hay que
normalizar o todo parece distinto:

```bash
git ls-tree -r HEAD --format='%(objectname) %(path)' -- apps/api/src apps/worker/src packages \
  | sort > /tmp/head.txt
ssh ecom 'cd /opt/e-nora/src && find apps/api/src apps/worker/src packages -type f \
  ! -path "*/node_modules/*" -print0 | xargs -0 -P4 -n1 sh -c \
  '"'"'printf "%s %s\n" "$(sed "s/\r$//" "$1" | git hash-object --stdin)" "$1"'"'"' _' \
  | sort | diff /tmp/head.txt -
```

## Deploy de api/worker

```bash
bash ops/vps/deploy.sh          # desde la raiz del repo, en local
```

[../ops/vps/deploy.sh](../ops/vps/deploy.sh) hace los 6 pasos en orden: **verificacion** (punto 3),
rsync del codigo a `/opt/e-nora/src`, `IMAGE_TAG` con el SHA de `HEAD`, sincronizar `ops/vps/`
+ reinstalar el crontab, `build api` y `build worker` **en serie** (1.6 GB no aguantan dos `tsc` a
la vez) y `up -d`.

Aborta en dos sitios: si hay cambios sin commitear (`ECOM_ALLOW_DIRTY=1` lo fuerza y etiqueta el
SHA como `<sha>-dirty`) y si una comprobacion sale roja (`ECOM_SKIP_CHECKS=1`).

`/opt/e-nora/src` es una **copia del arbol, no un clon de git** (no tiene `.git`), y llega con
CRLF: para los `.ts` da igual, pero tenlo en cuenta al comparar hashes (punto 5).

A mano, si hace falta desviarse del script:

```bash
ssh ecom
cd /opt/e-nora
docker compose -f docker-compose.prod.yml -f docker-compose.build.yml up -d --build
```

Sin el `-f docker-compose.build.yml` el compose intentara bajar las imagenes de GHCR por
`IMAGE_TAG`, que es justamente lo que ya no se publica.

## Bootstrap del VPS (una sola vez, ya hecho)

```bash
scp deploy/bootstrap.sh deploy/docker-compose.prod.yml deploy/Caddyfile deploy/.env.production.example \
    ecom:/tmp/
ssh ecom 'sudo bash /tmp/bootstrap.sh'
```

Instala Docker, crea `/opt/e-nora` y abre 80/443. Las variables reales van en
`/opt/e-nora/.env.production` (minimo: `WEB_ORIGIN`, `SUPABASE_URL`,
`SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SHOPIFY_API_KEY`,
`SHOPIFY_API_SECRET`, `INTERNAL_API_SECRET`).

## Vercel (web)

- Root Directory: `apps/web`. Build: `npm run build -w web`. Install: `npm ci`.
- Env vars (Production + Preview): `NEXT_PUBLIC_API_URL=https://api.ecom.noraapp.es`,
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `main` -> produccion. Ramas -> preview automatica.

## Operar

```bash
ssh ecom
cd /opt/e-nora
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker
crontab -l

# ultimo resultado de cada job del crontab
for f in logs/*.log; do printf '%-32s %s\n' "$(basename "$f" .log)" "$(grep finished "$f" | tail -1)"; done

# lanzar un job a mano (respeta el flock y escribe en su log)
./run-worker-job.sh readiness; echo "status=$?"
tail -20 logs/readiness.log
```

Rollback: no hay imagenes etiquetadas por commit desde que se construye en el VPS. Se vuelve atras
con `git checkout <sha>` en local y `bash ops/vps/deploy.sh` (que reconstruye desde ese codigo).

## Staging (cuando haga falta, no ahora)

Segundo stack en el mismo VPS: `docker-compose.staging.yml` con otro `name:`, otro
`.env.production` y Caddy sirviendo `staging-api.ecom.noraapp.es`. No se monta hasta que un deploy
malo lo justifique.
