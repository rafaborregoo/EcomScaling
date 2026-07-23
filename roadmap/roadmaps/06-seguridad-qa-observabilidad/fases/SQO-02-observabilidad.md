# SQO-02 - Observabilidad

## Estado

- **Estado real:** `in_progress` (corregido 2026-07-20 — ver nota abajo, no es `planned_critical` desde
  cero como decian revisiones anteriores de este documento)
- **Responsable:** sin asignar
- **Ultima validacion:** 2026-07-23
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
- **Sigue faltando de verdad, no solo por pulir**: `createLogger` se usa de forma inconsistente (9 archivos de muchos mas, y no lleva `organization_id`
  todavia -- solo el logger de Fastify por request lo tiene). Sin metricas (contadores/histogramas de API,
  worker, sync, coste IA) mas alla de logs individuales. Sin error tracking/APM (Sentry o equivalente). Sin
  alertas ni panel de salud.
- **Por que sigue siendo relevante y no un "nice to have"**: cuando un cliente reporte "los pedidos de ayer
  no aparecen", ahora se puede filtrar por `organization_id` en los logs de una request de API real (gap
  cerrado), pero sigue sin existir metricas agregadas de sync/cola/coste ni logs de `organization_id` en
  el codigo de worker/cron (que usa `createLogger`, no el logger de Fastify) — todavia hace falta leer
  codigo y consultar la DB a mano para investigaciones que crucen varias requests o corran fuera de la API.

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

| Servicio | Indicador | Objetivo |
| --- | --- | --- |
| API | Latencia p95 lectura | <500 ms |
| Shopify | Freshness pedidos | <30 min |
| Webhooks | Procesamiento p95 | <2 min |
| A02 cache hit / miss | Latencia | <1 s / <30 s |
| IA | Runs fallidos | <2% |

**Alertas operativas minimas**: cola bloqueada, job repetidamente fallido, token proximo a expirar,
sync desactualizado, coste IA anomalo, error rate elevado — cada una con runbook (ver SQO-06 propuesto).

**Panel de salud por organizacion**: conexiones y estado, ultima actualizacion, scopes, jobs pendientes,
configuracion financiera, health score determinista (reutilizando la formula ya real de FE-07).

## Criterios de cierre

- Un fallo de sync se puede diagnosticar sin acceder manualmente a la base.
- Hay alertas para colas bloqueadas, tokens expirados y datos desactualizados.
- Se puede seguir un request extremo a extremo con la cadena de correlacion.
- Logs verificados sin secretos ni PII (compartido con SQO-00).
