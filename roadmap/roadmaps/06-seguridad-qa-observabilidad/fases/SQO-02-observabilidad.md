# SQO-02 - Observabilidad

Endurecimiento de artifacts 2026-08-26: los findings sanitizados limitan strings de detalle a
2.000 caracteres y summaries a 500 antes de llegar al workflow de GitHub Issues. El redactor común
ya cubre el límite de detalle; test directo de sanitización pasa 2/2.

## Estado

Incremento de rendimiento 2026-08-26: `runOpsHealthCheck` consulta en paralelo el primer lote
de fuentes independientes (conexiones en error, conexiones `syncing` y sync runs fallidos). La
salida y el manejo de errores permanecen iguales; typecheck API y observabilidad 9/9 pasan.

El segundo lote independiente tambien queda paralelo: credenciales por expirar, presupuesto IA,
purga pendiente y backlog de webhooks. La ejecucion conserva errores por fuente y sus findings.

> Correccion vigente 2026-08-24: ya existe un registro minimo de metricas
> process-local en `packages/observability` y el endpoint Prometheus protegido
> `/health/metrics`; registra al menos `http_requests_total`. El gap real no es
> "sin metricas", sino ampliar cobertura a worker/sync/coste IA y contar con un
> backend compartido/APM para varias instancias.

> Auditoria de cobertura 2026-08-24: la instrumentacion agregada esta conectada
> al hook `onResponse` del API. El worker (`apps/worker/src/worker.ts`) y los
> procesos de sync/reconciliacion mantienen `job_id`, `correlation_id` y logs
> estructurados, pero no publican contadores compartidos. Se mantiene asi de
> forma intencionada hasta introducir un backend de metricas comun; añadir un
> registro process-local aislado en el worker no resolveria observabilidad en
> varias instancias.

> Correccion de lectura 2026-08-24: las frases historicas inferiores que dicen
> "sin metricas" se refieren a la etapa anterior al registro process-local y
> quedan supersedidas. El estado actual es metricas HTTP minimas + logs
> correlacionados; faltan metricas agregadas de worker/sync/coste IA y APM.

> Instrumentacion vigente 2026-08-24: el mismo registro compartido del API
> ahora agrega `ai_runs_total` por agente/estado y
> `ai_estimated_cost_usd_total` por agente para diagnosticos genericos, A01,
> A11 y A09/chat. Las etiquetas son de baja cardinalidad y no incluyen
> organizacion, prompts, contexto ni salida del modelo. La cobertura del worker
> y el backend de metricas compartido quedan pendientes.

> **Ampliacion vigente 2026-08-24:** el worker ahora reutiliza
> `@ecomscaling/observability` para contar `worker_jobs_total` por nombre/estado
> (`started`, `completed`, `failed`) y conserva `job_id`/`correlation_id` en logs.
> La suite del worker pasa 14/14 incluyendo el contrato de estos contadores.
> Sigue siendo process-local: no se presenta como agregacion multi-instancia ni
> sustituye un backend de metricas compartido.

> **Ampliacion vigente 2026-08-24:** `MetricsRegistry` también soporta histogramas
> Prometheus acumulativos. El hook `onResponse` del API registra
> `http_request_duration_ms` por método, ruta y estado, con buckets de latencia,
> `_count` y `_sum`. La suite de observabilidad pasa 6/6 y el typecheck del API
> pasa tras regenerar la declaración compilada del paquete. Sigue siendo
> process-local hasta provisionar un backend compartido.

> **Endurecimiento vigente 2026-08-24:** `runOpsHealthCheck` sanitiza los detalles
> antes de escribir el artifact que consume el workflow de GitHub Issues. Redacta
> tanto claves sensibles como credenciales embebidas en `error_message`; prueba
> aislada 1/1 y typecheck del API pasan.

- **Estado real:** `in_progress` (corregido 2026-07-20 — ver nota abajo, no es `planned_critical` desde
  cero como decian revisiones anteriores de este documento)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-08-24
