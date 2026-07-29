# BE-00 - Fundaciones API y worker

## Estado

- **Estado real:** `in_progress` (no `done`: faltan los Dockerfiles que el propio documento lista como entregable).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
- **Dependencias:** ninguna
- **Bloqueador:** ninguno
- **Evidencia:**
  - API Fastify con `GET /health`, logger JSON (`createLogger`), `genReqId` por request, CORS restrictivo
    y `@fastify/helmet` (`apps/api/src/server.ts`).
  - Worker BullMQ funcionando con cola `ecomscaling-default`, job repetible `shopify-reconcile` (cron
    diario 2am desde 2026-07-20) y `predev` que asegura Redis local (`scripts/ensure-redis.mjs`).
  - CI real: `.github/workflows/ci.yml` (lint/typecheck/tests/build).
  - `packages/config` valida env con Zod (`loadApiEnv`/`loadWorkerEnv`).
- **Dockerfiles anadidos 2026-07-22**: `apps/api/Dockerfile` y `apps/worker/Dockerfile`, build multi-stage
  desde la raiz del monorepo (`docker build -f apps/api/Dockerfile .`), usuario no-root (`ecomscaling`),
  `HEALTHCHECK` nativo (`/health` para la API, ping a Redis via `ioredis` para el worker), `npm prune --omit=dev`
  en la imagen final. **Sin build-test real**: este entorno no tiene Docker instalada (mismo bloqueador que
  Q-007/DB-02, sin Docker Desktop/WSL2), asi que estos Dockerfiles estan escritos siguiendo la estructura
  real de los workspaces (`npm ci` necesita el `package.json` de cada workspace, incluido `apps/web`, aunque
  no se use, porque el lockfile lo referencia) pero no se han construido de verdad. Rafa deberia correr
  `docker build` una vez antes de confiar en ellos para despliegue.
- **Resuelto 2026-07-23 (liveness/readiness)**: `/health` (y su alias nuevo `/health/live`) siguen siendo
  liveness pura -- responde `ok` sin tocar ninguna dependencia, es la senal de "reiniciar el proceso
  arreglaria esto". `/health/ready` es nuevo y si toca dependencias reales: pinga `GET /auth/v1/health` de
  GoTrue (el health endpoint nativo de Supabase Auth, sin tocar tablas de negocio ni RLS) y hace `PING` a
  Redis si `REDIS_URL` esta configurado, cada uno con timeout de 3s. Devuelve 503 + `status: "degraded"` si
  cualquiera falla, 200 + `status: "ok"` si ambos pasan -- es la senal de "sacar esta instancia del pool de
  balanceo", distinta de reiniciarla. Verificado en vivo contra el dev server real (los 3 endpoints
  responden 200 con Supabase/Redis reales) y contra un escenario forzado de fallo (host de Supabase
  inexistente + Redis inalcanzable, ambos checks devuelven `error` en ~230ms, dentro del timeout). El
  `HEALTHCHECK` de `apps/api/Dockerfile` sigue apuntando a `/health` sin cambios -- es exactamente la
  semantica de liveness que un healthcheck de Docker necesita. Contrato tipado en
  `@ecomscaling/contracts` (`readinessResponseSchema`).
