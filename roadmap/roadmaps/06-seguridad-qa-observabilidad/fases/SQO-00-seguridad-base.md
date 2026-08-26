# SQO-00 - Seguridad base

## Estado

> Verificacion vigente 2026-08-24: los controles base de seguridad estan
> implementados (RLS/tenant, private schema, headers, CORS, redaccion,
> rate-limit, secret scan y tests). El estado sigue pendiente de matriz
> exhaustiva por operacion/rol y de Redis gestionado para multi-instancia;
> ninguno es un bypass conocido del piloto Shopify.

- **Estado real:** `verification_pending`
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** DB-02
- **Evidencia:** `apps/api/src/rls-tenant-isolation.test.ts` (19 casos), `.github/workflows/ci.yml`
  (job `secret-scan` con gitleaks), `@fastify/helmet`/`@fastify/cors` en `buildApp`, `loadApiEnv` (zod) en
  `packages/config`. **Ampliada 2026-07-22** con 4 archivos de test nuevos, tambien contra Supabase remoto
  real: `db-00-private-schema-permissions.test.ts` (3 casos: anon y usuario autenticado normal no pueden
  leer `private`, service_role si puede — confirma que el aislamiento es de rol), `db-04-webhook-idempotency.test.ts`
  (2 webhooks identicos concurrentes se procesan una sola vez), `db-11-knowledge-search-isolation.test.ts`
  (`knowledge_search` no filtra conocimiento privado de otra organizacion, si el de la propia),
  `be-07-sql-gateway-tenant-isolation.test.ts` (2 casos: `agent_sql_gateway` con `target_organization_id=A`
  nunca devuelve datos de B ni siquiera pidiendolos por id explicito). Total real: 60 tests en
  `apps/api` (no 39), verificado históricamente con `test:remote` en un proyecto aislado.
  La suite mutable no se ejecuta contra producción.
- **Lo que ya esta verificado con sesiones reales (no solo policies leidas)**: suite Node contra el
  Supabase remoto real, 2 organizaciones y 5 usuarios efimeros (owner org A, segundo owner org A, owner
  org B, consultor asignado solo a org A, platform_admin), sesiones firmadas con la publishable key,
  limpieza sin residuos verificada. Cubre aislamiento cross-tenant en `organizations`/`tasks`/`alerts`,
  visibilidad de salidas IA `pending_approval` por rol, privacidad de conversaciones del copiloto A09,
  aislamiento del schema `private` por rol, idempotencia de webhooks, aislamiento cross-tenant del RAG
  (`knowledge_search`) y del SQL Gateway a nivel de RPC (`agent_sql_gateway`) — este ultimo cierra
  parcialmente el gap de "sin tests de RPC" que esta seccion senalaba antes de 2026-07-22.
  CORS restrictivo, helmet, validacion de env con zod y gitleaks en CI, todos verificados en codigo real.
