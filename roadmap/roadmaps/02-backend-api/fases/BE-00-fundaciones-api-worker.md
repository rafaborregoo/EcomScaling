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
  hook `onClose` en `buildApp()` que lo desconecta explicitamente; confirmado que el test ahora cierra
  limpio. Sigue sin documentar/probar la señal `SIGTERM` en si (drenar requests en vuelo antes de cerrar
  el listener HTTP) -- este fix es sobre el `Redis` handle especifico que se encontro colgado, no una
  auditoria completa de shutdown.
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