- **Resuelto parcialmente 2026-07-23 (shutdown graceful)**: encontrado un bug real escribiendo el test de
  BE-01 de organizacion manipulada (`be-01-cross-tenant-route-manipulation.test.ts`) -- `app.close()` se
  colgaba indefinidamente porque el cliente Redis que `server.ts` le pasa a `@fastify/rate-limit` nunca se
  desconectaba (ese plugin asume que un cliente externo se administra fuera de Fastify). Corregido con un
  hook `onClose` en `buildApp()` que lo desconecta explicitamente. Sigue sin documentar/probar la señal
  `SIGTERM` en si (drenar requests en vuelo antes de cerrar el listener HTTP) -- este fix es sobre el
  `Redis` handle especifico que se encontro colgado, no una auditoria completa de shutdown.
  - **Reabierto y vuelto a cerrar 2026-07-29**: el mismo cuelgue reaparecio (encontrado corriendo la suite
    completa de `apps/api` mientras se verificaba Q-012) -- el fix de 2026-07-23 (`onClose` +
    `rateLimitRedis.disconnect()`) no era suficiente: si `disconnect()` corre mientras la conexion inicial
    de Redis todavia se esta estableciendo, ioredis puede dejar un intento de reconexion en curso que abre
    un socket *despues* del `disconnect()`, confirmado con diagnostico real
    (`process._getActiveHandles()` mostraba sockets huerfanos incluso mucho despues de que `app.close()` ya
    hubiera resuelto). Se probo `retryStrategy: () => null` en el cliente de rate-limit (mismo patron que
    ya usaba `redis-cache.ts`) -- ayuda pero no elimina el problema del todo en todos los casos. **Mitigacion
    real aplicada**: `--test-force-exit` (flag nativo de `node --test` desde Node 22) anadido al script
    `test` de `apps/api`, que fuerza al test runner a salir tras completar todos los tests/hooks sin
    esperar a que el event loop drene solo -- es el mismo patron que recomienda la propia documentacion de
    Node para librerias de terceros con handles que no se cierran perfectamente. Confirmado con el archivo
    que colgaba (30/30 tests, cierre limpio) y con la suite completa. Esto resuelve el sintoma en CI/tests;
    la causa raiz (comportamiento exacto de ioredis en la carrera connect/disconnect) sigue sin
    caracterizarse del todo -- no bloqueante para produccion (el proceso de la API real nunca llama
    `app.close()` fuera de un shutdown real, donde unos segundos extra de socket colgado no importan).
  - **Cerrado 2026-07-29 (manejo real de SIGTERM/SIGINT)**: `server.ts` no tenia ningun `process.on("SIGTERM"|"SIGINT", ...)`
    -- confirmado por grep, cero coincidencias antes de este cambio. Anadido `createShutdownHandler`
    (exportado, logica pura inyectable) + `registerGracefulShutdown` (lo cablea a los signals reales):
    al recibir la senal, deja de aceptar conexiones nuevas y espera a que las existentes terminen via
    `app.close()` de Fastify (que tambien corre los hooks `onClose` ya registrados, incluido el
    `rateLimitRedis.disconnect()` de arriba), y solo entonces sale con codigo 0. Timeout de seguridad de
    10s que fuerza `exit(1)` si `close()` no resuelve -- justificado directamente por el hallazgo de arriba
    (un `app.close()` colgado no debe dejar el proceso zombie esperando un SIGKILL del orquestador). 4 tests
    unitarios puros (timeout, rechazo, guard de senal duplicada, cierre normal) mas un test de extremo a
    extremo con un proceso hijo real enviandole SIGTERM -- este ultimo se salta en Windows (confirmado en
    este mismo entorno: `child.kill("SIGTERM")` en Windows mata el proceso a la fuerza sin invocar el
    manejador, no es un SIGTERM real) pero corre de verdad en CI (`ubuntu-latest`) y en produccion (Linux),
    que es donde el comportamiento real importa.
  - Sin definicion de proveedor de cola mas alla de BullMQ+Redis, reintentos/backoff/DLQ formales.
  - Sin escaneo de dependencias/imagenes en CI.
  - Sin formato de error estandar ni correlation ID propagado end-to-end.
  - Sin metricas minimas de API/worker (solo logs).
- **Siguiente accion:** que Rafa confirme que ambos Dockerfiles construyen y arrancan de verdad
  (`docker build` y `docker run` contra `.env.local`) antes de reclasificar a `done`.

## Objetivo

Tener procesos arrancables y verificables antes de implementar negocio.

## Entregables

- API Fastify con healthcheck.
- Env schema tipado.
- Error handler y catalogo inicial de errores.
- Request ID y logging JSON.
- Middleware JWT Supabase basico.
- Worker con cola, healthcheck y job de prueba idempotente.
- Dockerfile para `apps/api`.
- Dockerfile para `apps/worker`.
- Imagenes preparadas para despliegue en servicio persistente.

## Criterios de cierre

- API y worker arrancan localmente.
- CI ejecuta lint, typecheck, tests y build.
- No hay secretos en logs ni frontend.
- API y worker pueden construirse como contenedores sin depender de archivos fuera del monorepo.