- **Dependencias:** ninguna tecnica
- **Correccion importante (segunda vez en esta sesion que se corrige una afirmacion de "no existe
  observabilidad")**: la version anterior de este documento decia que no habia logging estructurado
  porque `grep` de `"pino"`/`"winston"` en `package.json` no devolvia nada. Eso fue una verificacion
  incompleta: **Fastify ya trae `pino` como dependencia interna** (`Fastify({ logger: true, genReqId })`
  en `apps/api/src/server.ts`) y genera logs JSON estructurados con `reqId` correlacionado
  (`x-request-id` o `crypto.randomUUID()`) para cada request automaticamente ("incoming request"/"request
  completed" con method/url/statusCode/responseTime), verificado en vivo con `app.inject`. Ademas existe
  `createLogger` en `packages/observability` (JSON estructurado por `service`), usado en 9 archivos de
  `apps/api`/`apps/worker` (workers de cron, sync de Shopify/Meta, webhooks).
- **Correlacion end-to-end cerrada 2026-08-03**: el `x-request-id` existia en la respuesta desde
  2026-08-02, pero **no llegaba a nadie**. Dos fallos encadenados: (1) el CORS del API no lo declaraba en
  `exposedHeaders`, asi que el navegador se lo oculta al codigo de `apps/web` en cualquier respuesta
  cross-origin — la cabecera solo servia si ya estabas leyendo los logs del servidor, que es justo lo que
  no tienes cuando un cliente reporta un error; y (2) `readApiError`, por donde pasan los errores de las
  12 pantallas autenticadas, lo descartaba. Corregidos los dos: el mensaje que ve la persona termina en
  `(ref: <request id>)` y con eso soporte encuentra el log estructurado exacto. Sin cabecera no se anade
  ruido. 4 tests en `apps/web/src/lib/api-error.test.ts` + 1 en
  `apps/api/src/observability-metrics-endpoint.test.ts` que falla si alguien quita el `exposedHeaders`.
- **Redaccion de secretos anadida 2026-07-20 (cierra el gap correspondiente de SQO-00)**: configuracion
  `redact` explicita en el logger de Fastify (`req.headers.authorization`, `req.headers.cookie`,
  `*.access_token`, `*.refresh_token`, `*.client_secret`, `*.api_key`, `*.service_role_key`), verificada en
  vivo: un log que incluya esos campos los reemplaza por `[REDACTED]` en vez de imprimirlos en claro. Antes
  de este cambio no habia ningun log real conocido que expusiera secretos (verificado: ningun archivo logea
  `request.headers` completo hoy), pero no habia proteccion explicita contra que ocurriera en el futuro.
- **`organization_id` en logs, cerrado 2026-07-22**: `server.ts` ahora tiene un hook `onRequest` que
  detecta `:organizationId` en los params de la ruta (62 de las rutas lo llevan) y reemplaza
  `request.log` por un child logger de pino con `organization_id` fijado -- cualquier log que un handler o
  servicio emita despues via `request.log.info/error` durante esa request ya lo incluye automaticamente,
  sin tocar cada endpoint uno a uno. Verificado en vivo con `app.inject`: confirmado que el log
  "incoming request"/"request completed" **automatico** de Fastify no lo recoge (usa el logger capturado
  antes de que corra el `onRequest` de arriba, limitacion real de Fastify, no un bug de esta implementacion)
  -- por eso se anadio tambien un hook `onResponse` que emite `request_completed_with_org` con
  `statusCode`/`responseTimeMs` usando el logger ya enriquecido, para que exista al menos una linea de
  cierre por request filtrable por organizacion.
- **`user_id` en logs, cerrado 2026-07-23**: el mismo hook `onRequest` ahora tambien extrae `sub` (user id)
  del JWT del header `Authorization` y lo fija en el mismo child logger junto a `organization_id` --
  `decodeJwtSubject` en `server.ts`, decodifica el payload del token **sin verificar la firma**, a
  proposito: es solo para poder filtrar logs por usuario, nunca para autorizacion (eso lo sigue haciendo
  `resolveAuthContext`, que si verifica contra Supabase, en cada handler). Un token invalido en este punto
  solo podria ensuciar una linea de log, la request se rechaza igual donde corresponda. El hook `onResponse`
  ahora dispara `request_completed_with_org` si hay `organization_id` **o** `user_id` -- antes solo
  disparaba con `organization_id`, asi que rutas sin `:organizationId` en el path (p. ej. `/v1/bootstrap`)
  no tenian ninguna linea de cierre filtrable. Verificado en vivo con `app.inject` contra un usuario real
  de Supabase: el `user_id` del log coincide exactamente con el id del usuario autenticado.
- **Resuelto 2026-07-23 (`organization_id` en `createLogger`, no solo en el logger de Fastify)**: auditados
  los 46 usos reales de `logger.info`/`logger.error` en los 13 archivos de produccion que usan
  `createLogger` (`packages/observability`) -- solo 7 llevaban `organization_id` en su `meta`, pese a estar
  disponible en scope en la mayoria. Corregidos 21 mas en `shopify-sync.ts` (9), `shopify-webhooks.ts` (3,
  mas un parametro `organizationId` nuevo en `registerShopifyWebhooks` para poder pasarlo desde sus 2
  llamadores), `shopify-webhook-handler.ts` (4), `meta-sync.ts` (1), `meta.ts` (4), `memory-ingestion.ts`
  (3), `shopify-count-reconcile.ts` (1), `audit-log.ts` (1 -- hallazgo curioso: el propio log de "fallo al
  escribir auditoria" no llevaba el campo que la auditoria existe para filtrar), `consultant.ts` (2, mas
  normalizado `organizationId`->`organization_id` para que sea el mismo nombre de campo en todo el sistema)
  y `ai-runtime.ts` (1, fallback Anthropic->OpenAI). `shopify-token-store.ts` (1) y `shopify-reconcile.ts`
  (2) revisados y dejados igual a proposito: el primero solo tiene `connectionId` en scope sin el
  `organization_id` ya cargado (anadirlo exigiria una consulta extra solo para loguear, no vale la pena); el
  segundo son logs legitimamente a nivel de lote (fallo de consulta / resumen de la pasada), no de una
  organizacion concreta. 105/105 tests de `apps/api` pasan tras el cambio, typecheck limpio en los 10
  workspaces.
- **Sigue faltando de verdad, no solo por pulir**: sin metricas (contadores/histogramas de API, worker,
  sync, coste IA) mas alla de logs individuales. Sin error tracking/APM (Sentry o equivalente, herramienta de
  pago -- fuera de alcance mientras no haya presupuesto). Sin alertas mas alla de `ops-health-check.yml`. Sin
  panel de salud dedicado (aunque `/consultor` ya cubre gran parte de esa necesidad via el score de FE-07,
  ver `CHECKLIST-SALUD-CLIENTE.md`).
- **Por que sigue siendo relevante y no un "nice to have"**: cuando un cliente reporte "los pedidos de ayer
  no aparecen", ahora se puede filtrar por `organization_id` tanto en los logs de una request de API real
  como en los del worker/cron de sync (`shopify-sync.ts`/`meta-sync.ts`/`shopify-webhooks.ts`, gap cerrado
  2026-07-23) -- pero sigue sin existir metricas agregadas de sync/cola/coste, asi que aunque ahora se puede
  filtrar logs por organizacion, seguir sumando/comparando esos logs a lo largo del tiempo sigue siendo
  trabajo manual.

## Entregables

- Logs JSON con request_id, user_id, organization_id, job_id y agent_run_id.
- Metricas API, worker, sync freshness, rate limits, tokens y coste IA.
- Tracing web -> API -> worker -> proveedor -> PostgreSQL.
- Alertas operativas.
- Panel interno de salud por organizacion.

## Diseño propuesto (sin implementar, para no perder el criterio)

**Cadena de correlacion** (no todos los campos existiran siempre, pero deben compartir contexto cuando
apliquen): `request_id -> connection_id -> sync_run_id -> job_id -> provider_request_id ->
webhook_event_id -> agent_run_id -> query_run_id`.

**Campos minimos de log estructurado**: `timestamp, level, service (api|worker|web), environment,
request_id, user_id, organization_id, store_id, connection_id, sync_run_id, job_id, agent_run_id,
provider, event, duration_ms, result`. Nunca loguear tokens, secrets, transcripciones completas, payloads
con PII ni prompts completos sin politica — ver tambien el gap de redaccion de logs en SQO-00.

**Metricas por bloque**: API (request count, error rate, p50/p95/p99, rate limit rejections, auth
failures) · worker (queue depth/lag, running/failed/retry/dead-letter, job duration) · integraciones por
organizacion/tienda/proveedor (ultima sync ok/fallida, freshness, token expiration, scopes faltantes,
webhooks recibidos/duplicados) · IA (runs, rechazados, tokens, coste, latencia, cache hit rate, tareas
materializadas).

**SLI/SLO iniciales a validar con infraestructura real** (numeros de ejemplo, no aprobados):

| Servicio             | Indicador            | Objetivo     |
| -------------------- | -------------------- | ------------ |
| API                  | Latencia p95 lectura | <500 ms      |
| Shopify              | Freshness pedidos    | <30 min      |
| Webhooks             | Procesamiento p95    | <2 min       |
| A02 cache hit / miss | Latencia             | <1 s / <30 s |
| IA                   | Runs fallidos        | <2%          |

**Alertas operativas minimas**: cola bloqueada, job repetidamente fallido, token proximo a expirar,
sync desactualizado, coste IA anomalo, error rate elevado — cada una con runbook (ver SQO-06 propuesto).

**Panel de salud por organizacion**: conexiones y estado, ultima actualizacion, scopes, jobs pendientes,
configuracion financiera, health score determinista (reutilizando la formula ya real de FE-07).

## Criterios de cierre

- Un fallo de sync se puede diagnosticar sin acceder manualmente a la base.
- Hay alertas para colas bloqueadas, tokens expirados y datos desactualizados.
- Se puede seguir un request extremo a extremo con la cadena de correlacion.
- Logs verificados sin secretos ni PII (compartido con SQO-00).

## Corrección 2026-08-01 — métricas agregables mínimas

El API registra `http_requests_total` por método, ruta y código de estado mediante el registro común de
`@ecomscaling/observability`. `/health/metrics` está protegido por `INTERNAL_API_SECRET` y devuelve formato
Prometheus; no incluye identificadores de organización/usuario. El registro es process-local y no sustituye
un backend de métricas compartido para varias instancias.