- **Por que `verification_pending` y no `done` — la cobertura crecio pero sigue siendo pequeña frente a la
  superficie del sistema:**
  - Dominios probados: `organizations`/`tasks`/`alerts`, schema `private` (permisos de rol), webhooks
    (idempotencia), RAG (`knowledge_search`), SQL Gateway (RPC), configuracion financiera, conexiones
    Shopify/integraciones, planes estrategicos. **Cerrado 2026-07-27**: llamadas y agent runs como
    dominios propios ya tienen 3 tests cross-tenant dedicados en `rls-tenant-isolation.test.ts`
    (verificados contra Supabase remoto real en un proyecto aislado, `test:remote`, 108/108 pasan):
    `agent_runs` ajeno no visible cross-tenant, `agent_outputs` ajeno no visible cross-tenant
    (independiente de su `status`), `consulting_calls`/`call_transcripts` ajenos no visibles cross-tenant.
    Sigue faltando: campañas, stock (dominios sin tablas propias todavia, ver INT-02/BE-06). Falta una
    matriz real SELECT/INSERT/UPDATE/DELETE x cross-tenant x rol por dominio, no solo por tabla.
  - **Integridad referencial cross-tenant, auditada 2026-07-22** (no solo listada como gap): revisados los
    endpoints que escriben una fila ligada a otra entidad ajena (`addTaskComment`, `saveTranscript`,
    actualizaciones de `consulting_calls`/`call_ai_summaries`) — todos validan la propiedad de la entidad
    referenciada en Node antes de escribir (`.eq("id", X).eq("organization_id", organizationId)` previo al
    insert), no solo confian en RLS. El unico caso real de un FK secundario embebido en un payload
    (`tasks.alert_id`) ya tiene ademas un trigger de base de datos (`enforce_task_alert_same_org`, DB-02) y
    esta testeado. No se encontraron endpoints cliente-alcanzables sin esta proteccion; el gap era mas de
    "no verificado" que de "no protegido".
  - Sin tests de vistas del schema `ai` ni de Storage. El SQL Gateway (AI-03) ya tiene cobertura de RPC
    tanto en su propia suite (28 tests en `sql-gateway.test.ts`, validador AST) como en `be-07-...test.ts`
    (aislamiento tenant end-to-end via RPC real, ver arriba).
  - **Redaccion de logs anadida 2026-07-20** (ver SQO-02): el logger de Fastify (`apps/api/src/server.ts`)
    ahora tiene `redact` explicito para `authorization`/`cookie`/`access_token`/`refresh_token`/
    `client_secret`/`api_key`/`service_role_key`, verificado en vivo — cierra el gap que decia esta
    seccion antes.
  - **Rate limiting anadido 2026-07-22** (`@fastify/rate-limit`, `apps/api/src/server.ts`): limite global
    de 120 req/min como red de seguridad basica, mas limite estricto de 10 req/min **por organizacion**
    (no por IP, para no penalizar oficinas que comparten IP) en los 6 endpoints caros de IA
    (`ai/monitor-run`, `ai/task-planner-run`, `ai/stock-planner-run`, `ai/knowledge-manager-run`,
    `consultant-chat`, `calls/:callId/analyze`). Usa Redis (`REDIS_URL`, via `ioredis`) como store cuando
    esta configurado -- necesario porque `apps/api` corre serverless en Vercel, donde el estado en memoria
    no persiste entre invocaciones -- con fallback a memoria para desarrollo local; `skipOnError: true`
    para que un fallo del store no tumbe la API. Verificado en vivo (`curl -sD -` contra `/health`
    devuelve `x-ratelimit-limit`/`x-ratelimit-remaining` reales). **Corregido 2026-07-27**: una nota
    anterior de esta seccion decia que `apps/worker` ya usaba Redis en produccion (Q-002) y que solo
    faltaba reutilizar esa misma variable -- **incorrecto**, verificado contra el `.env.local` real (apunta
    a `localhost`, solo desarrollo) y contra `OPS-00` (`apps/worker` no esta desplegado en ningun sitio hoy,
    las secrets de GitHub Actions no incluyen `REDIS_URL`). No existe ningun Redis en produccion todavia.
  - **Aceptado 2026-07-27** (decision explicita de Rafa, mismo patron que R-015 staging): provisionar un
    Redis gestionado (ej. Upstash) para centralizar el rate limit **se pospone a proposito** hasta que haya
    trafico real de Piloto 1 -- sin clientes reales hoy, el limite por instancia serverless ya es
    suficiente, no vale la pena la infraestructura extra ahora. Revisar cuando OPS-01 (piloto) abra de
    verdad.
  - Sin threat model documentado (ver SQO-04 propuesto en el README de este dominio).
- **Siguiente accion:** ampliar la matriz de RLS a campañas/stock cuando esos dominios tengan tablas
  propias (INT-02/BE-06). `REDIS_URL` en produccion queda diferido (ver arriba), no es la siguiente accion.

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
