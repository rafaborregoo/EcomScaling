# BE-00 - Fundaciones API y worker

## Estado

- **Estado real:** `in_progress` (no `done`: faltan los Dockerfiles que el propio documento lista como entregable).
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** ninguna
- **Bloqueador:** ninguno
- **Evidencia:**
  - API Fastify con `GET /health`, logger JSON (`createLogger`), `genReqId` por request, CORS restrictivo
    y `@fastify/helmet` (`apps/api/src/server.ts`).
  - Worker BullMQ funcionando con cola `ecomscaling-default`, job repetible `shopify-reconcile` (cron
    diario 2am desde 2026-07-20) y `predev` que asegura Redis local (`scripts/ensure-redis.mjs`).
  - CI real: `.github/workflows/ci.yml` (lint/typecheck/tests/build).
  - `packages/config` valida env con Zod (`loadApiEnv`/`loadWorkerEnv`).
- **Gaps identificados:**
  - **No existe `apps/api/Dockerfile` ni `apps/worker/Dockerfile`** — el documento los lista como
    entregable cumplido y no lo estan; "API y worker pueden construirse como contenedores" no es
    verificable hoy.
  - Nota "Migraciones aplicadas en Supabase remoto" en el estado original es una plantilla copiada de los
    documentos de DB-XX — este es un documento de backend, no de esquema; era una senal de que el estado
    se copio mecanicamente sin revisar.
  - Sin diferenciacion liveness/readiness (`/health` es un unico endpoint plano).
  - Sin shutdown graceful documentado.
  - Sin definicion de proveedor de cola mas alla de BullMQ+Redis, reintentos/backoff/DLQ formales.
  - Sin healthcheck Docker, ni contenedores corriendo como usuario no root (no aplica hasta que existan
    los Dockerfiles).
  - Sin escaneo de dependencias/imagenes en CI.
  - Sin formato de error estandar ni correlation ID propagado end-to-end.
  - Sin metricas minimas de API/worker (solo logs).
- **Siguiente accion:** escribir `Dockerfile` para `apps/api` y `apps/worker` (no-root, healthcheck) antes
  de reclasificar a `done`.

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
