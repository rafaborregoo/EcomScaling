# SQO-00 - Seguridad base

## Estado

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-20
- **Dependencias:** DB-02
- **Evidencia:** `apps/api/src/rls-tenant-isolation.test.ts` (11 casos), `.github/workflows/ci.yml`
  (job `secret-scan` con gitleaks), `@fastify/helmet`/`@fastify/cors` en `buildApp`, `loadApiEnv` (zod) en
  `packages/config`.
- **Lo que ya esta verificado con sesiones reales (no solo policies leidas)**: suite Node contra el
  Supabase remoto real, 2 organizaciones y 5 usuarios efimeros (owner org A, segundo owner org A, owner
  org B, consultor asignado solo a org A, platform_admin), sesiones firmadas con la publishable key,
  limpieza sin residuos verificada. Cubre aislamiento cross-tenant en `organizations`/`tasks`/`alerts`,
  visibilidad de salidas IA `pending_approval` por rol, privacidad de conversaciones del copiloto A09.
  CORS restrictivo, helmet, validacion de env con zod y gitleaks en CI, todos verificados en codigo real.
- **Por que `verification_pending` y no `done` — la cobertura es real pero pequeña frente a la superficie
  del sistema:**
  - Solo 3 dominios probados (`organizations`/`tasks`/`alerts`) de una lista mucho mas larga: configuracion
    financiera, conexiones/Shopify/Meta, llamadas, planes, conocimiento (RAG), agent runs, campañas, stock.
    Falta una matriz real SELECT/INSERT/UPDATE/DELETE x cross-tenant x rol por dominio, no solo por tabla.
  - **Ningun test de integridad referencial cross-tenant** (tarea de org A enlazada a alerta de org B,
    chunk de org A enlazado a documento de org B) — RLS bloquea lectura cruzada, pero no prueba que los FK
    tambien impidan crear una relacion invalida entre organizaciones distintas.
  - Sin tests de RPC/funciones `security definer`/vistas del schema `ai`/Storage — el SQL Gateway (AI-03)
    tiene su propia suite separada (28 tests), pero no esta enlazada aqui como parte de la matriz de
    seguridad general.
  - **Gitleaks cubre repo e historial, no logs en produccion** — no hay redaccion automatica confirmada en
    codigo (`grep -rn redact apps/api/src` no devuelve nada): sin garantia de que tokens, cookies o PII no
    terminen en logs.
  - **Sin rate limiting a nivel de endpoint** (`grep -rln rate.limit apps/api/src` solo encuentra manejo de
    rate limit de proveedores externos en `meta-client.ts`/`shopify-reconcile.ts`, no proteccion de
    endpoints propios caros como los de IA).
  - Sin threat model documentado (ver SQO-04 propuesto en el README de este dominio).
- **Siguiente accion:** ampliar la matriz de RLS a configuracion financiera y conexiones (los dominios con
  mas impacto si fallan) antes de sumar mas dominios de superficie menor.

## Entregables

- Matriz rol -> organizacion -> operacion.
- Secret scanning.
- CORS restrictivo.
- Security headers.
- Validacion de env.
- RLS en tablas expuestas.
- Bloqueo de `private` a navegador.

## Criterios de cierre

- Ningun secreto aparece en repo, logs o frontend.
- Tests A/B de tenant pasan.
